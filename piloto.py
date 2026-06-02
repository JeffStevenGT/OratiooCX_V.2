"""
piloto.py — Bot de prueba para analizar estructura de Orange Pangea
===================================================================
Lee DNIs de numeros.txt, navega Orange Pangea y loguea TODO el
contenido de cada pestaña de cada línea para su posterior análisis.

USO:
  1. Crear proyecto nuevo en Supabase (cuando toque)
  2. Poner credenciales en .env (solo ORANGE_USER + ORANGE_PASS)
  3. Poner DNIs en numeros.txt (uno por línea)
  4. pip install -r requirements.txt
  5. python piloto.py

NO guarda nada en BD. Solo genera piloto_logs.txt con el análisis.
"""

import os, re, sys, time, random, json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ── Log a archivo ──
_LOG = Path(__file__).parent / "piloto_logs.txt"
_fh = open(_LOG, "w", encoding="utf-8")

def log(msg=""):
    print(msg)
    _fh.write(msg + "\n")
    _fh.flush()


# ── Utilidades ──
def extraer_dnis(texto):
    dnis = []
    for linea in texto.split("\n"):
        l = linea.strip()
        if not l or l.startswith("#"):
            continue
        l = l.replace("\ufeff", "").replace('"', "").replace("'", "").strip()
        if not l:
            continue
        if "," in l:
            for c in l.split(","):
                c = c.strip()
                if len(c) >= 6:
                    dnis.append(c.upper())
        elif len(l) >= 6:
            dnis.append(l.upper())
    return dnis


# ═══════════════════════════════════════════════════════════════
#  PLAYWRIGHT - NAVEGACIÓN ORANGE
# ═══════════════════════════════════════════════════════════════

def cargar_proxies():
    """Carga proxies de proxies.txt."""
    prox_file = Path(__file__).parent / "proxies.txt"
    if not prox_file.exists():
        log("[PROXY] No hay proxies.txt — sin proxy")
        return []
    proxies = []
    for linea in prox_file.read_text(encoding="utf-8").split("\n"):
        l = linea.strip()
        if not l or l.startswith("#"):
            continue
        partes = l.split(":")
        if len(partes) == 4:
            ip, puerto, user, pwd = partes
            proxy_url = f"http://{user}:{pwd}@{ip}:{puerto}"
            proxies.append(proxy_url)
        elif len(partes) == 2:
            proxy_url = f"http://{partes[0]}:{partes[1]}"
            proxies.append(proxy_url)
    log(f"[PROXY] {len(proxies)} proxy(es) cargados")
    return proxies


def iniciar_navegador(proxy_url=None):
    from playwright.sync_api import sync_playwright
    p = sync_playwright().start()
    launch_kwargs = {"headless": False}
    if proxy_url:
        launch_kwargs["proxy"] = {"server": proxy_url}
        log(f"[PROXY] Usando: {proxy_url[:60]}...")
    browser = p.chromium.launch(**launch_kwargs)
    page = browser.new_page(viewport={"width": 1366, "height": 768})
    return p, browser, page


def login_orange(page):
    usuario = os.getenv("ORANGE_USER")
    password = os.getenv("ORANGE_PASS")
    if not usuario or not password:
        log("[ERROR] Faltan ORANGE_USER y ORANGE_PASS en .env")
        sys.exit(1)

    log("[LOGIN] Navegando a Pangea Orange...")
    page.goto("https://pangea.orange.es/", timeout=30000)

    # Campo usuario
    page.wait_for_selector("input[name='temp-username']", timeout=20000)
    page.fill("input[name='temp-username']", usuario)
    page.wait_for_timeout(300)

    # Campo password
    page.fill("input[name='temp-password']", password)
    page.wait_for_timeout(200)

    # Click login
    page.click("#submit-button")
    log("[LOGIN] Autenticando...")

    # Seleccionar Orange
    page.wait_for_selector("a.orange-box", timeout=30000)
    page.click("a.orange-box")
    page.wait_for_timeout(2000)

    # Esperar contenedor principal
    page.wait_for_selector("#orange-container", timeout=30000)
    log("[LOGIN] OK")

    # Nuevo acto comercial > Tarifas > Crear
    page.click("button:has-text('Nuevo acto comercial')")
    page.wait_for_timeout(1000)
    page.click("a:has-text('Tarifas')")
    page.wait_for_timeout(1000)
    page.click("button:has-text('Crear'):last-of-type")
    page.wait_for_timeout(2000)

    # Esperar botón Cambiar cliente
    page.wait_for_selector("button[title='Cambiar cliente']", timeout=20000)
    log("[LOGIN] Sesión lista")
    return True


def extraer_cabecera(page):
    """Extrae datos de cabecera del cliente."""
    def txt(sel, default="N/A"):
        try:
            return page.locator(sel).first.inner_text(timeout=2000).strip()
        except:
            return default

    return {
        "nombre": txt(".tooltip-text.name strong"),
        "dni": txt("span.font-xxs.p-r-10"),
        "direccion": txt(".tooltip-text.address"),
        "seg_fijo": txt("div.font-xxs:has-text('Seg. Fijo:') strong"),
        "seg_movil": txt("div.font-xxs:has-text('Seg. Móvil:') strong"),
        "paquete": txt(".client-tariff-title .font-lg"),
    }


def buscar_dni(page, dni, modal_abierto):
    """Busca un DNI y devuelve True si es cliente, False si no."""
    if not modal_abierto:
        page.click("button[title='Cambiar cliente']")
        page.wait_for_timeout(1000)

    campo = page.locator("input[name='document']")
    try:
        campo.wait_for(state="visible", timeout=8000)
    except:
        campo = page.locator("input[ng-model='locatorCtrl.inputDocument']")
        campo.wait_for(state="visible", timeout=8000)

    campo.click()
    campo.fill("")
    campo.fill(dni)
    campo.evaluate("el => { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }")
    page.wait_for_timeout(300)

    page.locator("button:has-text('Buscar cliente')").last.click(force=True)

    try:
        page.locator("button:has-text('Buscar cliente')").wait_for(state="hidden", timeout=10000)
    except:
        pass

    # Detectar no cliente
    no_cliente_sels = [
        "span.txt:has-text('No se han encontrado datos')",
        "span.txt:has-text('No se han encontrado datos para este cliente')",
        ".msg-error:has-text('No se han encontrado')",
    ]
    for sel in no_cliente_sels:
        try:
            if page.locator(sel).first.is_visible(timeout=1500):
                return False, True  # no_cliente, modal_abierto
        except:
            pass

    # Detectar toast error campañas
    try:
        toast = page.locator(".toast-error:has-text('No se han podido recuperar')")
        if toast.is_visible(timeout=1000):
            log(f"      ⚠️ TOAST: campañas no disponibles")
            return False, True
    except:
        pass

    # Esperar ficha de cliente
    try:
        page.wait_for_selector(".mod-barclient__container-data", timeout=15000)
        page.wait_for_timeout(1000)
    except:
        return False, True

    return True, True  # encontrado, modal_abierto


def dump_tabs(page, bloque, dni_idx):
    """Hace dump de TODAS las pestañas de una línea."""
    tab_bar = bloque.locator(".client-tariff-section-navs")
    if tab_bar.count() == 0:
        log(f"      [TABS] Sin barra de pestañas")
        return

    tabs = tab_bar.locator("button.Title")
    num_tabs = tabs.count()
    log(f"      [TABS] {num_tabs} pestañas disponibles:")

    for t_idx in range(num_tabs):
        try:
            nombre = tabs.nth(t_idx).inner_text().strip()
            tabs.nth(t_idx).click(timeout=5000)
            page.wait_for_timeout(400)

            cards_container = bloque.locator(".client-tariff-section-cards")
            if cards_container.count() == 0:
                log(f"      [{nombre}] Sin contenedor de cards")
                continue

            cards = cards_container.locator("> div")
            num_cards = cards.count()
            log(f"      [{nombre}] {num_cards} card(s)")

            for c_idx in range(num_cards):
                try:
                    texto = cards.nth(c_idx).inner_text().strip()
                    # Extraer campos clave
                    lineas_info = re.findall(r'([^\n]+)', texto)
                    log(f"        Card {c_idx}:")
                    for li in lineas_info:
                        li = li.strip()
                        if li:
                            log(f"          {li[:200]}")
                    log(f"        ---")
                except Exception as e:
                    log(f"        Card {c_idx}: ERROR {e}")

        except Exception as e:
            log(f"      [Tab {t_idx}] ERROR: {e}")


def procesar_dnis():
    # Cargar DNIs
    num_file = Path(__file__).parent / "numeros.txt"
    if not num_file.exists():
        log(f"[ERROR] No existe {num_file}")
        sys.exit(1)
    dnis = extraer_dnis(num_file.read_text(encoding="utf-8"))
    log(f"[INICIO] {len(dnis)} DNIs cargados")
    log(f"[INICIO] Primeros: {dnis[:5]}")
    log("=" * 80)

    # Cargar proxies y elegir uno al azar
    proxies = cargar_proxies()
    proxy_url = random.choice(proxies) if proxies else None
    if proxy_url:
        log(f"[PROXY] Proxy elegido: {proxy_url[:60]}...")

    # Iniciar navegador
    p, browser, page = iniciar_navegador(proxy_url)
    login_orange(page)
    log("=" * 80)

    procesados = 0
    errores = 0
    no_clientes = 0
    modal_abierto = False

    for idx, dni in enumerate(dnis):
        log(f"\n{'='*80}")
        log(f"[{idx+1}/{len(dnis)}] DNI: {dni}")

        try:
            encontrado, modal_abierto = buscar_dni(page, dni, modal_abierto)

            if not encontrado:
                no_clientes += 1
                log(f"  -> NO CLIENTE")
                continue

            # Cabecera
            cab = extraer_cabecera(page)
            log(f"  Cliente: {cab['nombre']} | DNI: {cab['dni']} | Paquete: {cab['paquete']}")
            log(f"  Dirección: {cab['direccion']}")
            log(f"  Seg Fijo: {cab['seg_fijo']} | Seg Móvil: {cab['seg_movil']}")

            # Recorrer líneas
            lineas_vistas = set()
            pagina = 1
            hay_mas = True

            while hay_mas:
                bloques = page.locator(".client-tariff-flex")
                log(f"\n  --- Página {pagina} — {bloques.count()} bloque(s) ---")

                for i in range(bloques.count()):
                    bloque = bloques.nth(i)
                    try:
                        num_linea = bloque.locator(".line-section .color-primary strong").inner_text().strip()
                    except:
                        continue

                    if num_linea in lineas_vistas:
                        log(f"  🛑 Línea {num_linea} repetida — fin de paginación")
                        hay_mas = False
                        break
                    lineas_vistas.add(num_linea)

                    # Heading
                    try:
                        heading = bloque.locator(".client-tariff-heading")
                        etiquetas = [h.inner_text().strip() for h in heading.locator("span.label").all()]
                        texto_heading = heading.first.inner_text()
                    except:
                        etiquetas = []
                        texto_heading = ""

                    log(f"\n  📱 Línea: {num_linea}")
                    log(f"    Etiquetas: {etiquetas}")
                    log(f"    Heading: {texto_heading[:200]}")

                    # DUMP de todas las pestañas
                    dump_tabs(page, bloque, idx)

                # Siguiente página
                btn_siguiente = page.locator("button.ocs-pagination-next")
                if btn_siguiente.count() > 0 and not btn_siguiente.is_disabled():
                    btn_siguiente.click(force=True, timeout=30000)
                    page.wait_for_timeout(2000)
                    pagina += 1
                else:
                    hay_mas = False

            procesados += 1

        except Exception as e:
            log(f"  [ERROR] {e}")
            errores += 1
            try:
                page.reload(timeout=30000)
                page.wait_for_timeout(3000)
                login_orange(page)
                modal_abierto = False
            except:
                log(f"  [FATAL] No se pudo recuperar")
                break

        log(f"--- Progreso: {procesados} OK / {no_clientes} no_clientes / {errores} errores ---")

    # Cerrar
    browser.close()
    p.stop()
    _fh.close()

    log(f"\n{'='*80}")
    log(f"[FIN] Resumen:")
    log(f"  Total DNIs:  {len(dnis)}")
    log(f"  Procesados:  {procesados}")
    log(f"  No clientes: {no_clientes}")
    log(f"  Errores:     {errores}")
    log(f"  Log guardado en: {_LOG}")


if __name__ == "__main__":
    procesar_dnis()
