"""
login.py -- Automatización de login en Pangea Orange
=====================================================
FLUJO EXACTO (basado en Bot_Orange de referencia):
  1. Aceptar cookies
  2. Login: input[name='temp-username'] + input[name='temp-password'] + #submit-button
  3. Manejar "máximo de sesiones" si aparece
  4. Seleccionar marca: a.orange-box
  5. Abrir nuevo acto comercial
"""

import random
import time
import re
from playwright.sync_api import Page
import builtins

# Worker ID prefix for log tracing (set by worker_loop.py before extraction)
WORKER_TAG = ""

def _log(*args, **kwargs):
    """Print con prefijo de worker [W{N}] para trazabilidad."""
    if WORKER_TAG and args:
        args = (f"{WORKER_TAG} {args[0]}",) + args[1:]
    import builtins as _bi
    _bi.print(*args, **kwargs)


# -- Excepciones ------------------------------------

class LoginError(Exception):
    pass

class SessionExpiredError(Exception):
    pass

class CriticalError(Exception):
    pass

class MaxSessionsError(LoginError):
    """Error especifico cuando se alcanza el maximo de sesiones en Pangea."""
    pass

class CaptchaBlockedError(LoginError):
    """Error cuando el CAPTCHA/Incapsula bloquea el login."""
    pass

class PangeaDownError(Exception):
    """Pangea esta completamente caida (chrome-error, ERR_TIMED_OUT)."""
    pass


# -- Frozen counter (Pangea colgada) ----------------

_frozen_count = 0
_FROZEN_LIMIT = 12  # despues de 12 seguidos sin respuesta -> F5

def _reset_frozen():
    global _frozen_count
    _frozen_count = 0

def _increment_frozen() -> bool:
    """Incrementa contador de congelamiento. Retorna True si alcanzo limite."""
    global _frozen_count
    _frozen_count += 1
    return _frozen_count >= _FROZEN_LIMIT


# -- Helpers ----------------------------------------

def _escribir_como_humano(page: Page, selector: str, texto: str):
    """Escribe caracter por caracter con delay aleatorio + Tab para Angular."""
    campo = page.locator(selector).locator("visible=true").first
    campo.click()
    campo.fill("")
    for letra in texto:
        page.keyboard.type(letra, delay=random.randint(50, 150))
    # CRÍTICO: Tab para que Angular registre el cambio
    page.keyboard.press("Tab")
    page.wait_for_timeout(random.randint(300, 800))


def _extraer_texto(page: Page, selector: str) -> str:
    """Extrae texto de un elemento vía evaluate para bypassear Angular."""
    try:
        elemento = page.locator(selector).first
        texto = elemento.evaluate("el => el.textContent")
        return texto.strip().replace("\n", " ") if texto else "N/A"
    except Exception:
        return "N/A"


def _extraer_estado_linea(bloque) -> list:
    """Extrae los tags de estado de línea con su color para detectar activos vs inactivos.
    Args:
        bloque: Playwright locator del div.client-tariff-flex
    Retorna: lista de dicts {texto, color, activo}
    """
    estados = []
    try:
        tags = bloque.locator("ocs-line-status span.label")
        for k in range(tags.count()):
            tag = tags.nth(k)
            texto = tag.inner_text().strip()
            if not texto or texto == "Estado de línea:":
                continue
            # Leer estilo inline para detectar color
            style = tag.get_attribute("style") or ""
            color = tag.evaluate("el => getComputedStyle(el).backgroundColor") or ""
            # Detectar si está activo (no gris): rojo, naranja, amarillo, etc.
            activo = "grey" not in color.lower() and "rgb(204" not in color
            estados.append({"texto": texto, "color": color, "activo": activo})
    except Exception:
        pass
    return estados


def _extraer_detalle_linea(bloque, label_texto: str) -> str:
    """Extrae un dato específico de ocs-line-details por texto del label.
    Busca dentro de los divs client-tariff-section-data-info el que contenga
    el texto dado (ej: 'Permanencia', 'Consumo', 'Venta a Plazos') y devuelve
    el texto del strong asociado."""
    try:
        detalles = bloque.locator("ocs-line-details .client-tariff-section-data-info")
        for k in range(detalles.count()):
            detalle = detalles.nth(k)
            texto_completo = detalle.inner_text()
            if label_texto.lower() in texto_completo.lower():
                strong = detalle.locator("strong")
                if strong.count() > 0:
                    return strong.first.inner_text().strip()
                return texto_completo.strip()
    except Exception:
        pass
    return "N/A"


def parsear_fecha_permanencia(texto: str) -> str:
    """Intenta extraer una fecha del texto de permanencia.
    Formatos: 'Vence 15/09/2026', '15/09/2026', '2026-09-15', etc.
    Retorna string ISO o '' si no se puede parsear."""
    import re
    if not texto or texto == "N/A":
        return ""
    # dd/mm/yyyy o dd-mm-yyyy
    m = re.search(r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})', texto)
    if m:
        dia, mes, anio = m.group(1).zfill(2), m.group(2).zfill(2), m.group(3)
        return f"{anio}-{mes}-{dia}"
    # yyyy-mm-dd
    m = re.search(r'(\d{4})-(\d{2})-(\d{2})', texto)
    if m:
        return m.group(0)
    return ""


def _extraer_campanas_tab(bloque, page, tab_nombre: str) -> list:
    """Hace click en una pestaña de campañas y extrae las cards visibles.
    Args:
        bloque: Playwright locator del div.client-tariff-flex
        page: instancia de página Playwright
        tab_nombre: texto del botón de la pestaña (ej: 'Cambio Tarifa', 'Bonos y Descuen.', 'SVA')
    Retorna: lista de dicts {tipo, texto}
    """
    campanas = []
    try:
        tab_bar = bloque.locator(".client-tariff-section-navs")
        if tab_bar.count() == 0:
            return campanas
        tab_btn = tab_bar.locator(f"button:has-text('{tab_nombre}')")
        if tab_btn.count() == 0:
            return campanas
        # Click en la pestaña
        try:
            tab_btn.first.click(timeout=4000)
            page.wait_for_timeout(100)
        except Exception:
            try:
                tab_btn.first.click(force=True, timeout=4000)
                page.wait_for_timeout(100)
            except Exception:
                return campanas
        # Extraer cards visibles
        cards_container = bloque.locator(".client-tariff-section-cards")
        if cards_container.count() > 0:
            cards = cards_container.locator(".card-tariff-minimal")
            for c_idx in range(cards.count()):
                card = cards.nth(c_idx)
                try:
                    label_el = card.locator(".card-tariff-label strong")
                    tipo = label_el.first.inner_text().strip() if label_el.count() > 0 else tab_nombre
                    info_el = card.locator(".card-tariff-info-text")
                    texto = info_el.first.inner_text().strip() if info_el.count() > 0 else card.inner_text().strip()
                    campanas.append({"tipo": tipo, "texto": texto})
                except Exception:
                    pass
    except Exception:
        pass
    return campanas


def _extraer_campanas_otros(bloque) -> list:
    """Extrae campañas del dropdown 'Otros' sin hacer click (cards ya visibles con label 'Otros')."""
    campanas = []
    try:
        cards_container = bloque.locator(".client-tariff-section-cards")
        if cards_container.count() == 0:
            return campanas
        cards = cards_container.locator(".card-tariff-minimal")
        for c_idx in range(cards.count()):
            card = cards.nth(c_idx)
            try:
                label_el = card.locator(".card-tariff-label strong")
                tipo = label_el.first.inner_text().strip() if label_el.count() > 0 else ""
                info_el = card.locator(".card-tariff-info-text")
                texto = info_el.first.inner_text().strip() if info_el.count() > 0 else ""
                if tipo and texto and tipo.lower() not in ("renove", "destacadas"):
                    campanas.append({"tipo": tipo, "texto": texto})
            except Exception:
                pass
    except Exception:
        pass
    return campanas
# -- Login ------------------------------------------

def manejar_cookies_flexible(page: Page):
    """Acepta el banner de cookies."""
    try:
        boton = page.locator("button:has-text('Aceptar')").first
        boton.wait_for(state="visible", timeout=5000)
        boton.click()
        _log("  [Login] Cookies aceptadas")
    except Exception:
        pass


def manejar_maximo_sesiones(page: Page):
    """Maneja el modal de 'máximo número de sesiones' lanzando MaxSessionsError."""
    try:
        if page.get_by_text(
            "ya ha alcanzado el número máximo permitido de sesiones"
        ).is_visible(timeout=5000):
            _log("  [Login] [MAX-SESIONES] Detectado — esperando 5 min...")
            raise MaxSessionsError("Máximo de sesiones alcanzado en Pangea")
    except MaxSessionsError:
        raise
    except Exception:
        pass


def realizar_login(page: Page, usuario: str = None, password: str = None):
    """Login en Orange con los selectores exactos del proyecto de referencia."""
    from dotenv import load_dotenv
    import os
    load_dotenv()

    usuario = usuario or os.getenv("ORANGE_USER", "")
    password = password or os.getenv("ORANGE_PASS", "")

    if not usuario or not password:
        raise LoginError("ORANGE_USER y ORANGE_PASS deben estar en .env")

    _log(f"  [Login] Iniciando sesión...")

    try:
        # ⚠️ Si ya estamos en selección de marca o dashboard, saltar login
        # (SSO tiene sesión cacheada — Pangea redirige directo sin pedir credenciales)
        current_url = page.url
        if ".brands" in page.content()[:2000] or page.locator("a.orange-box").count() > 0:
            _log("  [Login] [OK] Sesión SSO cacheada — ya en selector de marcas, saltando login")
            page.wait_for_timeout(2000)  # esperar render Angular
            return True
        if "/qualification" in current_url or page.locator("#orange-container").count() > 0:
            _log("  [Login] [OK] Sesión SSO cacheada — ya en dashboard, saltando login")
            page.wait_for_timeout(2000)  # esperar render Angular
            return True

        # Esperar campo de usuario (temp-username es el input Angular)
        page.wait_for_selector("input[name='temp-username']", timeout=20000)
        _escribir_como_humano(page, "input[name='temp-username']", usuario)
        _escribir_como_humano(page, "input[name='temp-password']", password)

        # Click en botón de login
        page.click("#submit-button")
        page.wait_for_timeout(3000)

        # Detectar si el CAPTCHA/Incapsula bloqueo el submit
        try:
            if page.locator("#submit-button").is_visible(timeout=2000):
                _log("  [Login] [CAPTCHA] Bloqueo detectado — formulario sigue visible tras submit")
                raise CaptchaBlockedError("CAPTCHA/Incapsula bloqueo el login")
        except CaptchaBlockedError:
            raise
        except Exception:
            pass

        # Manejar posible modal de máximo de sesiones
        manejar_maximo_sesiones(page)

        # Después del SSO, Pangea puede redirigir directo a /qualification (sin .brands)
        # o mostrar el selector de marcas. Manejamos ambos casos.
        page.wait_for_timeout(2000)
        current_url = page.url
        if "/qualification" in current_url or page.locator("#orange-container").count() > 0:
            # Ya estamos en el dashboard — saltar selector de marcas
            _log("  [Login] [OK] Login exitoso (directo a qualification)")
            try:
                page.wait_for_selector("#orange-container", state="visible", timeout=15000)
            except Exception:
                # Forzar visibilidad si está oculto (con null-check)
                page.evaluate("""() => {
                    const el = document.querySelector('#orange-container');
                    if (el) el.style.display = 'block';
                }""")
                page.wait_for_timeout(1000)
        else:
            # Flujo normal: esperar selector de marcas
            page.wait_for_selector(".brands", timeout=30000)
            _log("  [Login] [OK] Login exitoso")

    except MaxSessionsError:
        raise  # Dejar que el worker lo maneje (esperar 5 min)
    except CaptchaBlockedError:
        raise  # Dejar que el worker lo maneje (esperar y rotar proxy)
    except Exception as e:
        raise LoginError(f"Fallo en login: {e}")


def seleccionar_marca_orange(page: Page):
    """Selecciona la marca Orange. 3 intentos rapidos. Si falla -> LoginError."""
    if "/qualification" in page.url or page.locator("#orange-container").count() > 0:
        return  # ya estamos

    selector = "a.orange-box"

    for intento in range(3):
        try:
            page.wait_for_selector(selector, state="visible", timeout=15000)
            page.wait_for_timeout(200)

            # Estrategia 1+3 juntas: click normal y force click sin esperar entre ellos
            try: page.click(selector, timeout=3000)
            except: pass
            try: page.click(selector, force=True, timeout=3000)
            except: pass
            page.wait_for_timeout(500)

            if "/qualification" in page.url or page.locator("#orange-container").count() > 0:
                return

            # Estrategia 2: ng-click Angular
            page.evaluate("""() => {
                const el = document.querySelector('a.orange-box');
                if (!el) return;
                try {
                    const scope = angular.element(el).scope();
                    if (scope && scope.orangeFCUPdVCtrl) {
                        scope.orangeFCUPdVCtrl.reload('orange');
                    }
                } catch(e) {}
                el.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
            }""")
            page.wait_for_timeout(500)

            if "/qualification" in page.url or page.locator("#orange-container").count() > 0:
                return

            # Estrategia 4: goto directo
            page.goto("https://pangea.orange.es/qualification", timeout=20000)
            page.wait_for_selector("#orange-container", timeout=10000)
            return

        except Exception as e:
            if intento < 2:
                # Recargar rapido, sin SSO completo
                try: page.reload(timeout=10000)
                except: pass

    raise LoginError("Fallo al seleccionar marca Orange tras 3 intentos")


def abrir_nuevo_acto_comercial(page: Page):
    """Abre un nuevo acto comercial con múltiples estrategias.
    
    Estrategias (en orden):
    1. Click normal en 'Nuevo acto comercial' -> 'Tarifas' -> 'Crear'
    2. Force click si el elemento no es visible
    3. Navegación directa a la URL de Tarifas (más fiable)
    """
    _log("  [Login] Preparando entorno (nuevo acto comercial)...")
    
    def _click_tarifas():
        # Primero abrir el menu — probar multiples selectores
        nac = page.locator("button:has-text('Nuevo acto comercial')")
        try:
            nac.first.wait_for(state="visible", timeout=8000)
        except Exception:
            # Fallback: buscar por texto parcial o en spans internos
            nac = page.locator("button, a, div[role='button']").filter(has_text="Nuevo acto")
            nac.first.wait_for(state="visible", timeout=8000)
        nac.first.hover()
        page.wait_for_timeout(300)
        nac.first.click()
        page.wait_for_timeout(1500)
        
        # Estrategia 1: click normal
        tarifas = page.locator("li:has-text('Tarifas')")
        try:
            tarifas.first.wait_for(state="visible", timeout=5000)
            tarifas.first.hover()
            page.wait_for_timeout(300)
            tarifas.first.click()
            return True
        except Exception:
            pass
        
        # Estrategia 2: force click (aunque no sea visible)
        try:
            tarifas.first.click(force=True, timeout=5000)
            return True
        except Exception:
            pass
        
        # Estrategia 3: click via JavaScript
        try:
            page.evaluate("""() => {
                const el = document.querySelector('li:has-text(\"Tarifas\")');
                if (el) { el.click(); return true; }
                // Buscar enlaces con texto Tarifas
                const links = document.querySelectorAll('a');
                for (const a of links) {
                    if (a.textContent.includes('Tarifas')) { a.click(); return true; }
                }
                return false;
            }""")
            page.wait_for_timeout(2000)
            return True
        except Exception:
            pass
        
        return False
    
    try:
        if not _click_tarifas():
            raise LoginError("No se pudo hacer clic en Tarifas")

        btn_crear = page.locator("button:has-text('Crear')").last
        btn_crear.wait_for(state="visible", timeout=20000)
        page.wait_for_timeout(1500)
        btn_crear.hover()
        page.wait_for_timeout(300)
        btn_crear.click()

        # Esperar que aparezca el botón de cambiar cliente
        page.wait_for_selector("button[title='Cambiar cliente']", timeout=30000)
        
        # -- BLINDAJE: inyectar CSS anti-Herramientas desde el inicio --
        _blindar_contra_tools_dropdown(page)
        
        _log("  [Login] [OK] Entorno listo")
    except Exception as e:
        raise LoginError(f"Fallo al armar entorno: {e}")


# -- Extracción de datos del cliente ----------------

def _hay_toast_error(page) -> bool:
    """Detecta y cierra el toast de error de Orange.
    Cierra el toast automaticamente si esta presente
    para que no bloquee el boton Cambiar cliente."""
    try:
        toast = page.locator(".message-relevant.error")
        if toast.count() == 0:
            return False
        if toast.first.is_visible(timeout=1000):
            try:
                close_btn = toast.locator(".btn-close")
                if close_btn.count() > 0:
                    close_btn.first.click(force=True, timeout=2000)
                    page.wait_for_timeout(500)
            except:
                pass
            return True
    except Exception:
        pass
    return False

def _abrir_cambiar_cliente(page):
    """Hace clic en Cambiar cliente para dejar el modal listo para el siguiente DNI."""
    try:
        page.locator("button[title='Cambiar cliente']").first.click(force=True, timeout=5000)
        page.wait_for_timeout(1000)
    except Exception:
        pass


def _blindar_contra_tools_dropdown(page: Page):
    """Inyecta CSS para deshabilitar el dropdown de 'Herramientas' en el header.
    
    El boton 'Herramientas' en el header de Pangea abre un dropdown con links como
    'Centralita LOVE', 'ARPA', etc. al hacer hover o click.
    Si el bot accidentalmente activa este dropdown y hace click en un link,
    navega fuera de Pangea y pierde la sesion. Este blindaje lo previene."""
    try:
        page.add_style_tag(content="""
            /* BLINDAJE: deshabilitar dropdown de Herramientas */
            .o-comp__tools-menu-container,
            div[ng-show="toolsCtrl.showMenu"] {
                display: none !important;
                visibility: hidden !important;
                pointer-events: none !important;
            }
            /* Deshabilitar hover/click en el boton Herramientas */
            .o-comp__tools__select,
            button.o-comp__form-select--bold {
                pointer-events: none !important;
            }
        """)
        _log("  [Blindaje] CSS anti-Herramientas inyectado")
    except Exception as e:
        _log(f"  [Blindaje] [WARN] No se pudo inyectar CSS: {e}")


def _verificar_no_navego_fuera(page: Page, dni_actual: str = "") -> bool:
    """Verifica que seguimos en Pangea y no navegamos a una pagina externa.
    Retorna True si todo OK, False si detecto navegacion externa."""
    try:
        url = page.url
        if "chrome-error" in url or "chromewebdata" in url:
            _log(f"  [FATAL] [!!] PANGEA CAIDA detectada para DNI {dni_actual}!")
            _log(f"  [FATAL] URL: {url}")
            raise PangeaDownError(f"Pangea no disponible (chrome-error): {url}")
        if "pangea.orange.es" not in url:
            _log(f"  [ALARMA] [!!] NAVEGACION FUERA DE PANGEA detectada para DNI {dni_actual}!")
            _log(f"  [ALARMA] URL actual: {url}")
            # Intentar volver
            try:
                page.go_back()
                page.wait_for_timeout(2000)
                _log(f"  [ALARMA] go_back() ejecutado, nueva URL: {page.url}")
            except Exception:
                _log(f"  [ALARMA] No se pudo hacer go_back()")
            return False
        return True
    except Exception:
        return True  # Si ni siquiera podemos leer la URL, asumimos OK para no frenar


def extraer_datos_cliente(page: Page, numero: str, buscar_por_dni: bool = True,
                           modal_ya_abierto: bool = False):
    """
    Busca un cliente por DNI (o teléfono) y extrae todos sus datos.

    Args:
        modal_ya_abierto: Si True, el modal de búsqueda ya está abierto
                          ("no es cliente" del DNI anterior). Solo escribe
                          el DNI y busca, sin reabrir el modal.

    Retorna lista de dicts (una fila por línea del cliente).
    """
    max_intentos = 2

    for intento in range(max_intentos):
        # -- Auto-detectar tipo de busqueda: DNI vs telefono --
        es_telefono = numero.replace(' ', '').replace('-', '').isdigit() and len(numero.replace(' ', '').replace('-', '')) == 9
        _log(f"  [Extracción] Buscando: {numero} (Intento {intento+1}) {'[TEL]' if es_telefono else '[DNI]'}")
        try:
            # -- BLINDAJE 0: Verificar que no navegamos fuera --
            if not _verificar_no_navego_fuera(page, dni_actual=numero):
                _log(f"  [Extracción] [!!] Navegacion externa detectada -- abortando cliente {numero}")
                return []

            # -- BLINDAJE 1: Inyectar CSS anti-Herramientas --
            _blindar_contra_tools_dropdown(page)

            # -- 1. ABRIR MODAL (igual para DNI y telefono) ----------
            if modal_ya_abierto:
                # Modal abierto del DNI anterior ("no es cliente")
                try:
                    page.wait_for_selector("input[name='numeroDocumento']", state="visible", timeout=3000)
                except Exception:
                    page.wait_for_selector("input[ng-model='locatorCtrl.inputDocument']", state="visible", timeout=3000)
            else:
                # -- Abrir modal de busqueda --
                btn_cambiar = page.locator("button[title='Cambiar cliente']")
                btn_cambiar.wait_for(state="visible", timeout=15000)
                btn_cambiar.click(force=True)

                # Esperar a que el modal cargue
                try:
                    page.wait_for_selector("input[name='numeroDocumento']", state="visible", timeout=5000)
                except Exception:
                    page.wait_for_selector("input[ng-model='locatorCtrl.inputDocument']", state="visible", timeout=5000)

            # -- 2. ESCRIBIR EN EL CAMPO CORRECTO (DNI vs Telefono) --
            if es_telefono:
                # TELFONO: escribir en input ng-model locatorCtrl.inputMsisdn
                campo = page.locator("input[ng-model='locatorCtrl.inputMsisdn']").first
                campo.wait_for(state="visible", timeout=5000)
                campo.click()
                campo.fill("")
                campo.fill(numero.replace(' ', '').replace('-', ''))
                campo.evaluate(
                    "el => { el.dispatchEvent(new Event('input', { bubbles: true })); "
                    "el.dispatchEvent(new Event('change', { bubbles: true })); }"
                )
                _log("  [Extracción] Telefono escrito en modal")
            else:
                # DNI: escribir en input[name='numeroDocumento']
                try:
                    page.wait_for_selector("input[name='numeroDocumento']", state="visible", timeout=3000)
                except Exception:
                    pass
                campo = page.locator("input[name='numeroDocumento']").first
                if campo.count() == 0:
                    campo = page.locator("input[ng-model='locatorCtrl.inputDocument']").first
                campo.click()
                campo.fill("")
                campo.fill(numero)
                campo.evaluate(
                    "el => { el.dispatchEvent(new Event('input', { bubbles: true })); "
                    "el.dispatchEvent(new Event('change', { bubbles: true })); }"
                )

            # -- 3. CLICK EN "Buscar cliente" --
            page.wait_for_timeout(random.randint(300, 800))
            btn_buscar = page.locator("button:has-text('Buscar cliente')").last
            btn_buscar.click(force=True)

            # BLINDAJE POST-CLICK: verificar que no abrimos Centralita LOVE u otra pagina
            if not _verificar_no_navego_fuera(page, dni_actual=numero):
                _log(f"  [Extracción] [!!] Tras click Buscar cliente se navego fuera -- abortando {numero}")
                return []

            # -- BLINDAJE: esperar que el modal se cierre (max 5s) --
            _log("  [Extracción] Verificando procesamiento...")
            try:
                btn_buscar.wait_for(state="hidden", timeout=5000)
            except Exception:
                # Puede que el modal no se cierre si no es cliente
                pass

            # SEGUNDO BLINDAJE: verificar que seguimos en Pangea
            if not _verificar_no_navego_fuera(page, dni_actual=numero):
                _log(f"  [Extracción] [!!] Navegacion externa tras procesar {numero} -- retornando vacio")
                return []

            # DETECTAR PYME (empresa) -- Pangea no cierra el modal
            try:
                pyme_matches = page.locator(".msg-error:has-text('Cliente PYME')")
                pyme_visible = False
                for j in range(pyme_matches.count()):
                    if pyme_matches.nth(j).is_visible():
                        pyme_visible = True
                        break
                if pyme_visible:
                    _log(f"  [Extracción] [PYME] {numero} es empresa -- cerrando modal")
                    try:
                        close_btn = page.locator("button.close[data-dismiss='modal']").last
                        if close_btn.count() > 0:
                            close_btn.click(force=True, timeout=3000)
                            page.wait_for_timeout(500)
                    except Exception:
                        pass
                    _reset_frozen()  # Pangea respondio (PYME)
                    return [{
                        "DNI": numero,
                        "Nombre": "CLIENTE PYME",
                        "Direccion": "N/A",
                        "Seg Fijo": "N/A",
                        "Seg Movil": "N/A",
                        "Paquete": "N/A",
                        "Linea": numero,
                        "es_cima": False,
                        "tiene_renove_mixto": False,
                        "variante_renove": "N/A",
                        "tiene_tv": False,
                        "es_principal": False,
                        "etiquetas": [],
                        "activo_desde": "N/A",
                        "producto": "N/A",
                        "estado_linea": [],
                        "permanencia": "N/A",
                        "consumo": "N/A",
                        "venta_plazos": "N/A",
                        "campanas_extra": [],
                        "_modal_abierto": False,
                    }]
            except Exception:
                pass

            # === DETECTAR MAXIMO DE LINEAS ("supera el maximo de lineas permitidas") ===
            try:
                max_lineas_matches = page.locator(".msg-error:has-text('supera el maximo de lineas permitidas')")
                max_lineas_visible = False
                for j in range(max_lineas_matches.count()):
                    if max_lineas_matches.nth(j).is_visible():
                        max_lineas_visible = True
                        break
                if max_lineas_visible:
                    _log(f"  [Extraccion] [MAX-LINEAS] {numero} supera maximo de lineas -- cerrando modal")
                    try:
                        close_btn = page.locator("button.close[data-dismiss='modal']").last
                        if close_btn.count() > 0:
                            close_btn.click(force=True, timeout=3000)
                            page.wait_for_timeout(500)
                    except Exception:
                        pass
                    _reset_frozen()  # Pangea respondio (MAX LINEAS)
                    return [{
                        "DNI": numero, "Nombre": "CLIENTE MAX LINEAS", "Direccion": "N/A",
                        "Seg Fijo": "N/A", "Seg Movil": "N/A", "Paquete": "N/A",
                        "Linea": numero, "es_cima": False, "tiene_renove_mixto": False,
                        "variante_renove": "N/A", "tiene_tv": False, "es_principal": False,
                        "etiquetas": [], "activo_desde": "N/A", "producto": "N/A",
                        "estado_linea": [], "permanencia": "N/A", "consumo": "N/A",
                        "venta_plazos": "N/A", "campanas_extra": [], "_modal_abierto": False,
                    }]
            except Exception:
                pass

            # === DETECTAR "NO ES CLIENTE" ===
            no_cliente_selectores = [
                "span.txt:has-text('No se han encontrado datos')",
                "span.txt:has-text('No se han encontrado datos para este cliente')",
                ".msg-error:has-text('No se han encontrado')",
            ]
            es_no_cliente = False
            for sel in no_cliente_selectores:
                try:
                    # [!!] Usar :visible para no agarrar el .msg-error oculto (ng-hide)
                    matches = page.locator(sel)
                    for j in range(matches.count()):
                        if matches.nth(j).is_visible():
                            es_no_cliente = True
                            break
                    if es_no_cliente:
                        break
                except Exception:
                    continue

            if es_no_cliente:
                _reset_frozen()  # Pangea respondio — resetear contador de congelamiento
                _log(f"  [Extracción] [FAIL] {numero} NO ES CLIENTE")
                #  NO cerrar modal -- solo limpiar campo y escribir siguiente DNI
                # El mensaje de error no bloquea el input
                return [{
                    "DNI": numero,
                    "Nombre": "NO ES CLIENTE",
                    "Direccion": "N/A",
                    "Seg Fijo": "N/A",
                    "Seg Movil": "N/A",
                    "Paquete": "N/A",
                    "Linea": numero,
                    "es_cima": False,
                    "tiene_renove_mixto": False,
                    "variante_renove": "N/A",
                    "tiene_tv": False,
                    "es_principal": False,
                    "etiquetas": [],
                    "activo_desde": "N/A",
                    "producto": "N/A",
                    "estado_linea": [],
                    "permanencia": "N/A",
                    "consumo": "N/A",
                    "venta_plazos": "N/A",
                    "campanas_extra": [],
                    "_modal_abierto": True,  # Modal sigue abierto, escribir siguiente DNI
                }]

            # === DETECTAR PANGEA CONGELADA (modal abierto SIN texto de error) ===
            try:
                if btn_buscar.is_visible():
                    # Modal abierto pero SIN texto explicito de no_cliente
                    # -> Pangea no respondio (congelada)
                    if _increment_frozen():
                        _log(f"  [Extracción] [!!] {_FROZEN_LIMIT} DNIs sin respuesta de Pangea. Haciendo F5...")
                        _reset_frozen()
                        page.reload(timeout=30000, wait_until="domcontentloaded")
                        page.wait_for_timeout(3000)
                        current_url = page.url
                        if "pangea.orange.es" not in current_url:
                            _log(f"  [Extracción] [FATAL] Pangea no disponible tras F5 (URL: {current_url})")
                            raise PangeaDownError("Pangea no disponible tras F5")
                        _log("  [Extracción] Pangea respondio tras F5. Reabriendo modal...")
                        # Si tras F5 estamos en /qualification (dashboard), abrir NAC primero
                        try:
                            if "/qualification" in page.url:
                                abrir_nuevo_acto_comercial(page)
                        except Exception:
                            pass
                        try:
                            btn_cambiar = page.locator("button[title='Cambiar cliente']")
                            btn_cambiar.wait_for(state="visible", timeout=10000)
                            btn_cambiar.click(force=True)
                            try:
                                page.wait_for_selector("input[name='numeroDocumento']", state="visible", timeout=5000)
                            except Exception:
                                page.wait_for_selector("input[ng-model='locatorCtrl.inputDocument']", state="visible", timeout=5000)
                        except Exception:
                            pass
                    _log(f"  [Extracción] [WARN] {numero}: Pangea no respondio (modal abierto sin error). Frozen: {_frozen_count}/{_FROZEN_LIMIT}")
                    return []
            except PangeaDownError:
                raise
            except Exception:
                pass
            # === DETECTAR ERROR "No se han podido recuperar campañas" ===
            if _hay_toast_error(page):
                _log(f"  [Extracción] [FAIL] {numero}: error campañas -- Cambiar cliente y siguiente")
                _abrir_cambiar_cliente(page)
                _reset_frozen()  # Pangea respondio (aunque con error)
                return [{
                    "DNI": numero,
                    "Nombre": "ERROR CAMPANAS",
                    "Direccion": "N/A",
                    "Seg Fijo": "N/A",
                    "Seg Movil": "N/A",
                    "Paquete": "N/A",
                    "Linea": numero,
                    "es_cima": False,
                    "tiene_renove_mixto": False,
                    "variante_renove": "N/A",
                    "tiene_tv": False,
                    "es_principal": False,
                    "etiquetas": [],
                    "activo_desde": "N/A",
                    "producto": "N/A",
                    "estado_linea": [],
                    "permanencia": "N/A",
                    "consumo": "N/A",
                    "venta_plazos": "N/A",
                    "campanas_extra": [],
                    "_modal_abierto": True,
                }]

            _log("  [Extracción] Cargando ficha de cliente...")
            page.wait_for_timeout(800)
            # Quick 2s check: si Pangea redirigió a /qualification
            # Quick 6s check: si Pangea redirigió a /qualification
            # [!!] Solo es dashboard si el hash esta vacio. Cualquier ruta = pagina de cliente.
            try:
                page.wait_for_selector(".mod-barclient__container-data", timeout=6000)
            except Exception:
                # Verificar si estamos en dashboard (sin hash de ruta de cliente)
                url_after_hash = page.url.split("#")[-1] if "#" in page.url else ""
                en_dashboard = (
                    page.locator("#orange-container").count() > 0
                    and (not url_after_hash or url_after_hash in ("/", ""))
                )
                if en_dashboard:
                    # ¿Acto comercial sigue vivo? → DNI problemático, no sesión expirada
                    try:
                        page.wait_for_selector("button[title='Cambiar cliente']", state="visible", timeout=2000)
                        _log(f"  [Extracción] [FAIL] {numero}: Pangea no puede cargar datos — marcando sin_datos")
                        _reset_frozen()
                        # Reabrir acto comercial para siguiente DNI (sin F5)
                        try:
                            abrir_nuevo_acto_comercial(page)
                            _log("  [Extracción] [NAC] Acto comercial reabierto para siguiente DNI")
                        except Exception:
                            _log("  [Extracción] [NAC] No se pudo reabrir acto — siguiente DNI lo intentara")
                        return [{
                            "DNI": numero, "Nombre": "CLIENTE NO CARGABLE", "Direccion": "N/A",
                            "Seg Fijo": "N/A", "Seg Movil": "N/A", "Paquete": "N/A",
                            "Linea": numero, "es_cima": False, "tiene_renove_mixto": False,
                            "variante_renove": "N/A", "tiene_tv": False, "es_principal": False,
                            "etiquetas": [], "activo_desde": "N/A", "producto": "N/A",
                            "estado_linea": [], "permanencia": "N/A", "consumo": "N/A",
                            "venta_plazos": "N/A", "campanas_extra": [],
                            "_modal_abierto": False,
                        }]
                    except Exception:
                        _log("  [Extracción] [!!] Sesión expirada (redirect a qualification sin NAC) — recuperando...")
                        raise Exception("Sesión expirada — Pangea redirigió a qualification")
                # Pangea lento, esperar el resto (34s)
                page.wait_for_selector(".mod-barclient__container-data", timeout=34000)

            # -- DETECTAR CIMA GLOBAL (barra superior) --
            cima_global = False
            try:
                cima_btn = page.locator(".mod-barclient__container-lines-cima-btn")
                if cima_btn.count() > 0:
                    texto_cima_btn = cima_btn.first.inner_text()
                    cima_global = "isCima" in texto_cima_btn or "CIMA" in texto_cima_btn.upper()
            except Exception:
                pass

            # -- 2. DATOS CABECERA ---------------------
            nombre = _extraer_texto(page, ".tooltip-text.name strong")
            dni = _extraer_texto(page, "span.font-xxs.p-r-10")

            # BLINDAJE ANTI-DUPLICACION (solo para busqueda por DNI)
            dni_page_limpio = dni.strip().upper().replace("-", "").replace(".", "").replace(" ", "")
            dni_buscado_limpio = numero.strip().upper().replace("-", "").replace(".", "").replace(" ", "")
            if not es_telefono and dni_page_limpio and dni_buscado_limpio and dni_page_limpio not in ("N/A", "") and dni_page_limpio != dni_buscado_limpio:
                _log(f"  [Extracción] [FAIL] DNI no coincide: buscado={numero} vs pagina={dni} -- modal no cargo")
                raise Exception(f"DNI mismatch: buscado {numero} != pagina {dni}")

            # SKIP DUPLICADOS: busqueda por telefono de cliente ya procesado
            if es_telefono and dni_page_limpio and dni_page_limpio not in ("N/A", ""):
                try:
                    import requests
                    import os as _os
                    from pathlib import Path as _Path
                    from dotenv import load_dotenv as _ld
                    _ld(_Path(__file__).parent.parent / '.env')
                    r = requests.get(
                        f"{_os.getenv('BOT_API_URL', 'http://localhost:3000')}/api/clientes/{dni_page_limpio}",
                        headers={"x-bot-api-key": _os.getenv('BOT_API_KEY', 'oratioo-bot-internal-key')},
                        timeout=5,
                    )
                    if r.ok and r.json():
                        _log(f"  [Extracción] [SKIP] Cliente {dni_page_limpio} ya procesado -- omitiendo")
                        _reset_frozen()  # Pangea respondio (YA_PROCESADO)
                        return [{"DNI": dni_page_limpio, "Nombre": "YA_PROCESADO", "_skip": True,
                                "Direccion": "N/A", "Seg Fijo": "N/A", "Seg Movil": "N/A",
                                "Paquete": "N/A", "Linea": numero,
                                "es_cima": False, "tiene_renove_mixto": False, "variante_renove": "N/A",
                                "tiene_tv": False, "es_principal": False, "etiquetas": [],
                                "activo_desde": "N/A", "producto": "N/A", "estado_linea": [],
                                "permanencia": "N/A", "consumo": "N/A", "venta_plazos": "N/A",
                                "campanas_extra": [], "notificacion_pack": "", "_modal_abierto": False}]
                except Exception:
                    pass  # Si falla la API, seguir normalmente
            direccion = _extraer_texto(page, ".tooltip-text.address")
            seg_fijo = _extraer_texto(page, "div.font-xxs:has-text('Seg. Fijo:') strong")
            seg_movil = _extraer_texto(page, "div.font-xxs:has-text('Seg. Móvil:') strong")
            paquete = _extraer_texto(page, ".client-tariff-title .font-lg")

            # -- Extraer notificación de pack --
            notificacion_pack = ""
            try:
                notif_el = page.locator(".notification-container .message-relevant.info p.title")
                if notif_el.count() > 0:
                    notificacion_pack = notif_el.first.inner_text().strip()
                    _log(f"  [Extracción] Notificacion: {notificacion_pack}")
            except Exception:
                pass

            _log(f"  [Extracción] Cliente: {nombre} | DNI: {dni} | Paquete: {paquete}")
            _log(f"  [Extracción] Dirección: {direccion}")

            # === TOAST ERROR ("No se han podido recuperar campañas") -- SALTAR DNI ===
            if _hay_toast_error(page):
                _log(f"  [Extracción] [FAIL] {numero}: error campañas -- Cambiar cliente y siguiente")
                _abrir_cambiar_cliente(page)
                _reset_frozen()  # Pangea respondio (aunque con error)
                return [{
                    "DNI": numero,
                    "Nombre": "ERROR CAMPANAS",
                    "Direccion": direccion if direccion != "N/A" else "N/A",
                    "Seg Fijo": "N/A",
                    "Seg Movil": "N/A",
                    "Paquete": "N/A",
                    "Linea": numero,
                    "es_cima": False,
                    "tiene_renove_mixto": False,
                    "variante_renove": "N/A",
                    "tiene_tv": False,
                    "es_principal": False,
                    "etiquetas": [],
                    "activo_desde": "N/A",
                    "producto": "N/A",
                    "estado_linea": [],
                    "permanencia": "N/A",
                    "consumo": "N/A",
                    "venta_plazos": "N/A",
                    "campanas_extra": [],
                    "_modal_abierto": True,
                }]

            # -- 3. BUCLE DE LÍNEAS CON PAGINACIÓN -----
            lineas_finales = []
            lineas_vistas = set()  # Anti-loop paginacion
            hay_mas_paginas = True
            pagina_actual = 1

            while hay_mas_paginas:
                _log(f"  [Extracción] Página {pagina_actual} de líneas...")
                bloques = page.locator(".client-tariff-flex")
                primera_linea_pagina = None  # Para detectar loop de paginación

                for i in range(bloques.count()):
                    bloque = bloques.nth(i)
                    if not bloque.locator(".line-section .color-primary strong").is_visible():
                        continue

                    # -- Paquete de ESTE tariff (vía XPath ancestor) --
                    paquete_tariff = paquete  # fallback
                    try:
                        # [!!] contains(@class,'client-tariff') también atrapa <div class="mod-client-tariff">
                        # -> usar word-boundary match para pillar solo el div.tariff real, no el wrapper
                        tariff_parent = bloque.locator("xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' client-tariff ')]")
                        if tariff_parent.count() > 0:
                            # DIAG: intentar varios selectores para pillar el título del tariff
                            titulo_el = tariff_parent.first.locator(".client-tariff-title .font-lg")
                            if titulo_el.count() == 0:
                                # Alternativa: buscar cualquier .font-lg dentro del ancestor
                                titulo_el = tariff_parent.first.locator(".font-lg")
                            if titulo_el.count() == 0:
                                # Último intento: h2, h3, o cualquier heading fuerte
                                titulo_el = tariff_parent.first.locator("h2, h3, .tariff-title, [class*='title']")
                            if titulo_el.count() > 0:
                                paquete_tariff = titulo_el.first.inner_text().strip()
                            else:
                                _log(f"      [DIAG] Ancestor encontrado pero sin título")
                        else:
                            _log(f"      [DIAG] XPath ancestor no encontrado para este bloque")
                    except Exception as e:
                        _log(f"      [DIAG] Error ancestor lookup: {e}")

                    num_linea = bloque.locator(
                        ".line-section .color-primary strong"
                    ).inner_text().strip()
                    # Guardar primera línea de la página para detectar loop
                    if primera_linea_pagina is None:
                        primera_linea_pagina = num_linea
                    # 🔄 Anti-loop: si ya vimos esta línea, Orange está repitiendo páginas
                    if num_linea in lineas_vistas:
                        _log(f"    🛑 Línea {num_linea} repetida -- loop de paginación. Saliendo.")
                        hay_mas_paginas = False
                        break
                    lineas_vistas.add(num_linea)
                    _log(f"    -> Línea: {num_linea} | Tariff: {paquete_tariff}")

                    # -- Extraer etiquetas reales del heading (CIMA, TV, Principal, etc.) --
                    try:
                        heading = bloque.locator(".client-tariff-heading")
                        labels = heading.locator("span.label")
                        etiquetas = [labels.nth(k).inner_text().strip() for k in range(labels.count())]
                        texto_completo = heading.first.inner_text()
                    except Exception:
                        etiquetas = []
                        texto_completo = ""
                    es_cima = "CIMA" in etiquetas or cima_global
                    tiene_tv = "TV" in etiquetas
                    es_principal = "Principal" in etiquetas
                    # Extraer fecha activo desde
                    match_fecha = re.search(r'Activo desde\s+(\d{2}/\d{2}/\d{4})', texto_completo)
                    activo_desde = match_fecha.group(1) if match_fecha else "N/A"

                    # -- NUEVO: Extraer producto de la línea --
                    producto_linea = "N/A"
                    try:
                        strongs = bloque.locator(".line-section strong")
                        if strongs.count() >= 2:
                            producto_linea = strongs.nth(1).inner_text().strip()
                    except Exception:
                        pass

                    # -- NUEVO: Extraer estado de línea con colores --
                    estado_linea = _extraer_estado_linea(bloque)

                    # -- NUEVO: Extraer permanencia, consumo, VAPs --
                    permanencia = _extraer_detalle_linea(bloque, "Permanencia")
                    # Extraer fecha exacta de permanencia para scoring
                    permanencia_fecha = parsear_fecha_permanencia(permanencia)
                    consumo = _extraer_detalle_linea(bloque, "Consumo")
                    venta_plazos = _extraer_detalle_linea(bloque, "Venta a Plazos")

                    # -- Detectar Renove: click en PESTAÑA "Renove" (no en tarjeta!) --
                    tiene_rm = False
                    variante_renove = "N/A"
                    renove_texto_raw = ""
                    renove_timeout = False
                    heading_text = ""
                    tiene_rm_heading = False
                    try:
                        heading_text = bloque.locator(".client-tariff-heading").first.inner_text()
                        tiene_rm_heading = bool(re.search(r'\b(Renove|MIXTO)\b', heading_text, re.IGNORECASE))
                    except Exception:
                        pass

                    try:
                        # Buscar la BARRA DE PESTAÑAS de esta línea
                        tab_bar = bloque.locator(".client-tariff-section-navs")
                        if tab_bar.count() > 0:
                            # Encontrar el botón "Renove" en los tabs
                            renove_tab_btn = tab_bar.locator("button:has-text('Renove')")
                            if renove_tab_btn.count() > 0:
                                _log(f"      [RENOVE] Click en pestaña de navegación 'Renove'...")
                                try:
                                    renove_tab_btn.first.click(timeout=5000)
                                    page.wait_for_timeout(100)
                                except Exception:
                                    try:
                                        renove_tab_btn.first.click(force=True, timeout=5000)
                                        page.wait_for_timeout(100)
                                    except Exception:
                                        pass

                                # Leer el contenido de la tarjeta Renove (card-tariff-minimal)
                                texto_card = ""
                                try:
                                    cards_container = bloque.locator(".client-tariff-section-cards")
                                    if cards_container.count() > 0:
                                        # Buscar la card con label "Renove"
                                        renove_card = cards_container.locator(".card-tariff-minimal")
                                        for c_idx in range(renove_card.count()):
                                            card = renove_card.nth(c_idx)
                                            # Leer info-text directamente (puede no tener label cuando tab está activo)
                                            txt_el = card.locator(".card-tariff-info-text")
                                            if txt_el.count() > 0:
                                                txt = txt_el.first.inner_text().strip()
                                                # Si contiene RENOVE/MIXTO/MULTI, es la card que buscamos
                                                if re.search(r'\b(RENOVE|MIXTO|MULTIDISPOSITIVO)\b', txt.upper()):
                                                    texto_card = txt
                                                    break
                                                # Si no encontramos con filtro, guardar la primera y seguir buscando
                                                if not texto_card:
                                                    texto_card = txt
                                            else:
                                                txt = card.inner_text().strip()
                                                if "renove" in txt.upper():
                                                    texto_card = txt
                                                    break
                                                if not texto_card:
                                                    texto_card = txt
                                except Exception:
                                    pass

                                texto_up = texto_card.upper() if texto_card else ""
                                # [!!] Solo marcar Renove si HAY contenido real en la card
                                tiene_rm = bool(texto_card and re.search(r'\b(RENOVE|MIXTO|MULTIDISPOSITIVO)\b', texto_up))

                                if "RENOVE MIXTO" in texto_up or "MIXTO" in texto_up:
                                    if "MÁXIMO DESCUENTO" in texto_up or "MAXIMO DESCUENTO" in texto_up:
                                        variante_renove = "Renove mixto al mejor precio con máximo descuento"
                                    elif "CON DESCUENTO" in texto_up:
                                        variante_renove = "Renove mixto al mejor precio con descuento"
                                    elif "MEJOR PRECIO" in texto_up:
                                        variante_renove = "Renove mixto al mejor precio"
                                    else:
                                        variante_renove = "Renove mixto"
                                elif "MULTIDISPOSITIVO" in texto_up:
                                    variante_renove = "Renove Multidispositivo"
                                elif texto_card:
                                    variante_renove = f"Renove ({texto_card})"
                                # Si no hay texto, NO poner "Renove" a secas (pisaría datos válidos de otras líneas)
                                # mejor dejar "N/A" -- la línea no tiene Renove visible

                                _log(f"      [RENOVE] Texto: {texto_card[:80] if texto_card else '(vacio)'} | -> {variante_renove}")
                                # Guardar también el texto original en campanas_extra para mostrarlo en la UI
                                renove_texto_raw = texto_card.strip() if texto_card else variante_renove
                            else:
                                _log(f"      [RENOVE] No hay pestaña 'Renove' en la barra de tabs")
                        else:
                            _log(f"      [RENOVE] No hay barra de pestañas en esta línea")
                    except Exception as e:
                        _log(f"      [RENOVE] Error: {e}")

                    # -- FALLBACK heading --
                    if not tiene_rm and tiene_rm_heading:
                        variante_renove = "Renove (detectado en heading)"
                        _log(f"      [RENOVE] Detectado en heading: {heading_text[:80]}")
                        tiene_rm = True

                    if renove_timeout:
                        raise Exception(f"Renove no cargó para {numero}")

                    # -- NUEVO: Extraer campañas adicionales (Cambio Tarifa, Bonos, SVA, Otros) --
                    campanas_extra = []
                    # Agregar Renove como campaña para que aparezca en la columna derecha de la UI
                    if tiene_rm and (renove_texto_raw or variante_renove not in ("N/A", "")):
                        campanas_extra.append({"tipo": "Renove", "texto": renove_texto_raw or variante_renove})
                    # Solo si la barra de tabs existe
                    try:
                        tab_bar_camp = bloque.locator(".client-tariff-section-navs")
                        if tab_bar_camp.count() > 0:
                            # Orden Orange: Destacadas -> Renove(ya) -> Bonos -> Cambio Tarifa -> SVA -> Otros
                            bonos = _extraer_campanas_tab(bloque, page, "Bonos y Descuen.")
                            campanas_extra.extend(bonos)
                            ct = _extraer_campanas_tab(bloque, page, "Cambio Tarifa")
                            campanas_extra.extend(ct)
                            sva = _extraer_campanas_tab(bloque, page, "SVA")
                            campanas_extra.extend(sva)
                            # === Dropdown "Otros" (3 puntitos) ===
                            try:
                                dropdown_btn = tab_bar_camp.locator("button.dropdown-toggle")
                                if dropdown_btn.count() > 0:
                                    dropdown_btn.first.click(force=True, timeout=3000)
                                    page.wait_for_timeout(100)
                                    # Click en "Otros" del menú desplegable
                                    otros_btn = page.locator("button.dropdown-item:has-text('Otros')")
                                    if otros_btn.count() > 0:
                                        otros_btn.first.click(force=True, timeout=3000)
                                        page.wait_for_timeout(100)
                                        # Extraer cards visibles (ahora bajo "Otros")
                                        cards_c = bloque.locator(".client-tariff-section-cards")
                                        if cards_c.count() > 0:
                                            cards = cards_c.locator(".card-tariff-minimal")
                                            for c_idx in range(cards.count()):
                                                card = cards.nth(c_idx)
                                                try:
                                                    lbl = card.locator(".card-tariff-label strong")
                                                    tipo2 = lbl.first.inner_text().strip() if lbl.count() > 0 else "Otros"
                                                    info2 = card.locator(".card-tariff-info-text")
                                                    txt2 = info2.first.inner_text().strip() if info2.count() > 0 else ""
                                                    if txt2:
                                                        campanas_extra.append({"tipo": tipo2, "texto": txt2})
                                                except Exception:
                                                    pass
                            except Exception:
                                pass
                            # Volver a Renove para no romper la iteración
                            try:
                                renove_back = tab_bar_camp.locator("button:has-text('Renove')")
                                if renove_back.count() > 0:
                                    renove_back.first.click(force=True, timeout=2000)
                                    page.wait_for_timeout(100)
                            except Exception:
                                pass
                    except Exception:
                        pass
                    # Campañas 'Otros' ya visibles sin hacer click adicional
                    otros = _extraer_campanas_otros(bloque)
                    campanas_extra.extend(otros)

                    # DEDUP: eliminar duplicados (mismo tipo + texto, case-insensitive)
                    seen = set()
                    campanas_extra = [c for c in campanas_extra if not (
                        f"{c.get('tipo','').lower()}|{c.get('texto','').lower()}" in seen 
                        or seen.add(f"{c.get('tipo','').lower()}|{c.get('texto','').lower()}")
                    )]

                    lineas_finales.append({
                        "DNI": dni,
                        "Nombre": nombre,
                        "Direccion": direccion,
                        "Seg Fijo": seg_fijo,
                        "Seg Movil": seg_movil,
                        "Paquete": paquete_tariff,
                        "Linea": num_linea,
                        "es_cima": es_cima,
                        "tiene_renove_mixto": tiene_rm,
                        "variante_renove": variante_renove,
                        "tiene_tv": tiene_tv,
                        "es_principal": es_principal,
                        "etiquetas": etiquetas,
                        "activo_desde": activo_desde,
                        # NUEVOS CAMPOS
                        "producto": producto_linea,
                        "estado_linea": estado_linea,
                        "permanencia": permanencia,
                        "permanencia_fecha": permanencia_fecha,
                        "consumo": consumo,
                        "venta_plazos": venta_plazos,
                        "campanas_extra": campanas_extra,
                        "notificacion_pack": notificacion_pack,
                    })

                # Siguiente página de líneas
                btn_siguiente = page.locator("button.ocs-pagination-next").first
                if (btn_siguiente.count() > 0
                        and not btn_siguiente.is_disabled()):
                    # Verificar si la PRIMERA línea de esta página ya se procesó (loop real)
                    if pagina_actual > 1 and primera_linea_pagina and primera_linea_pagina in lineas_vistas:
                        _log(f"  [Extracción] [!!] Loop detectado en página {pagina_actual} (línea {primera_linea_pagina} repetida). Saliendo.")
                        hay_mas_paginas = False
                    else:
                        _log("  [Extracción] -> Siguiente página de líneas...")
                        btn_siguiente.click(force=True, timeout=30000)
                        page.wait_for_timeout(2000)
                        pagina_actual += 1
                else:
                    hay_mas_paginas = False

            _reset_frozen()  # Pangea respondio — resetear contador
            return lineas_finales

        except PangeaDownError:
            raise  # Re-lanzar para que el worker pause 1.5h
        except Exception as e:
            _log(f"  [Extracción] [WARN] Error recuperable: {e}")
            if intento < max_intentos - 1:
                _log("  [Extracción] [RETRY] Recuperando sesión (1 F5)...")
                recuperado = False
                try:
                    page.reload(timeout=30000, wait_until="domcontentloaded")
                    # Detectar caída de Pangea tras F5 de recuperación
                    if "chrome-error" in page.url or "chromewebdata" in page.url:
                        raise PangeaDownError(f"Pangea caída durante recuperación: {page.url}")
                    page.wait_for_timeout(5000)  # 5s para proxies lentos (Angular init)
                    if page.locator("a.orange-box").is_visible(timeout=5000):
                        page.locator("a.orange-box").click()
                        page.wait_for_timeout(2000)
                    try:
                        abrir_nuevo_acto_comercial(page)
                    except Exception:
                        # Reintentar: otro F5 + click orange si estamos en marcas + NAC
                        page.reload(timeout=30000, wait_until="domcontentloaded")
                        page.wait_for_timeout(3000)
                        if page.locator("a.orange-box").is_visible(timeout=5000):
                            page.locator("a.orange-box").click()
                            page.wait_for_timeout(2000)
                        abrir_nuevo_acto_comercial(page)
                    _log("  [Extracción] [OK] Sesión recuperada tras F5")
                    recuperado = True
                except Exception as ex:
                    _log(f"  [Extracción] F5 falló: {ex}")
                if not recuperado:
                    _log("  [Extracción] [FAIL] No se pudo recuperar con F5")
            else:
                return []  # vacío -> worker marca error para reintentar


def logout_pangea(page) -> bool:
    """Cierra sesión en Pangea para liberar la sesión HTTP del servidor.
    Sin esto, browser.close() deja sesiones fantasma → MaxSessionsError.
    
    Estrategia (2 pasos):
    1. UI: hover sobre icono de perfil → esperar dropdown → click "Cerrar sesión"
    2. Fallback: navegar a /logout (SSO) + limpiar cookies/storage
    
    Retorna True si se hizo logout, False si no se pudo."""
    
    # ── Paso 1: Intentar logout vía UI (hover profile → dropdown → click) ──
    try:
        # Hover sobre el icono de perfil para abrir el dropdown
        page.hover(".profile-btn a", timeout=5000)
        
        # Esperar hasta 3s a que el dropdown sea visible
        try:
            page.locator(".profile-dropdown:not(.hidden)").wait_for(
                state="visible", timeout=3000
            )
            # Dropdown visible → click en "Cerrar sesión"
            page.locator("button.profile-dropdown--logout").click(timeout=3000)
            _log("  [Logout] UI: sesión cerrada vía dropdown")
            page.wait_for_timeout(2000)
            return True
        except Exception:
            # Dropdown no se abrió → fallback
            _log("  [Logout] UI: dropdown no visible tras 3s, usando fallback URL")
    except Exception:
        _log("  [Logout] UI: hover falló, usando fallback URL")
    
    # ── Paso 2: Fallback — URL de logout del SSO de Orange ──
    try:
        page.goto("https://pangea.orange.es/logout", timeout=10000)
        page.wait_for_timeout(2000)
        _log("  [Logout] Fallback: sesión cerrada vía /logout")
        return True
    except Exception:
        pass
    
    # ── Paso 3: Último recurso — limpiar cookies y storage ──
    try:
        page.context.clear_cookies()
        page.evaluate("localStorage.clear(); sessionStorage.clear();")
        _log("  [Logout] Fallback: cookies/storage limpiados")
        return True
    except Exception:
        pass
    
    return False

def verificar_sesion_valida(page: Page) -> bool:
    """Verifica si la sesión actual sigue siendo válida."""
    try:
        page.locator("button[title='Cambiar cliente']").wait_for(
            state="visible", timeout=5000
        )
        return True
    except Exception:
        return False