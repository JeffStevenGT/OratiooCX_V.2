"""
bot/worker_structured.py — Worker que extrae TODO de Orange
============================================================
Versión mejorada del worker original. Extrae datos completos y los
guarda en JSONB estructurado en PostgreSQL.

Para testear: python worker_structured.py --dni 12345678A
"""

import sys, time, re, json
from pathlib import Path
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))
from browser_setup import crear_contexto_espana
from login import (
    extraer_datos_cliente, realizar_login, seleccionar_marca_orange,
    abrir_nuevo_acto_comercial, manejar_cookies_flexible
)
from pg_client import guardar_resultado

load_dotenv()
ORANGE_URL = "https://pangea.orange.es/"


def extraer_datos_estructurados(page, dni):
    """
    Usa extraer_datos_cliente (probado) y EXTRAE datos adicionales
    no capturados por la función original.
    """
    # 1. Extracción básica (la función existente de master)
    lineas_basicas = extraer_datos_cliente(page, dni)

    if not lineas_basicas:
        return {"estado": "error", "error": "sin_datos"}

    primera = lineas_basicas[0]
    if primera.get("Nombre") == "NO ES CLIENTE":
        return {"estado": "no_cliente"}

    # 2. Estructurar datos de cabecera
    header = {
        "nombre": primera.get("Nombre", "N/A"),
        "dni": primera.get("DNI", dni),
        "direccion": primera.get("Direccion", "N/A"),
        "paquete": primera.get("Paquete", "N/A"),
    }

    # 3. Determinar CIMA global
    cima_global = any(l.get("es_cima") for l in lineas_basicas)

    # 4. Extraer líneas con detalle adicional
    lineas_detalladas = []
    for lb in lineas_basicas:
        linea = {
            "numero": lb.get("Linea", "N/A"),
            "etiquetas": lb.get("etiquetas", []),
            "es_cima": lb.get("es_cima", False),
            "tiene_renove": lb.get("tiene_renove_mixto", False),
            "variante_renove": lb.get("variante_renove", "N/A"),
            "tiene_tv": lb.get("tiene_tv", False),
            "es_principal": lb.get("es_principal", False),
            "activo_desde": lb.get("activo_desde", "N/A"),
        }

        # Extraer detalles adicionales de la línea desde la página
        try:
            bloque = page.locator(f".client-tariff-flex:has-text('{linea['numero']}')")
            if bloque.count() > 0:
                b = bloque.first
                # Estado de línea
                try:
                    status = b.locator("ocs-line-status").inner_text().strip()
                    linea["estado"] = parse_estado_linea(status)
                except:
                    linea["estado"] = {}

                # Consumo y permanencia
                try:
                    details = b.locator("ocs-line-details").inner_text().strip()
                    linea["consumo"] = extraer_campo(details, r'Consumo\s+([^\n]+)')
                    linea["permanencia"] = extraer_campo(details, r'Permanencia\s+([^\n]+)')
                    linea["vap"] = extraer_campo(details, r'Venta a Plazos\s*\n?\s*([^\n]+)')
                except:
                    pass

                # Pestañas comerciales
                try:
                    tab_bar = b.locator(".client-tariff-section-navs")
                    if tab_bar.count() > 0:
                        tabs = tab_bar.locator("button.Title")
                        pestanas = {}
                        for t_idx in range(tabs.count()):
                            try:
                                nombre = tabs.nth(t_idx).inner_text().strip()
                                tabs.nth(t_idx).click(timeout=5000)
                                time.sleep(0.4)
                                cards_c = b.locator(".client-tariff-section-cards")
                                if cards_c.count() > 0:
                                    cards = cards_c.locator("> div")
                                    contenido = []
                                    for c_idx in range(cards.count()):
                                        try:
                                            contenido.append(cards.nth(c_idx).inner_text().strip())
                                        except:
                                            pass
                                    if contenido:
                                        pestanas[nombre.lower().replace(" ", "_")] = contenido
                            except:
                                pass
                        if pestanas:
                            linea["pestanas"] = pestanas
                except:
                    pass
        except:
            pass

        lineas_detalladas.append(linea)

    # 5. Extraer secciones inferiores
    secciones = {}
    for nombre, selector in [
        ("permanencias_vap", ".mod-permanency-chart"),
        ("descuentos", ".mod-promotions-and-discounts"),
        ("facturas", ".mod-invoice-histogram-main"),
        ("consumo_grupo", "group-consumption-fed"),
    ]:
        try:
            txt = page.locator(selector).inner_text().strip()
            if txt:
                secciones[nombre] = txt[:1000]
        except:
            pass

    return {
        "estado": "completado",
        "header": header,
        "lineas": lineas_detalladas,
        "cima_global": cima_global,
        "secciones_extra": secciones,
    }


def parse_estado_linea(texto):
    """Parsea el estado de línea (Hotline, Suspendida, etc)."""
    return {
        "hotline": "Hotline" in texto,
        "suspendida": "Suspendida" in texto,
        "impago": "Impago" in texto,
        "fraude": "Fraude" in texto,
    }


def extraer_campo(texto, patron):
    """Extrae un campo con regex del texto de detalles."""
    m = re.search(patron, texto)
    return m.group(1).strip() if m else "N/A"


# ── Prueba individual ──
def test_single(dni):
    """Procesa un solo DNI para testing."""
    proxies = []
    prox_file = Path(__file__).parent / "proxies.txt"
    if prox_file.exists():
        for l in prox_file.read_text().split("\n"):
            l = l.strip()
            if l and not l.startswith("#"):
                p = l.split(":")
                if len(p) == 4:
                    proxies.append({"server": f"http://{p[0]}:{p[1]}", "username": p[2], "password": p[3]})

    proxy_conf = proxies[0] if proxies else None
    pw = sync_playwright().start()
    browser, context = crear_contexto_espana(pw, proxy_config=proxy_conf)
    page = context.new_page()

    print(f"[TEST] Login Orange...")
    page.goto(ORANGE_URL, timeout=90000)
    manejar_cookies_flexible(page)
    realizar_login(page)
    seleccionar_marca_orange(page)
    abrir_nuevo_acto_comercial(page)
    print("[TEST] Login OK")

    print(f"[TEST] Extrayendo DNI {dni}...")
    datos = extraer_datos_estructurados(page, dni)
    print(json.dumps(datos, indent=2, ensure_ascii=False)[:2000])

    browser.close()
    pw.stop()


if __name__ == "__main__":
    if "--dni" in sys.argv:
        idx = sys.argv.index("--dni")
        test_single(sys.argv[idx + 1])
    else:
        print("Uso: python worker_structured.py --dni 12345678A")
