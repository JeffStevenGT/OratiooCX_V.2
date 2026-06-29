"""
bot/coordinator_loop.py -- Coordinator Daemon Multi-Worker (API-First, Battle-Hardened)
=======================================================================================
Daemon que corre 24/7 y espera comandos del frontend.

Flujo:
  1. Se registra con nombre de máquina (--machine-name)
  2. Envia heartbeat cada 30s con workers activos
  3. Polling GET /api/bot/command?maquina=NOMBRE cada 5s
  4. Solo ejecuta comandos dirigidos a su maquina o a '*'
  5. Auto-reinicia workers que mueren (max 5/hora)
  6. Rescata DNIs atascados periodicamente (en_progreso > 30min)
  7. Rescata errores viejos (>2h) -> pendiente
  8. Limpieza de duplicados al arrancar

USO:
  python coordinator_loop.py --machine-name vps-espana-1
  python coordinator_loop.py --machine-name localhost --workers 5
"""

import os, sys, time, signal, subprocess, json, socket, requests
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv, find_dotenv

# [!!] Buscar .env en CWD o raiz del proyecto
_env_path = find_dotenv(usecwd=True)
if not _env_path:
    _env_path = str(Path(__file__).parent.parent / ".env")
load_dotenv(_env_path)
print(f"[COORDINATOR] .env cargado desde: {_env_path}")

BACKEND_URL = os.getenv("BOT_API_URL", "http://localhost:3000")
BOT_API_KEY = os.getenv("BOT_API_KEY")
if not BOT_API_KEY:
    raise RuntimeError("[COORDINATOR] [!!] CRITICO: BOT_API_KEY no definida en .env")
BOT_DIR = Path(__file__).parent
POLL_INTERVAL = 5
HEARTBEAT_INTERVAL = 30
RESCUE_INTERVAL = 60       # rescatar DNIs atascados cada 1 min
ERROR_RESCUE_INTERVAL = 300  # rescatar errores viejos cada 5 min
RELEASE_INTERVAL = 3600     # liberar leads inactivos cada hora
STAGGER_DELAY = 3           # segundos entre lanzamiento de workers

# ===========================================
# API helpers
# ===========================================
_api_headers = {
    "Content-Type": "application/json",
    "x-bot-api-key": BOT_API_KEY,
}

def api_get(path):
    try:
        r = requests.get(f"{BACKEND_URL}{path}", headers=_api_headers, timeout=10)
        return r.json() if r.ok else None
    except:
        return None

def api_post(path, data):
    try:
        r = requests.post(f"{BACKEND_URL}{path}", json=data, headers=_api_headers, timeout=15)
        return r.json() if r.ok else None
    except:
        return None

def api_patch(path, data):
    try:
        r = requests.patch(f"{BACKEND_URL}{path}", json=data, headers=_api_headers, timeout=10)
        return r.ok
    except:
        return False

# ===========================================
# Worker management
# ===========================================
processes: list[subprocess.Popen] = []

def alive_count():
    return sum(1 for p in processes if p.poll() is None)

def kill_all_workers():
    global processes
    if not processes:
        return
    print("[COORDINATOR] Enviando señal de cierre a workers...")
    for p in processes:
        try:
            if os.name == 'nt':
                # Windows: CTRL_BREAK_EVENT para que el worker haga cleanup
                try:
                    os.kill(p.pid, signal.CTRL_BREAK_EVENT)
                except:
                    p.terminate()
            else:
                p.terminate()
        except Exception:
            pass
    # Esperar cierre limpio
    time.sleep(8)
    for p in processes:
        try:
            if p.poll() is None:
                print(f"[COORDINATOR] Worker {p.pid} no respondió, forzando kill...")
                p.kill()
                p.wait()
        except Exception:
            pass
    processes = []
    print("[COORDINATOR] Todos los workers detenidos.")

def rescue_stale_dnis(minutos: int = 30):
    """Rescata DNIs atascados en 'en_progreso' por workers zombies."""
    try:
        r = api_post("/api/bot/reset-stale", {"minutos": minutos})
        if r:
            rescatados = r.get("rescatados", 0)
            if rescatados > 0:
                print(f"[COORDINATOR] [RESCATE] {rescatados} DNIs atascados rescatados -> pendiente")
        return r is not None
    except Exception as e:
        print(f"[COORDINATOR] Error rescatando DNIs: {e}")
        return False

def fetch_credentials():
    """Obtiene credenciales Pangea activas desde la API."""
    try:
        r = requests.get(
            f"{BACKEND_URL}/api/bot/credenciales",
            headers={"x-bot-api-key": BOT_API_KEY},
            timeout=10,
        )
        if r.ok:
            return r.json()
    except Exception:
        pass
    return []

def spawn_workers(count: int, machine_name: str, use_proxy: bool = True):
    global processes
    kill_all_workers()

    count = max(1, min(count, 20))
    print(f"[COORDINATOR] Lanzando {count} worker(s)...")

    # Rescatar DNIs atascados del arranque anterior
    rescue_stale_dnis(minutos=1)

    # Obtener credenciales
    creds = fetch_credentials()
    if not creds:
        print("[COORDINATOR] Sin credenciales en BD. Usando .env como fallback.")
        creds = [{"usuario": os.getenv("ORANGE_USER", ""), "password": os.getenv("ORANGE_PASS", "")}]
    print(f"[COORDINATOR] {len(creds)} credencial(es) disponibles")

    for i in range(count):
        c = creds[i % len(creds)] if creds else {"usuario": "", "password": ""}
        env = os.environ.copy()
        env["ORANGE_USER"] = c.get("usuario", "")
        env["ORANGE_PASS"] = c.get("password", "")

        args = [sys.executable, str(BOT_DIR / "worker_loop.py"),
                "--worker-id", str(i), "--machine", machine_name]
        if use_proxy:
            args.append("--proxy")
        p = subprocess.Popen(args, env=env)
        processes.append(p)
        print(f"  Worker {i+1} PID {p.pid} (cred #{i % len(creds)})")
        time.sleep(STAGGER_DELAY)  # Stagger para no saturar Pangea

    print(f"[COORDINATOR] {count} workers activos.\n")

# ===========================================
# Worker restart tracking
# ===========================================
_worker_restart_count: dict = {}

def restart_dead_workers(machine_name: str):
    """Reinicia workers muertos con limite de 5 reintentos por hora."""
    global _worker_restart_count
    now_hour = int(time.time() / 3600)
    if not hasattr(restart_dead_workers, '_last_hour') or restart_dead_workers._last_hour != now_hour:
        restart_dead_workers._last_hour = now_hour
        _worker_restart_count.clear()

    creds = fetch_credentials()
    if not creds:
        creds = [{"usuario": os.getenv("ORANGE_USER", ""), "password": os.getenv("ORANGE_PASS", "")}]

    for i, p in enumerate(processes):
        if p.poll() is not None:
            rc = p.returncode
            c = creds[i % len(creds)] if creds else {"usuario": "", "password": ""}
            key = f"{machine_name}-{i}"
            count = _worker_restart_count.get(key, 0)
            if count >= 5:
                print(f"[COORDINATOR] Worker {i+1} alcanzo limite de reinicios (5/h). Detenido.")
                continue
            _worker_restart_count[key] = count + 1
            print(f"[COORDINATOR] Worker {i+1} murio (exit={rc}). Reiniciando ({count+1}/5)...")
            env = os.environ.copy()
            env["ORANGE_USER"] = c.get("usuario", "")
            env["ORANGE_PASS"] = c.get("password", "")
            processes[i] = subprocess.Popen(
                [sys.executable, str(BOT_DIR / "worker_loop.py"),
                 "--proxy", "--worker-id", str(i),
                 "--machine", machine_name],
                env=env,
            )
            time.sleep(STAGGER_DELAY)

# ===========================================
# Command polling
# ===========================================
def poll_commands(machine_name: str):
    data = api_get(f"/api/bot/command?maquina={machine_name}")
    if not data:
        return []
    return data.get("comandos", [])

def handle_command(cmd: dict, machine_name: str):
    comando = cmd.get("comando", "")
    params = cmd.get("parametros", {})

    if comando == "iniciar":
        workers = params.get("workers", 5)
        use_proxy = params.get("proxy", True)  # default True para backwards compat
        spawn_workers(workers, machine_name, use_proxy)
        return True

    if comando == "detener":
        kill_all_workers()
        print("[COORDINATOR] Workers detenidos. Esperando comando 'iniciar'...")
        return True

    return False

# ===========================================
# Heartbeat
# ===========================================
_last_heartbeat = 0

def send_heartbeat(machine_name: str):
    global _last_heartbeat
    now = time.time()
    if now - _last_heartbeat < HEARTBEAT_INTERVAL:
        return
    _last_heartbeat = now
    api_patch("/api/maquinas", {
        "nombre": machine_name,
        "workers_activos": alive_count(),
    })

# ===========================================
# Main daemon
# ===========================================
def main():
    machine_name = socket.gethostname()
    if "--machine-name" in sys.argv:
        idx = sys.argv.index("--machine-name")
        machine_name = sys.argv[idx + 1]

    start_workers = None
    if "--workers" in sys.argv:
        idx = sys.argv.index("--workers")
        start_workers = int(sys.argv[idx + 1])

    print(f"[COORDINATOR] Maquina: {machine_name}")
    print(f"[COORDINATOR] Backend: {BACKEND_URL}")
    print(f"[COORDINATOR] Heartbeat cada {HEARTBEAT_INTERVAL}s | Comandos cada {POLL_INTERVAL}s")
    print(f"[COORDINATOR] Rescate DNIs cada {RESCUE_INTERVAL}s | Rescate errores cada {ERROR_RESCUE_INTERVAL}s")
    print(f"[COORDINATOR] Solo responde a comandos para '{machine_name}' o '*'")

    if start_workers:
        print(f"[COORDINATOR] Arranque directo con {start_workers} workers")
        spawn_workers(start_workers, machine_name)
    else:
        print("[COORDINATOR] Esperando comando 'iniciar' desde el front...")

    # Señales limpias
    def shutdown(sig=None, frame=None):
        print(f"\n[COORDINATOR] Senal recibida. Apagando...")
        kill_all_workers()
        print("[COORDINATOR] Daemon detenido.")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Loop principal
    last_alive = 0
    last_rescue = 0
    last_error_rescue = 0
    last_release_check = 0
    last_status = 0

    while True:
        try:
            now_ts = time.time()

            # Heartbeat
            send_heartbeat(machine_name)

            # Liberar leads inactivos (solo de madrugada 2-3 AM)
            now_dt = datetime.now()
            if now_ts - last_release_check > RELEASE_INTERVAL:
                last_release_check = now_ts
                if 2 <= now_dt.hour < 3:
                    try:
                        r = api_post("/api/pipeline/release-stale", {"dias": 3})
                        if r and r.get("liberados", 0) > 0:
                            print(f"[COORDINATOR] [LIBERAR] {r['liberados']} leads liberados por inactividad (>3 dias)")
                    except Exception as e:
                        print(f"[COORDINATOR] Error liberando leads: {e}")

            # Rescatar DNIs en_progreso atascados
            if processes and now_ts - last_rescue > RESCUE_INTERVAL:
                rescue_stale_dnis(minutos=5)
                last_rescue = now_ts

            # Rescatar errores viejos (>2h) -> pendiente
            if processes and now_ts - last_error_rescue > ERROR_RESCUE_INTERVAL:
                last_error_rescue = now_ts
                try:
                    r = api_post("/api/bot/reset-stale", {"minutos": 120, "estado": "error"})
                    if r and r.get("rescatados", 0) > 0:
                        print(f"[COORDINATOR] [RESCATE-ERR] {r['rescatados']} errores viejos -> pendiente")
                except Exception:
                    pass

            # Poll comandos
            for cmd in poll_commands(machine_name):
                ts = datetime.now().strftime("%H:%M:%S")
                print(f"[{ts}] CMD para '{machine_name}': {cmd.get('comando')} {cmd.get('parametros', {})}")
                handle_command(cmd, machine_name)

            # Reiniciar workers muertos
            if processes:
                restart_dead_workers(machine_name)

            # Status periódico (cada 3h)
            if now_ts - last_status > 10800:
                last_status = now_ts
                alive = alive_count()
                total = len(processes)
                print(f"[{datetime.now().strftime('%H:%M:%S')}] STATUS: {alive}/{total} workers vivos")

            # Mostrar cambio de workers
            alive = alive_count()
            if alive != last_alive:
                total = len(processes)
                print(f"[COORDINATOR] Workers: {alive}/{total} vivos")
                last_alive = alive

            time.sleep(POLL_INTERVAL)

        except KeyboardInterrupt:
            shutdown()
        except Exception as e:
            print(f"[COORDINATOR] Error: {e}")
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
