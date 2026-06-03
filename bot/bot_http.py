"""
bot/bot_http.py — Cliente HTTP del Bot (API-First)
====================================================
El bot NO toca PostgreSQL. Solo hace POST al endpoint interno de Next.js.
Más rápido, más seguro, desacoplado.
"""

import os
import json
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

API_URL = os.getenv("BOT_API_URL", "http://localhost:3000/api/internal/bot-sync")
BOT_API_KEY = os.getenv("BOT_API_KEY", "oratioo-bot-internal-key")


def sync_resultado(id_cliente: str, datos: dict, proyecto_id: int = 1, estado: str = "completado") -> bool:
    """
    Envía el resultado de la extracción al backend de Next.js.
    Retorna True si se guardó correctamente.
    """
    try:
        r = requests.post(
            API_URL,
            json={
                "id_cliente": id_cliente,
                "proyecto_id": proyecto_id,
                "datos": datos,
                "estado": estado,
            },
            headers={
                "Content-Type": "application/json",
                "x-bot-api-key": BOT_API_KEY,
            },
            timeout=15,
        )
        if r.status_code == 200:
            return True
        print(f"[HTTP] Error {r.status_code}: {r.text[:200]}")
        return False
    except requests.exceptions.Timeout:
        print("[HTTP] Timeout - el backend no respondió")
        return False
    except Exception as e:
        print(f"[HTTP] Error: {e}")
        return False


def sync_no_cliente(id_cliente: str, proyecto_id: int = 1) -> bool:
    """Registra un DNI como no cliente."""
    return sync_resultado(id_cliente, {"estado": "no_cliente"}, proyecto_id, "no_cliente")
