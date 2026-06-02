"""
bot/watchdog.py — Watchdog Timer para Workers de Playwright
=============================================================
Previene que un worker se cuelgue indefinidamente si un selector
no aparece o hay un error silencioso de protocolo.

USO:
    from watchdog import Watchdog

    with Watchdog(worker_id, timeout=40):  # 40s máximo por tarea
        procesar_dni(page, dni)
"""

import threading
import time
import signal
import os
import sys

class WatchdogTimeout(Exception):
    """El worker excedió el tiempo máximo de ejecución."""
    pass


class Watchdog:
    """
    Context manager que mata la tarea si excede el timeout.
    En Windows usa threading (no fork). En Linux usa SIGALRM.

    Uso:
        with Watchdog("worker_1", timeout=40):
            extraer_datos_cliente(page, dni)
    """

    def __init__(self, worker_id: str, timeout: int = 40):
        self.worker_id = worker_id
        self.timeout = timeout
        self._timer = None
        self._timed_out = False

    def _on_timeout(self):
        """Se ejecuta cuando el timer expira."""
        self._timed_out = True
        print(f"  ⏰ [Watchdog] Worker {self.worker_id}: TIMEOUT después de {self.timeout}s")
        # En Windows: forzar interrupción vía thread
        # En Linux: SIGALRM
        if sys.platform == "win32":
            # Windows: interrumpir el hilo principal
            thread_id = threading.current_thread().ident
            if thread_id:
                import ctypes
                ctypes.pythonapi.PyThreadState_SetAsyncExc(
                    ctypes.c_long(thread_id),
                    ctypes.py_object(WatchdogTimeout)
                )
        else:
            os.kill(os.getpid(), signal.SIGALRM)

    def __enter__(self):
        self._timed_out = False
        self._timer = threading.Timer(self.timeout, self._on_timeout)
        self._timer.daemon = True
        self._timer.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._timer:
            self._timer.cancel()
            self._timer = None

        if self._timed_out:
            print(f"  🔴 [Watchdog] Worker {self.worker_id}: ABORTADO por timeout")
            return False  # Re-raise la excepción

        if exc_type == WatchdogTimeout:
            print(f"  🔴 [Watchdog] Worker {self.worker_id}: WatchdogTimeout capturado")
            return True  # Suprimir la excepción, worker sigue

        return False  # Dejar que otras excepciones se propaguen


# ── Versión simple para tareas individuales ─────
def with_timeout(worker_id: str, timeout: int = 40):
    """Decorador para funciones que necesitan watchdog."""
    def decorator(func):
        def wrapper(*args, **kwargs):
            with Watchdog(worker_id, timeout):
                return func(*args, **kwargs)
        return wrapper
    return decorator
