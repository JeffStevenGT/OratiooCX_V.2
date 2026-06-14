"""
main.py — Bot Pangea Orange (Oratioo CX)
===========================================
FLUJO EXACTO del proyecto de referencia Bot_Orange:
  1. Login en Pangea Orange
  2. Por cada número: buscar, extraer cabecera, líneas con pestañas
  3. Guardar resultados en JSON local

DIFERENCIA CLAVE: busca por DOCUMENTO (DNI) en vez de teléfono.
Para producción usar coordinator_loop.py + worker_loop.py que guardan vía API en PostgreSQL.
"""

import os
import sys
import time
import json
import random
from pathlib import Path
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

from browser_setup import crear_contexto_espana, proxy_aleatorio, cargar_proxies
from login import (
    manejar_cookies_flexible,
    realizar_login,
    seleccionar_marca_orange,
    abrir_nuevo_acto_comercial,
    extraer_datos_cliente,
    verificar_sesion_valida,
    LoginError,
    SessionExpiredError,
)

load_dotenv()

# ── Config ────────────────────────────────────────

ORANGE_URL = "https://pangea.orange.es/"
REINTENTOS_POR_DNI = int(os.getenv("REINTENTOS_DNI", "3"))
PAUSA_ENTRE_DNIS_MS = random.randint(2000, 4000)

LOCAL_DB_PATH = Path(__file__).parent / "resultados_local.json"


# ── Utilidades ────────────────────────────────────

def log(msg: str):
    t = time.strftime("%H:%M:%S")
    print(f"[{t}] {msg}")


def leer_dnis(archivo: str = None) -> list[str]:
    """Lee DNIs desde numeros.txt."""
    ruta = archivo or (Path(__file__).parent / "numeros.txt")
    if not ruta.exists():
        with open(ruta, "w") as f:
            f.write("# Pon aquí los DNIs, uno por línea\n")
        log(f"📝 Se creó el archivo '{ruta.name}'. Pon los DNIs allí.")
        return []
    with open(ruta, "r") as f:
        return [line.strip() for line in f if line.strip() and not line.startswith("#")]


def guardar_resultados_local(resultados: list):
    """Guarda resultados en JSON local."""
    try:
        with open(LOCAL_DB_PATH, "w", encoding="utf-8") as f:
            json.dump(resultados, f, ensure_ascii=False, indent=2)
        log(f"💾 Guardados {len(resultados)} resultados en {LOCAL_DB_PATH.name}")
    except Exception as e:
        log(f"⚠️ Error guardando local: {e}")


# ── Main ──────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Bot Pangea Orange - Oratioo CX (modo local)")
    parser.add_argument("--dnis", type=str, default=None, help="Archivo con DNIs")
    parser.add_argument("--max", type=int, default=0, help="Máximo DNIs a procesar")
    parser.add_argument("--headless", action="store_true", help="Modo headless")
    args = parser.parse_args()

    # ── Cargar DNIs ──
    dnis = leer_dnis(args.dnis)
    if args.max > 0:
        dnis = dnis[:args.max]

    if not dnis:
        log("❌ No hay DNIs para procesar. Ponlos en bot/numeros.txt")
        return

    log(f"📄 {len(dnis)} DNIs cargados")
    log("🏠 Modo LOCAL — resultados en resultados_local.json")

    # ── Cargar proxies ──
    proxies_disponibles = cargar_proxies()
    proxy_usar = proxy_aleatorio(proxies_disponibles) if proxies_disponibles else None
    if proxy_usar:
        log(f"🔌 Proxy: {proxy_usar['server']}")
    else:
        log("🔌 Sin proxy")

    # ── Iniciar navegador ──
    log("🚀 Iniciando navegador...")

    with sync_playwright() as p:
        browser, context = crear_contexto_espana(p, proxy_config=proxy_usar)

        context.set_extra_http_headers({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept-Language": "es-ES,es;q=0.9",
        })

        page = context.new_page()

        try:
            # ── Login ──
            page.goto(ORANGE_URL, timeout=90000)
            manejar_cookies_flexible(page)
            realizar_login(page)
            seleccionar_marca_orange(page)
            abrir_nuevo_acto_comercial(page)

            # ── Procesar DNIs ──
            todos_resultados = []

            for idx, dni in enumerate(dnis):
                log(f"\n{'='*50}")
                log(f"📊 CLIENTE [{idx+1}/{len(dnis)}]: {dni}")
                log(f"{'='*50}")

                # Pausa aleatoria entre DNIs
                page.wait_for_timeout(random.randint(2000, 4000))

                # Extraer datos del cliente (buscando por DNI)
                filas_cliente = extraer_datos_cliente(page, dni, buscar_por_dni=True)

                if not filas_cliente:
                    log(f"  ⚠️  {dni} sin resultados — saltando")
                    continue

                todos_resultados.extend(filas_cliente)

                no_cliente = any(
                    f.get("Nombre") == "NO ES CLIENTE" for f in filas_cliente
                )
                if no_cliente:
                    log(f"  ⏭️  {dni} no es cliente — guardando registro")

                log(f"✅ {len(filas_cliente)} líneas extraídas")

                # Guardar incremental
                guardar_resultados_local(todos_resultados)

                # Resumen parcial (solo datos válidos)
                filas_validas = [
                    f for f in filas_cliente
                    if f.get("Nombre") != "NO ES CLIENTE"
                ]
                lineas_con_cima = sum(
                    1 for f in filas_validas if f.get("es_cima")
                )
                lineas_con_rm = sum(
                    1 for f in filas_validas if f.get("tiene_renove_mixto")
                )
                log(f"  🟢 CIMA: {lineas_con_cima} | ⭐ Renove Mixto: {lineas_con_rm}")

            # ── Resumen final ──
            log(f"\n{'='*50}")
            log(f"📊 RESUMEN FINAL")
            log(f"{'='*50}")
            log(f"  DNIs procesados: {len(dnis)}")
            log(f"  Total filas (líneas): {len(todos_resultados)}")

            if todos_resultados:
                total_cima = sum(1 for f in todos_resultados if f.get("es_cima"))
                total_rm = sum(1 for f in todos_resultados if f.get("tiene_renove_mixto"))
                log(f"  🟢 Líneas CIMA: {total_cima}")
                log(f"  ⭐ Líneas con Renove Mixto: {total_rm}")

            guardar_resultados_local(todos_resultados)
            log(f"\n📁 Resultados guardados en: {LOCAL_DB_PATH}")

            log(f"\n✅ EXTRACCIÓN FINALIZADA")
            input(">>> Presiona ENTER para cerrar el bot...")

        except Exception as e:
            log(f"❌ Error crítico: {e}")
            import traceback
            traceback.print_exc()
            input(">>> Bot detenido por error. Presiona ENTER...")

        finally:
            browser.close()

    log("🏁 Bot finalizado")


if __name__ == "__main__":
    main()
