"""
bot/coordinator_loop.py — Coordinator Daemon Multi-Worker (API-First)
======================================================================
Daemon que corre 24/7 y espera comandos del frontend.

Flujo:
  1. Arranca con 0 workers, en espera
  2. Polling GET /api/bot/command cada 5s
  3. "iniciar" {workers: N} → lanza N workers con proxy
  4. "detener" → mata todos los workers, sigue esperando
  5. "pausar"/"reanudar" → lo maneja cada worker individualmente
  6. Auto-reinicia workers que mueren

USO:
  python coordinator_loop.py
  python coordinator_loop.py --workers 5   # inicia con N workers sin esperar comando
"""

import os, sys, time, signal, subprocess, json, requests
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL = os.getenv("BOT_API_URL", "http://localhost:3000")
BOT_API_KEY = os.getenv("BOT_API_KEY", "oratioo-bot-internal-key")
BOT_DIR = Path(__file__).parent
POLL_INTERVAL = 5  # segundos entre polls de comandos

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

def api_post(path, data):
    try:
        r = requests.post(f"{BACKEND_URL}{path}", json=data, headers=_api_headers, timeout=10)
        return r.ok
    except Exception as e:
        print(f"[API] POST {path} error: {e}")
        return False

# ═══════════════════════════════════════════
# Worker management
# ═══════════════════════════════════════════
processes: list[subprocess.Popen] = []

def kill_all_workers():
    """Mata todos los workers activos."""
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

def spawn_workers(count: int):
    """Lanza N workers con proxy."""
    global processes
    kill_all_workers()  # mata los que haya antes de lanzar nuevos

    count = max(1, min(count, 20))
    print(f"[COORDINATOR] Lanzando {count} worker(s)...")

    for i in range(count):
        p = subprocess.Popen(
            [sys.executable, str(BOT_DIR / "worker_loop.py"), "--proxy", "--worker-id", str(i)],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        processes.append(p)
        print(f"  Worker {i+1} PID {p.pid} (proxy #{i})")

    print(f"[COORDINATOR] {count} workers activos.\n")

def restart_dead_workers():
    """Reinicia workers que murieron inesperadamente."""
    for i, p in enumerate(processes):
        if p.poll() is not None:
            rc = p.returncode
            print(f"[COORDINATOR] Worker {i+1} murió (exit={rc}). Reiniciando...")
            processes[i] = subprocess.Popen(
                [sys.executable, str(BOT_DIR / "worker_loop.py"), "--proxy", "--worker-id", str(i)],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )

# ═══════════════════════════════════════════
# Command polling
# ═══════════════════════════════════════════
def poll_commands():
    """Consulta comandos nuevos del backend."""
    data = api_get("/api/bot/command")
    if not data:
        return []

    comandos = data.get("comandos", [])
    return comandos  # [{comando: "iniciar", parametros: {workers: 5}}, ...]

def handle_command(cmd: dict):
    """Procesa un comando del frontend."""
    comando = cmd.get("comando", "")
    params = cmd.get("parametros", {})

    if comando == "iniciar":
        workers = params.get("workers", 5)
        spawn_workers(workers)
        return True

    if comando == "detener":
        kill_all_workers()
        print("[COORDINATOR] Workers detenidos. Esperando nuevo comando 'iniciar'...")
        return True

    # pausar y reanudar — los workers los manejan individualmente
    # los ignoramos aquí para que cada worker lo vea en su propio poll
    return False


# ═══════════════════════════════════════════
# Main daemon
# ═══════════════════════════════════════════
def main():
    # Soporte para arranque directo con --workers N
    start_workers = None
    if "--workers" in sys.argv:
        idx = sys.argv.index("--workers")
        start_workers = int(sys.argv[idx + 1])

    print(f"[COORDINATOR] Daemon iniciado — Backend: {BACKEND_URL}")
    print(f"[COORDINATOR] Polling comandos cada {POLL_INTERVAL}s")

    if start_workers:
        print(f"[COORDINATOR] Arranque directo con {start_workers} workers")
        spawn_workers(start_workers)
    else:
        print("[COORDINATOR] Esperando comando 'iniciar' desde el frontend...")
        print("[COORDINATOR]   Ejemplo: python coordinator_loop.py --workers 5 para arranque directo")

    # Señales limpias
    def shutdown(sig=None, frame=None):
        print(f"\n[COORDINATOR] Señal recibida. Apagando...")
        kill_all_workers()
        print("[COORDINATOR] Daemon detenido.")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Loop principal
    last_count = len(processes)
    while True:
        try:
            # Poll comandos
            for cmd in poll_commands():
                ts = datetime.now().strftime("%H:%M:%S")
                print(f"[{ts}] CMD recibido: {cmd.get('comando')} {cmd.get('parametros', {})}")
                handle_command(cmd)

            # Reiniciar workers muertos
            if processes:
                restart_dead_workers()

            # Mostrar estado si cambió
            current = len(processes)
            alive = sum(1 for p in processes if p.poll() is None)
            if current != last_count or (processes and alive != last_count):
                print(f"[COORDINATOR] Workers: {alive}/{current} vivos")
                last_count = alive if processes else 0

            time.sleep(POLL_INTERVAL)

        except KeyboardInterrupt:
            shutdown()
        except Exception as e:
            print(f"[COORDINATOR] Error: {e}")
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
