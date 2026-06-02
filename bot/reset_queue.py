"""
reset_queue.py ÔÇö Limpia la cola y el historial de cargas
==========================================================
Borra TODOS los registros de lineas y documentos en Supabase.
NO recarga nada ÔÇö los DNIs se suben desde la web.

USO:
  python reset_queue.py              # Reset completo
  python reset_queue.py --dry-run    # Solo mostrar qu├® har├¡a
"""

import os
import sys
import json
import time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
BASE = f"{SUPABASE_URL}/rest/v1"
HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}


def log(msg):
    t = time.strftime("%H:%M:%S")
    print(f"[{t}] {msg}")


def _api(method, path, body=None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body else None
    req = Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else []
    except HTTPError as e:
        err = e.read().decode()[:200] if e.fp else str(e)
        log(f"  API ERROR {method} {path} -> {e.code}: {err}")
        return []
    except Exception as e:
        log(f"  API ERROR: {e}")
        return []


def reset(dry_run: bool = False):
    """Limpia lineas y documentos. No recarga nada."""
    if dry_run:
        log("[DRY-RUN] Se borrar├¡an lineas y documentos")
        return

    # Borrar lineas
    log("Borrando tabla lineas...")
    _api("DELETE", "/lineas?id=gte.0")
    log("  OK")

    # Borrar documentos
    log("Borrando historial de cargas...")
    _api("DELETE", "/documentos?id=gte.0")
    log("  OK")

    log("Reset completado")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Resetear cola de Supabase")
    parser.add_argument("--dry-run", action="store_true", help="No ejecutar, solo mostrar")
    args = parser.parse_args()

    log("=== RESET QUEUE ===")
    reset(dry_run=args.dry_run)
    log("=== FIN ===")
