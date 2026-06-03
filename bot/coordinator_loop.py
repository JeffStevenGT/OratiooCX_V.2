"""
bot/coordinator_loop.py — Coordinator Multi-Worker (API-First)
===============================================================
Lanza N workers como procesos separados, cada uno con su proxy.
Todos los workers hablan con el mismo backend de Next.js.

USO:
  python coordinator_loop.py --workers 5
"""

import sys, time, subprocess
from pathlib import Path

def main():
    num_workers = 1
    if "--workers" in sys.argv:
        idx = sys.argv.index("--workers")
        num_workers = int(sys.argv[idx + 1])

    num_workers = max(1, min(num_workers, 20))
    print(f"[COORDINATOR] Lanzando {num_workers} worker(s)...")

    processes = []
    for i in range(num_workers):
        p = subprocess.Popen(
            [sys.executable, str(Path(__file__).parent / "worker_loop.py"), "--proxy"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        processes.append(p)
        print(f"  Worker {i+1} PID {p.pid}")

    print(f"\n[COORDINATOR] {num_workers} workers activos. Ctrl+C para detener.\n")

    try:
        while True:
            time.sleep(10)
            for i, p in enumerate(processes):
                if p.poll() is not None:
                    print(f"  Worker {i+1} se detuvo. Reiniciando...")
                    processes[i] = subprocess.Popen(
                        [sys.executable, str(Path(__file__).parent / "worker_loop.py"), "--proxy"],
                        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
                    )
    except KeyboardInterrupt:
        print("\n[COORDINATOR] Deteniendo workers...")
        for p in processes:
            p.terminate()
            p.wait()
        print("[COORDINATOR] Todos detenidos.")


if __name__ == "__main__":
    main()
