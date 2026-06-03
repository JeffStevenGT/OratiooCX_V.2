"""
bot/pg_client.py — Cliente PostgreSQL para el Bot
===================================================
Reemplaza al supabase_client.py anterior.
Lee DNI de la cola, escribe resultados en clientes_proyectos.

USO:
    from pg_client import tomar_siguiente_dni, guardar_resultado
"""

import os
import json
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres@localhost:5433/oratioo_cx")
PROYECTO_ORANGE = 1  # ID del proyecto "orange" en tabla proyectos

# Pool simple (una conexión por worker)
_conn = None


def get_conn():
    global _conn
    if _conn is None or _conn.closed:
        _conn = psycopg2.connect(DATABASE_URL)
        _conn.autocommit = True
    return _conn


def tomar_siguiente_dni() -> tuple[str, int] | None:
    """
    Toma el siguiente DNI pendiente de la cola con FOR UPDATE SKIP LOCKED.
    Retorna (id_cliente, id_cp) o None si no hay pendientes.
    """
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            WITH tomado AS (
                SELECT cp.id, cp.id_cliente
                FROM clientes_proyectos cp
                WHERE cp.proyecto_id = %s
                  AND cp.datos->>'estado' = 'pendiente'
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            UPDATE clientes_proyectos cp
            SET datos = jsonb_set(cp.datos, '{estado}', '"en_progreso"'),
                updated_at = now()
            FROM tomado
            WHERE cp.id = tomado.id
            RETURNING cp.id_cliente, cp.id
        """, (PROYECTO_ORANGE,))
        row = cur.fetchone()
        return (row[0], row[1]) if row else None


def guardar_resultado(id_cp: int, id_cliente: str, datos: dict, estado: str = "completado"):
    """
    Guarda el resultado de la extracción en clientes_proyectos y crea registro en historial.
    """
    conn = get_conn()
    with conn.cursor() as cur:
        # Guardar datos completos
        cur.execute("""
            UPDATE clientes_proyectos
            SET datos = %s,
                ultima_extraccion = now(),
                updated_at = now()
            WHERE id = %s
        """, (json.dumps({**datos, "estado": estado}), id_cp))

        # Registrar en historial
        cur.execute("""
            INSERT INTO historial (id_cliente, tipo, proyecto_id, descripcion, datos)
            VALUES (%s, 'extraccion', %s, %s, %s)
        """, (
            id_cliente,
            PROYECTO_ORANGE,
            f"Bot extrajo {len(datos.get('lineas', []))} lineas",
            json.dumps({"estado": estado, "cima": datos.get("cima_global", False)})
        ))


def reset_cola():
    """Reinicia todos los DNIs a estado pendiente."""
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE clientes_proyectos
            SET datos = jsonb_set(datos, '{estado}', '"pendiente"'),
                updated_at = now()
            WHERE proyecto_id = %s AND datos->>'estado' != 'completado'
        """, (PROYECTO_ORANGE,))
        return cur.rowcount
