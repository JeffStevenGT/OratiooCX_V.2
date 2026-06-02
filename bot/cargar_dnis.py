"""
cargar_dnis.py — Inserta DNIs desde numeros.txt a Supabase
============================================================
Uso: python cargar_dnis.py [--reset]

Lee numeros.txt, extrae DNIs válidos y los inserta en la tabla lineas
con estado 'pendiente' para que el bot los procese.

--reset: Borra TODOS los registros de lineas antes de insertar
"""

import os
import sys
import json
import re
from pathlib import Path
from dotenv import load_dotenv
import requests

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
NUMEROS_FILE = Path(__file__).parent / "numeros.txt"


def extraer_dnis(texto):
    dnis = set()
    for linea in texto.split("\n"):
        linea = linea.strip()
        if not linea or linea.startswith("#"):
            continue
        # Remover BOM, comillas, espacios
        limpio = linea.replace("\ufeff", "").replace('"', "").replace("'", "").strip()
        if not limpio:
            continue
        # Si es CSV con comas, separar
        if "," in limpio:
            for cell in limpio.split(","):
                cell = cell.strip()
                if len(cell) >= 6:
                    dnis.add(cell.upper())
        else:
            if len(limpio) >= 6:
                dnis.add(limpio.upper())
    return list(dnis)


def reset_tabla():
    """Borra todos los registros de lineas"""
    url = f"{SUPABASE_URL}/rest/v1/lineas"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    r = requests.delete(url, headers=headers)
    if r.status_code == 200 or r.status_code == 204:
        print(f"  [OK] Tabla lineas limpiada")
    else:
        print(f"  [WARN] No se pudo limpiar (puede que ya esté vacía): {r.status_code}")


def insertar_dnis(dnis):
    url = f"{SUPABASE_URL}/rest/v1/lineas"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    total = len(dnis)
    insertados = 0
    errores = 0

    # Insertar en batches de 500
    for i in range(0, total, 500):
        batch = dnis[i : i + 500]
        rows = []
        for dni in batch:
            rows.append(
                {
                    "dni": dni,
                    "nombre": "N/A",
                    "atributos_dinamicos": {
                        "estado": "pendiente",
                        "datos_basicos": {"nombre": "N/A"},
                        "pipeline": {"estado": "pendiente", "asesor_id": None, "notas": ""},
                    },
                }
            )

        r = requests.post(url, headers=headers, json=rows)
        if r.status_code in (200, 201, 204):
            insertados += len(batch)
        else:
            print(f"  [ERROR] Batch {i//500 + 1}: {r.status_code} {r.text[:200]}")
            errores += len(batch)

        print(f"  {i + len(batch)}/{total} insertados...")

    return insertados, errores


def main():
    reset = "--reset" in sys.argv

    if not NUMEROS_FILE.exists():
        print(f"[ERROR] No existe {NUMEROS_FILE}")
        print("Crea el archivo con los DNIs (uno por línea) y ejecuta de nuevo.")
        sys.exit(1)

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[ERROR] Faltan SUPABASE_URL y SUPABASE_KEY en .env")
        sys.exit(1)

    texto = NUMEROS_FILE.read_text(encoding="utf-8")
    dnis = extraer_dnis(texto)

    if not dnis:
        print("[ERROR] No se encontraron DNIs válidos en numeros.txt")
        sys.exit(1)

    print(f"\nDNIs encontrados: {len(dnis)}")
    print(f"Primeros 5: {dnis[:5]}")
    print(f"Últimos 5: {dnis[-5:]}")
    print()

    if reset:
        print("Limpiando tabla lineas...")
        reset_tabla()

    print("Insertando DNIs en Supabase...")
    insertados, errores = insertar_dnis(dnis)

    print(f"\n[RESUMEN]")
    print(f"  Total DNIs: {len(dnis)}")
    print(f"  Insertados: {insertados}")
    print(f"  Errores:    {errores}")
    print(f"\nListo. Ejecuta 'python coordinator.py' para iniciar el bot.")


if __name__ == "__main__":
    main()
