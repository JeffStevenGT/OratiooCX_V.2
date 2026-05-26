"""
coordinator.py — Orquestador multi-máquina de workers
======================================================
Gestiona workers en paralelo, asigna proxies exclusivos (1:1),
reporta estado a Supabase, y permite control remoto desde la Web UI.

FLUJO:
  1. Lee configuración de Supabase (tabla config_bots)
  2. Lee proxies disponibles de proxies.txt
  3. Asigna 1 proxy exclusivo por worker
  4. Lanza N workers como procesos independientes
  5. Cada worker procesa DNIs de la cola (Supabase)
  6. Reporta heartbeat cada 30s a Supabase
  7. Web UI ve el estado en tiempo real

USO:
  python coordinator.py                          # Workers desde Supabase (tabla maquinas)
  python coordinator.py --workers 5              # Forzar 5 workers
  python coordinator.py --workers 0              # Solo monitorear
"""

import os
import sys
import time
import json
import signal
import random
import subprocess
import threading
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime

# ── Pause/Resume en Windows (via kernel32) ───────
if sys.platform == "win32":
    import ctypes
    from ctypes import wintypes
    kernel32 = ctypes.windll.kernel32
    # Procesos hijo no heredan el handle automáticamente, obtenemos por PID
    _OpenProcess = kernel32.OpenProcess
    _OpenProcess.restype = wintypes.HANDLE
    _OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    PROCESS_SUSPEND_RESUME = 0x0800
    _SuspendThread = kernel32.SuspendThread
    _ResumeThread = kernel32.ResumeThread
    _CloseHandle = kernel32.CloseHandle

    def _suspend_windows(pid):
        """Suspende todos los hilos de un proceso en Windows."""
        h = _OpenProcess(PROCESS_SUSPEND_RESUME, False, pid)
        if h:
            # Suspender todos los hilos vía NtSuspendProcess (Windows 7+)
            try:
                ntdll = ctypes.windll.ntdll
                ntdll.NtSuspendProcess(h)
            except:
                pass
            _CloseHandle(h)

    def _resume_windows(pid):
        """Reanuda todos los hilos de un proceso en Windows."""
        h = _OpenProcess(PROCESS_SUSPEND_RESUME, False, pid)
        if h:
            try:
                ntdll = ctypes.windll.ntdll
                ntdll.NtResumeProcess(h)
            except:
                pass
            _CloseHandle(h)
else:
    def _suspend_windows(pid): pass
    def _resume_windows(pid): pass

load_dotenv()

# ── Config ────────────────────────────────────────

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
WORKER_SCRIPT = Path(__file__).parent / "worker.py"
PROXIES_FILE = Path(__file__).parent / "proxies.txt"

MAQUINA_NOMBRE = os.getenv("MAQUINA_NOMBRE", f"PC-{os.uname().nodename if hasattr(os, 'uname') else 'local'}")
HEARTBEAT_INTERVAL = 15  # segundos (la web espera < 20s)
REFRESH_CONFIG_INTERVAL = 60  # segundos


# ── Estado global ─────────────────────────────────

workers_activos = {}  # {worker_id: {"process": Popen, "proxy": dict, "started_at": float, ...}}
navegadores_asesores = {}  # {asesor_id: {"process": Popen, "proxy": dict, "started_at": float}}
detener = False
lock = threading.Lock()

# Cache de proxies disponibles (se recarga al necesitar)
_PROXIES_CACHE = None


# ── Proxies ───────────────────────────────────────

def _parsear_proxy(linea: str) -> dict | None:
    """Parsea una línea de proxies.txt. Formato: ip:puerto:usuario:contraseña"""
    linea = linea.strip()
    if not linea or linea.startswith("#"):
        return None
    partes = linea.split(":")
    if len(partes) == 4:
        return {
            "ip": partes[0],
            "puerto": partes[1],
            "usuario": partes[2],
            "password": partes[3],
            "server": f"http://{partes[0]}:{partes[1]}",
        }
    return None


def cargar_todos_los_proxies() -> list[dict]:
    """Carga todos los proxies desde proxies.txt."""
    global _PROXIES_CACHE
    if _PROXIES_CACHE is not None:
        return _PROXIES_CACHE
    proxies = []
    if not PROXIES_FILE.exists():
        print(f"[Coordinator] No existe {PROXIES_FILE}")
        _PROXIES_CACHE = proxies
        return proxies
    with open(PROXIES_FILE, "r", encoding="utf-8") as f:
        for linea in f:
            p = _parsear_proxy(linea)
            if p:
                proxies.append(p)
    print(f"[Coordinator] [DATA]  {len(proxies)} proxies cargados")
    _PROXIES_CACHE = proxies
    return proxies


def asignar_proxies(proxies: list[dict], num_workers: int) -> list[dict]:
    """
    Asigna proxies exclusivos a cada worker.
    Si hay menos proxies que workers, algunos workers van sin proxy.
    """
    proxies_disponibles = list(proxies)  # copia
    random.shuffle(proxies_disponibles)

    asignaciones = []
    for i in range(num_workers):
        if i < len(proxies_disponibles):
            asignaciones.append(proxies_disponibles[i])
        else:
            asignaciones.append(None)  # Sin proxy
    return asignaciones


# ── Comunicación con Supabase ────────────────────

def _api(method: str, path: str, body: dict = None) -> list | dict:
    """Llamada REST a Supabase."""
    import json as _json
    from urllib.request import Request, urlopen
    from urllib.error import HTTPError

    if not SUPABASE_URL or not SERVICE_KEY:
        return []

    url = f"{SUPABASE_URL}/rest/v1{path}"
    data = _json.dumps(body).encode() if body else None
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=10) as resp:
            raw = resp.read().decode()
            return _json.loads(raw) if raw else []
    except HTTPError as e:
        err_body = e.read().decode()[:200] if e.fp else str(e)
        return []
    except Exception as e:
        return []


def reportar_estado(workers_info: list[dict]):
    """Reporta estado actual de workers a Supabase (tabla maquinas)."""
    ahora = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    body = {
        "nombre": MAQUINA_NOMBRE,
        "workers_activos": len(workers_info),
        "workers_info": workers_info,
        "ultimo_heartbeat": ahora,
        "estado": "activo",
    }

    # Upsert por nombre
    existentes = _api("GET", f"/maquinas?nombre=eq.{MAQUINA_NOMBRE}&select=id&limit=1")
    if existentes:
        _api("PATCH", f"/maquinas?id=eq.{existentes[0]['id']}", body)
    else:
        _api("POST", "/maquinas", body)


# ── Lanzar workers ────────────────────────────────

def lanzar_worker(worker_id: int, proxy: dict | None) -> subprocess.Popen | None:
    """
    Lanza un worker.py como proceso independiente.
    Redirige stdout/stderr a logs/worker_{worker_id}.log.
    Retorna el objeto Popen o None si falló.
    """
    log_dir = Path(__file__).parent / "logs"
    log_dir.mkdir(exist_ok=True)
    log_file = open(log_dir / f"worker_{worker_id}.log", "a", encoding="utf-8")

    env = os.environ.copy()

    if proxy:
        env["PROXY_SERVER"] = proxy["server"]
        env["PROXY_USER"] = proxy.get("usuario", "")
        env["PROXY_PASS"] = proxy.get("password", "")

    env["WORKER_ID"] = str(worker_id)
    env["WORKER_MAQUINA"] = MAQUINA_NOMBRE

    try:
        proc = subprocess.Popen(
            [sys.executable, str(WORKER_SCRIPT)],
            env=env,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            text=True,
        )
        print(f"[Coordinator] [INI] Worker #{worker_id} iniciado "
              f"{'(proxy: '+proxy['ip']+')' if proxy else '(sin proxy)'}")
        return proc
    except Exception as e:
        log_file.write(f"Error launching worker #{worker_id}: {e}\n")
        log_file.close()
        return None


def detener_todos_los_workers():
    """Detiene todos los workers activos."""
    with lock:
        for wid, winfo in list(workers_activos.items()):
            try:
                winfo["process"].terminate()
            except Exception:
                pass
        workers_activos.clear()


# ── Heartbeat ─────────────────────────────────────

def heartbeat_loop():
    """Hilo que reporta estado a Supabase cada N segundos.
    Preserva dni_actual que los workers reportan individualmente."""
    global detener
    while not detener:
        with lock:
            # Leer workers_info actual de Supabase para preservar dni_actual
            datos_previos = _api("GET", f"/maquinas?nombre=eq.{MAQUINA_NOMBRE}&select=workers_info,id&limit=1")
            dni_map = {}
            if datos_previos:
                prev = datos_previos[0].get("workers_info", []) or []
                if isinstance(prev, str):
                    import json as _json
                    try: prev = _json.loads(prev)
                    except: prev = []
                for pw in prev:
                    if isinstance(pw, dict) and pw.get("dni_actual"):
                        dni_map[str(pw.get("id"))] = pw["dni_actual"]

            workers_info = [
                {
                    "id": wid,
                    "proxy_ip": winfo.get("proxy", {}).get("ip", "N/A"),
                    "activo_desde": winfo.get("started_at", ""),
                    "pid": winfo.get("process", None) and winfo["process"].pid or 0,
                    "estado": "pausado" if winfo.get("pausado") else "activo",
                    "dni_actual": dni_map.get(str(wid), ""),
                }
                for wid, winfo in workers_activos.items()
            ]
        reportar_estado(workers_info)
        time.sleep(HEARTBEAT_INTERVAL)


def monitor_workers_loop():
    """Hilo que verifica workers caídos y procesa comandos."""
    global detener
    while not detener:
        time.sleep(5)
        with lock:
            muertos = []
            for wid, winfo in list(workers_activos.items()):
                proc = winfo.get("process")
                if proc and proc.poll() is not None:
                    exit_code = proc.returncode
                    print(f"[Coordinator] [WARN] Worker #{wid} terminó (código: {exit_code})")
                    muertos.append(wid)
            for wid in muertos:
                del workers_activos[wid]

            # Procesar comandos pendientes de workers individuales
            comandos = _api("GET", f"/comandos_bot?maquina_destino=eq.{MAQUINA_NOMBRE}&estado=eq.pendiente&order=creado_el.asc&limit=10")
            for cmd in comandos:
                cid = cmd["id"]
                accion = cmd.get("comando", "")
                params = cmd.get("parametros", {}) or {}
                wid = params.get("worker_id")
                if accion == "pausar" and wid:
                    wk = next((w for w, v in workers_activos.items() if str(w) == str(wid)), None)
                    if wk and wk in workers_activos:
                        workers_activos[wk]["pausado"] = True
                        print(f"[Coordinator] [CMD] Worker #{wid} pausado")
                    _api("PATCH", f"/comandos_bot?id=eq.{cid}", {"estado": "completado"})
                elif accion == "reanudar" and wid:
                    wk = next((w for w, v in workers_activos.items() if str(w) == str(wid)), None)
                    if wk and wk in workers_activos:
                        workers_activos[wk]["pausado"] = False
                        print(f"[Coordinator] [CMD] Worker #{wid} reanudado")
                    _api("PATCH", f"/comandos_bot?id=eq.{cid}", {"estado": "completado"})
                elif accion == "detener" and wid:
                    wk = next((w for w, v in workers_activos.items() if str(w) == str(wid)), None)
                    if wk and wk in workers_activos:
                        proc = workers_activos[wk]["process"]
                        proc.terminate()
                        del workers_activos[wk]
                        print(f"[Coordinator] [CMD] Worker #{wid} detenido")
                    _api("PATCH", f"/comandos_bot?id=eq.{cid}", {"estado": "completado"})



# ── Main ──────────────────────────────────────────

def main():
    global detener

    import argparse
    parser = argparse.ArgumentParser(description="Oratioo CX - Coordinador de Workers")
    parser.add_argument("--workers", type=int, default=None,
                        help="Número de workers a iniciar")
    parser.add_argument("--max-dnis", type=int, default=0,
                        help="Máximo DNIs por worker (0 = ilimitado)")
    args = parser.parse_args()

    num_workers = args.workers
    if num_workers is None:
        # Leer configuración desde Supabase (tabla maquinas)
        try:
            maquinas = _api("GET", f"/maquinas?nombre=eq.{MAQUINA_NOMBRE}&select=workers_config")
            if maquinas and len(maquinas) > 0:
                num_workers = int(maquinas[0].get("workers_config", 0) or 0)
            else:
                num_workers = 0
        except Exception as e:
            num_workers = 0
    
    if num_workers is None or num_workers <= 0:
        print("[Coordinator] Modo monitoreo — 0 workers")
        num_workers = 0


    # ── Cargar proxies ──
    todos_proxies = cargar_todos_los_proxies()

    # ── Asignar proxies ──
    if num_workers > 0:
        asignaciones = asignar_proxies(todos_proxies, num_workers)
        proxies_libres = len(todos_proxies) - num_workers

        # ── Lanzar workers ──
        for i in range(num_workers):
            proxy = asignaciones[i]
            proc = lanzar_worker(i + 1, proxy)
            if proc:
                with lock:
                    workers_activos[i + 1] = {
                        "process": proc,
                        "proxy": proxy,
                        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    }

    # ── Iniciar hilos de monitoreo ──
    hb_thread = threading.Thread(target=heartbeat_loop, daemon=True)
    hb_thread.start()

    monitor_thread = threading.Thread(target=monitor_workers_loop, daemon=True)
    monitor_thread.start()

    # ── Manejar Ctrl+C ──
    def signal_handler(sig, frame):
        global detener
        print("\n[Coordinator] ⏹  Deteniendo...")
        detener = True
        detener_todos_los_workers()
        # Reportar estado final
        reportar_estado([])
        print("[Coordinator] [BYE]  Bye!")
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # ── Loop principal ──
    try:
        while not detener:
            time.sleep(1)
            # Mostrar estado cada 15s
            with lock:
                activos = len(workers_activos)
            if activos > 0:
                print(f"\r[Coordinator] [ACT]  Workers activos: {activos}", end="")
            else:
                print(f"\r[Coordinator] [OFF]  Sin workers activos", end="")
    except KeyboardInterrupt:
        signal_handler(None, None)


if __name__ == "__main__":
    main()
