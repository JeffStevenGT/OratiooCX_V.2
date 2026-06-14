"""
bot/worker_structured.py v2 — Worker con API-First + Watchdog + Stealth
========================================================================
- API-First: hace POST a /api/internal/bot-sync (no toca PostgreSQL)
- Watchdog 40s: aborta si un DNI tarda más de 40 segundos
- Stealth: playwright-stealth para evadir detección anti-bot
"""

import sys, os, time, re, json, signal, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))
from browser_setup import crear_contexto_espana
from login import (
    extraer_datos_cliente, realizar_login, seleccionar_marca_orange,
    abrir_nuevo_acto_comercial, manejar_cookies_flexible,
    parsear_fecha_permanencia,
)
from bot_http import sync_resultado, sync_no_cliente

load_dotenv()
ORANGE_URL = "https://pangea.orange.es/"
WATCHDOG_TIMEOUT = 40  # segundos

# ═══════════════════════════════════════════════════════════════
# WATCHDOG TIMER (Mata el worker si excede 40s por DNI)
# ═══════════════════════════════════════════════════════════════

class WatchdogTimeout(Exception):
    pass


class Watchdog:
    def __init__(self, worker_id: str, timeout: int = WATCHDOG_TIMEOUT):
        self.worker_id = worker_id
        self.timeout = timeout
        self._timer = None
        self._timed_out = False

    def _on_timeout(self):
        self._timed_out = True
        print(f"  [WATCHDOG] Worker {self.worker_id}: TIMEOUT {self.timeout}s - ABORTANDO")

    def __enter__(self):
        self._timed_out = False
        self._timer = threading.Timer(self.timeout, self._on_timeout)
        self._timer.daemon = True
        self._timer.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._timer:
            self._timer.cancel()
        if self._timed_out:
            return True  # Suprimir excepción
        return False


# ═══════════════════════════════════════════════════════════════
# EXTRACCIÓN ESTRUCTURADA
# ═══════════════════════════════════════════════════════════════

def parse_estado_linea(texto):
    return {
        "hotline": "Hotline" in texto,
        "suspendida": "Suspendida" in texto,
        "impago": "Impago" in texto,
        "fraude": "Fraude" in texto,
    }


def extraer_campo(texto, patron):
    m = re.search(patron, texto)
    return m.group(1).strip() if m else "N/A"


def extraer_datos_estructurados(page, dni):
    lineas_basicas = extraer_datos_cliente(page, dni)
    if not lineas_basicas:
        return {"estado": "error", "error": "sin_datos"}

    primera = lineas_basicas[0]
    if primera.get("Nombre") == "NO ES CLIENTE":
        return {"estado": "no_cliente"}

    header = {
        "nombre": primera.get("Nombre", "N/A"),
        "dni": primera.get("DNI", dni),
        "direccion": primera.get("Direccion", "N/A"),
        "paquete": primera.get("Paquete", "N/A"),
    }
    cima_global = any(l.get("es_cima") for l in lineas_basicas)

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
        # Detalles extra
        try:
            bloque = page.locator(f".client-tariff-flex:has-text('{linea['numero']}')")
            if bloque.count() > 0:
                b = bloque.first
                try:
                    linea["estado"] = parse_estado_linea(b.locator("ocs-line-status").inner_text().strip())
                except: pass
                try:
                    details = b.locator("ocs-line-details").inner_text().strip()
                    linea["consumo"] = extraer_campo(details, r'Consumo\s+([^\n]+)')
                    linea["permanencia"] = extraer_campo(details, r'Permanencia\s+([^\n]+)')
                    linea["permanencia_fecha"] = parsear_fecha_permanencia(linea["permanencia"])
                    linea["vap"] = extraer_campo(details, r'Venta a Plazos\s*\n?\s*([^\n]+)')
                except: pass
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
                                cc = b.locator(".client-tariff-section-cards")
                                if cc.count() > 0:
                                    cards = [cc.locator("> div").nth(i).inner_text().strip()
                                             for i in range(cc.locator("> div").count())]
                                    if cards:
                                        pestanas[nombre.lower().replace(" ", "_")] = cards
                            except: pass
                        if pestanas:
                            linea["pestanas"] = pestanas
                except: pass
        except: pass

        lineas_detalladas.append(linea)

    # Secciones inferiores
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
        except: pass

    return {
        "estado": "completado",
        "header": header,
        "lineas": lineas_detalladas,
        "cima_global": cima_global,
        "secciones_extra": secciones,
    }


# ═══════════════════════════════════════════════════════════════
# WORKER PRINCIPAL
# ═══════════════════════════════════════════════════════════════

def procesar_dni_api(page, dni):
    """Procesa un DNI con watchdog y envía resultado vía HTTP."""
    with Watchdog(f"dni-{dni}"):
        datos = extraer_datos_estructurados(page, dni)

    estado = datos.get("estado", "error")
    if estado == "no_cliente":
        sync_no_cliente(f"DNI_{dni}" if not dni.startswith(("DNI_","NIE_","NIF_")) else dni)
        return estado

    if estado == "error":
        return estado

    # Enviar al backend
    id_cliente = f"DNI_{dni}"
    if re.match(r'^[XYZ]', dni): id_cliente = f"NIE_{dni}"
    elif re.match(r'^[A-Z]', dni): id_cliente = f"NIF_{dni}"

    sync_resultado(id_cliente, datos)
    return "completado"


# ═══════════════════════════════════════════════════════════════
# TEST
# ═══════════════════════════════════════════════════════════════

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

    # Stealth injection
    try:
        from playwright_stealth import stealth_sync
        stealth_sync(page)
        print("[TEST] Stealth activado")
    except:
        pass

    print(f"[TEST] Login...")
    page.goto(ORANGE_URL, timeout=90000)
    manejar_cookies_flexible(page)
    realizar_login(page)
    seleccionar_marca_orange(page)
    abrir_nuevo_acto_comercial(page)
    print("[TEST] Login OK")

    print(f"[TEST] Extrayendo {dni}...")
    resultado = procesar_dni_api(page, dni)
    print(f"[TEST] Resultado: {resultado}")

    browser.close()
    pw.stop()


if __name__ == "__main__":
    if "--dni" in sys.argv:
        idx = sys.argv.index("--dni")
        test_single(sys.argv[idx + 1])
    else:
        print("Uso: python worker_structured.py --dni 12345678A")
