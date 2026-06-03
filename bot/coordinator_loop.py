"""
bot/coordinator_loop.py — Coordinator Daemon Multi-Worker (API-First)
======================================================================
Daemon que corre 24/7 y espera comandos del frontend.

Flujo:
  1. Se registra con nombre de máquina (--machine-name)
  2. Envía heartbeat cada 30s con workers activos
  3. Polling GET /api/bot/command?maquina=NOMBRE cada 5s
  4. Solo ejecuta comandos dirigidos a su máquina o a '*'
  5. Auto-reinicia workers que mueren

USO:
  python coordinator_loop.py --machine-name vps-espana-1
  python coordinator_loop.py --machine-name localhost --workers 5
"""

import os, sys, time, signal, subprocess, json, requests, socket
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL = os.getenv("BOT_API_URL", "http://localhost:3000")
BOT_API_KEY = os.getenv("BOT_API_KEY", "oratioo-bot-internal-key")
BOT_DIR = Path(__file__).parent
POLL_INTERVAL = 5  # segundos entre polls de comandos
HEARTBEAT_INTERVAL = 30  # segundos entre heartbeats

# ═══════════════════════════════════════════
# API helpers
# ═══════════════════════════════════════════
_api_headers = {
    "Content-Type": "application/json",
    "x-bot-api-key": BOT_API_KEY,
}

def api_get(path):
    try:
        r = requests.get(f"{BACKEND_URL}{path}", headers=_api_headers, timeout=10)
        return r.json() if r.ok else None
    except Exception as e:
        print(f"[API] GET {path} error: {e}")
        return None

def api_patch(path, data):
    try:
        r = requests.patch(f"{BACKEND_URL}{path}", json=data, headers=_api_headers, timeout=10)
        return r.ok
    except Exception:
        return False

# ═══════════════════════════════════════════
# Worker management
# ═══════════════════════════════════════════
processes: list[subprocess.Popen] = []

def alive_count():
    return sum(1 for p in processes if p.poll() is None)

def kill_all_workers():
    global processes
    for p in processes:
        try:
            p.terminate()
            try: p.wait(timeout=5)
            except subprocess.TimeoutExpired:
                p.kill()
                p.wait()
        except Exception:
            pass
    processes = []
    print("[COORDINATOR] Todos los workers detenidos.")


def rescue_stale_dnis(minutos: int = 5):
    """Rescata DNIs atascados en 'en_progreso' por workers zombies."""
    try:
        r = requests.post(
            f"{BACKEND_URL}/api/bot/reset-stale",
            json={"minutos": minutos},
            headers=_api_headers,
            timeout=10,
        )
        if r.ok:
            rescatados = r.json().get("rescatados", 0)
            if rescatados > 0:
                print(f"[COORDINATOR] 🔄 {rescatados} DNIs atascados rescatados → pendiente")
        return r.ok
    except Exception as e:
        print(f"[COORDINATOR] Error rescatando DNIs: {e}")
        return False

def spawn_workers(count: int, machine_name: str):
    global processes
    kill_all_workers()

    count = max(1, min(count, 20))
    print(f"[COORDINATOR] Lanzando {count} worker(s)...")

    # Rescatar DNIs atascados del arranque anterior
    rescue_stale_dnis(minutos=1)  # 1 min — solo los realmente zombies

    for i in range(count):
        p = subprocess.Popen(
            [sys.executable, str(BOT_DIR / "worker_loop.py"),
             "--proxy", "--worker-id", str(i),
             "--machine", machine_name],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        processes.append(p)
        print(f"  Worker {i+1} PID {p.pid} (proxy #{i})")

    print(f"[COORDINATOR] {count} workers activos.\n")

def restart_dead_workers(machine_name: str):
    for i, p in enumerate(processes):
        if p.poll() is not None:
            rc = p.returncode
            print(f"[COORDINATOR] Worker {i+1} murió (exit={rc}). Reiniciando...")
            processes[i] = subprocess.Popen(
                [sys.executable, str(BOT_DIR / "worker_loop.py"),
                 "--proxy", "--worker-id", str(i),
                 "--machine", machine_name],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )

# ═══════════════════════════════════════════
# Command polling (filtrado por máquina)
# ═══════════════════════════════════════════
def poll_commands(machine_name: str):
    """Solo comandos para esta máquina o '*'."""
    data = api_get(f"/api/bot/command?maquina={machine_name}")
    if not data:
        return []
    return data.get("comandos", [])

def handle_command(cmd: dict, machine_name: str):
    comando = cmd.get("comando", "")
    params = cmd.get("parametros", {})

    if comando == "iniciar":
        workers = params.get("workers", 5)
        spawn_workers(workers, machine_name)
        return True

    if comando == "detener":
        kill_all_workers()
        print("[COORDINATOR] Workers detenidos. Esperando nuevo comando 'iniciar'...")
        return True

    return False

# ═══════════════════════════════════════════
# Heartbeat
# ═══════════════════════════════════════════
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


# ═══════════════════════════════════════════
# Main daemon
# ═══════════════════════════════════════════
def main():
    # Nombre de máquina
    machine_name = socket.gethostname()
    if "--machine-name" in sys.argv:
        idx = sys.argv.index("--machine-name")
        machine_name = sys.argv[idx + 1]

    # Workers iniciales (opcional)
    start_workers = None
    if "--workers" in sys.argv:
        idx = sys.argv.index("--workers")
        start_workers = int(sys.argv[idx + 1])

    print(f"[COORDINATOR] Máquina: {machine_name}")
    print(f"[COORDINATOR] Backend: {BACKEND_URL}")
    print(f"[COORDINATOR] Heartbeat cada {HEARTBEAT_INTERVAL}s | Comandos cada {POLL_INTERVAL}s")
    print(f"[COORDINATOR] Solo responde a comandos para '{machine_name}' o '*'")

    if start_workers:
        print(f"[COORDINATOR] Arranque directo con {start_workers} workers")
        spawn_workers(start_workers, machine_name)
    else:
        print("[COORDINATOR] Esperando comando 'iniciar' desde el front...")

    # Señales limpias
    def shutdown(sig=None, frame=None):
        print(f"\n[COORDINATOR] Señal recibida. Apagando...")
        kill_all_workers()
        print("[COORDINATOR] Daemon detenido.")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Loop principal
    last_alive = 0
    last_rescue = 0
    RESCUE_INTERVAL = 120  # cada 2 minutos
    while True:
        try:
            # Heartbeat
            send_heartbeat(machine_name)

            # Rescatar DNIs atascados periódicamente (workers zombies)
            now_ts = time.time()
            if processes and now_ts - last_rescue > RESCUE_INTERVAL:
                rescue_stale_dnis(minutos=5)
                last_rescue = now_ts

            # Poll comandos (solo los de esta máquina)
            for cmd in poll_commands(machine_name):
                ts = datetime.now().strftime("%H:%M:%S")
                print(f"[{ts}] CMD para '{machine_name}': {cmd.get('comando')} {cmd.get('parametros', {})}")
                handle_command(cmd, machine_name)

            # Reiniciar workers muertos
            if processes:
                restart_dead_workers(machine_name)

            # Mostrar estado si cambió
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
