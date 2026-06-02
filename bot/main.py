"""
main.py — Bot Pangea Orange (Oratioo CX)
===========================================
FLUJO EXACTO del proyecto de referencia Bot_Orange:
  1. Login en Pangea Orange
  2. Por cada número: buscar, extraer cabecera, líneas con pestañas
  3. Guardar en Supabase (o local para prueba)

DIFERENCIA CLAVE: busca por DOCUMENTO (DNI) en vez de teléfono.
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
USE_SUPABASE = os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_KEY")
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


def guardar_en_supabase(resultados: list):
    """Guarda cada fila de resultados en Supabase."""
    try:
        from supabase_client import guardar_resultado
        for fila in resultados:
            dni = fila.get("DNI", fila.get("Linea", "N/A"))
            es_cima = fila.get("es_cima", False)

            # ── Detectar si NO ES CLIENTE ──
            no_cliente = fila.get("Nombre", "") == "NO ES CLIENTE"

            if no_cliente:
                # Guardar con estado especial
                datos = {
                    "nombre": "NO ES CLIENTE",
                    "linea_principal": dni,
                    "paquete": "N/A",
                    "atributos_dinamicos": {
                        "estado": "no_cliente",
                        "datos_basicos": {"dni": dni},
                        "cima": "NO",
                        "renove_mixto_variante": "N/A",
                        "renove_mixto_todas": "N/A",
                        "linea": {
                            "numero": dni,
                            "es_cima": False,
                            "tiene_renove_mixto": False,
                            "etiquetas": [],
                            "es_principal": False,
                            "activo_desde": "N/A",
                            "tiene_tv": False,
                        },
                    },
                }
                guardar_resultado(dni, datos, estado="no_cliente")
            else:
                # Empaquetar atributos dinámicos
                dinamicos = {
                    "cima": "SI" if es_cima else "NO",
                    "tiene_renove_mixto": fila.get("tiene_renove_mixto", False),
                    "renove_mixto_variante": fila.get("variante_renove", "N/A"),
                    "renove_mixto_todas": fila.get("variante_renove", "N/A"),
                    "tipo_renove": fila.get("variante_renove", "N/A"),
                    "estado": "completado",
                    "cima_tags": fila.get("tiene_tv", False) and "TV" or "N/A",
                    "etiquetas": fila.get("etiquetas", []),
                    "es_principal": fila.get("es_principal", False),
                    "activo_desde": fila.get("activo_desde", "N/A"),
                    "datos_basicos": {
                        "nombre": fila.get("Nombre", "N/A"),
                        "direccion": fila.get("Direccion", "N/A"),
                        "seg_fijo": fila.get("Seg Fijo", "N/A"),
                        "seg_movil": fila.get("Seg Movil", "N/A"),
                        "dni": dni,
                    },
                    "linea": {
                        "linea_principal": fila.get("Linea", "N/A"),
                        "numero": fila.get("Linea", "N/A"),
                        "paquete": fila.get("Paquete", "N/A"),
                        "es_cima": es_cima,
                        "tiene_renove_mixto": fila.get("tiene_renove_mixto", False),
                        "variante_renove": fila.get("variante_renove", "N/A"),
                        "tiene_tv": fila.get("tiene_tv", False),
                        "es_principal": fila.get("es_principal", False),
                        "etiquetas": fila.get("etiquetas", []),
                        "activo_desde": fila.get("activo_desde", "N/A"),
                    },
                    "pestanas": {
                        "Destacadas": fila.get("Destacadas", "N/A"),
                        "Renove": fila.get("Renove", "N/A"),
                        "Bonos y D.": fila.get("Bonos y D.", "N/A"),
                        "Cambio Tarifa": fila.get("Cambio Tarifa", "N/A"),
                        "SVA": fila.get("SVA", "N/A"),
                    },
                }

                datos = {
                    "nombre": fila.get("Nombre", "N/A"),
                    "direccion": fila.get("Direccion", "N/A"),
                    "linea_principal": fila.get("Linea", "N/A"),
                    "seg_fijo": fila.get("Seg Fijo", "N/A"),
                    "seg_movil": fila.get("Seg Movil", "N/A"),
                    "paquete": fila.get("Paquete", "N/A"),
                    "atributos_dinamicos": dinamicos,
                }

                guardar_resultado(dni, datos, estado="completado")

        log(f"☁️  {len(resultados)} filas guardadas en Supabase")
    except Exception as e:
        log(f"⚠️ Error guardando en Supabase: {e}")


# ── Main ──────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Bot Pangea Orange - Oratioo CX")
    parser.add_argument("--local", action="store_true", help="Modo prueba sin Supabase")
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
    if args.local:
        log("🏠 Modo LOCAL (sin Supabase)")
    elif USE_SUPABASE:
        log("☁️  Modo SUPABASE")
    else:
        log("⚠️  Sin Supabase configurado. Usando --local implícito.")

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

                # Pausa aleatoria entre DNIs (como en el referencia)
                page.wait_for_timeout(random.randint(2000, 4000))

                # Extraer datos del cliente (buscando por DNI)
                filas_cliente = extraer_datos_cliente(page, dni, buscar_por_dni=True)

                if not filas_cliente:
                    log(f"  ⚠️  {dni} sin resultados — saltando")
                    continue

                # Guardar TODOS los resultados (clientes válidos + no_clientes)
                todos_resultados.extend(filas_cliente)

                no_cliente = any(
                    f.get("Nombre") == "NO ES CLIENTE" for f in filas_cliente
                )
                if no_cliente:
                    log(f"  ⏭️  {dni} no es cliente — guardando registro")

                log(f"✅ {len(filas_cliente)} líneas extraídas")

                # Guardar según modo
                if args.local or not USE_SUPABASE:
                    guardar_resultados_local(todos_resultados)
                else:
                    guardar_en_supabase(filas_cliente)

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

            if args.local or not USE_SUPABASE:
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
