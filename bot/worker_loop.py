"""
bot/worker_loop.py — Worker Continuo para Producción (API-First, Battle-Hardened)
==================================================================================
Ejecuta 24/7 polling al backend de Next.js.

Flujo:
  1. GET /api/bot/next-dni -> siguiente DNI pendiente
  2. Extrae datos estructurados de Orange (via Playwright)
  3. POST /api/internal/bot-sync -> backend guarda
  4. GET /api/bot/command -> comandos del frontend (detener, pausar)
  5. Repite hasta que no haya DNIs o reciba comando de detener

Robustez (portada del bot Oratioo_CX):
  - Circuit breaker: 30 errores consecutivos -> reiniciar navegador completo
  - Reciclaje proactivo: cada 50 DNIs -> cerrar y reabrir navegador
  - Reintentos: hasta 3 por DNI antes de marcar como error definitivo
  - Manejo de PangeaDownError (pausa 1.5h) y MaxSessionsError (espera 5min)
  - Verificación de sesión antes de pedir cada DNI
  - Sin DNIs pendientes -> esperar con backoff, no crashear

USO:
  python worker_loop.py                          # Sin proxy
  python worker_loop.py --proxy --worker-id 0    # Con proxy #0 de proxies.txt
"""

import sys, os, time, re, json, threading, random, requests, signal, atexit
from pathlib import Path
from datetime import datetime
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv, find_dotenv

# Referencia global para cleanup en señales
_cleanup_ref = {"browser": None, "context": None, "page": None, "pw": None}
_shutting_down = False

def _graceful_shutdown(signum=None, frame=None):
    """Cierra el navegador limpiamente para liberar sesión en Pangea."""
    global _shutting_down
    if _shutting_down:
        return
    _shutting_down = True
    print(f"{login.WORKER_TAG} \n[SHUTDOWN] Cerrando navegador limpiamente...")
    for obj in [_cleanup_ref["page"], _cleanup_ref["context"], _cleanup_ref["browser"]]:
        try:
            if obj:
                obj.close()
        except:
            pass
    try:
        if _cleanup_ref["pw"]:
            _cleanup_ref["pw"].stop()
    except:
        pass
    print(f"{login.WORKER_TAG} [SHUTDOWN] Navegador cerrado. Sesión Pangea liberada.")

signal.signal(signal.SIGTERM, _graceful_shutdown)
signal.signal(signal.SIGINT, _graceful_shutdown)
atexit.register(_graceful_shutdown)

sys.path.insert(0, str(Path(__file__).parent))
import login  # needed for login.WORKER_TAG
from browser_setup import crear_contexto_espana
from login import (
    extraer_datos_cliente, realizar_login, seleccionar_marca_orange,
    abrir_nuevo_acto_comercial, manejar_cookies_flexible,
    verificar_sesion_valida, LoginError, MaxSessionsError, PangeaDownError,
    CaptchaBlockedError,
    _reset_frozen, _increment_frozen,
    logout_pangea,
)

# [!!] Buscar .env en CWD, bot/ o raiz del proyecto
_env_path = find_dotenv(usecwd=True)
if not _env_path:
    _env_path = str(Path(__file__).parent.parent / ".env")
load_dotenv(_env_path)
print(f"{login.WORKER_TAG} [WORKER] .env cargado desde: {_env_path}")

ORANGE_URL = "https://pangea.orange.es/"
BACKEND_URL = os.getenv("BOT_API_URL", "http://localhost:3000")
BOT_API_KEY = os.getenv("BOT_API_KEY")
if not BOT_API_KEY:
    raise RuntimeError("[WORKER] [!!] CRITICO: BOT_API_KEY no definida en .env")
WATCHDOG_TIMEOUT = 40
RECYCLE_EVERY = 0     # Reciclaje DESACTIVADO (Pangea mantiene sesiones pegadas)
MAX_RETRIES = 3     # Reintentos por DNI antes de error definitivo


# ===========================================
# WATCHDOG
# ===========================================
class WatchdogTimeout(Exception): pass

class Watchdog:
    def __init__(self, label, timeout=WATCHDOG_TIMEOUT):
        self.label = label
        self.timeout = timeout
        self._timer = None
        self._timed_out = False

    def _on_timeout(self):
        self._timed_out = True
        print(f"{login.WORKER_TAG}   [WATCHDOG] {self.label}: TIMEOUT {self.timeout}s")

    def __enter__(self):
        self._timer = threading.Timer(self.timeout, self._on_timeout)
        self._timer.daemon = True
        self._timer.start()
        return self

    def __exit__(self, *a):
        if self._timer: self._timer.cancel()
        return self._timed_out


# ===========================================
# BACKEND API
# ===========================================
def api_get(path):
    try:
        r = requests.get(f"{BACKEND_URL}{path}", headers={"x-bot-api-key": BOT_API_KEY}, timeout=10)
        return r.json() if r.ok else None
    except:
        return None

def api_post(path, data):
    try:
        r = requests.post(f"{BACKEND_URL}{path}", json=data, headers={
            "Content-Type": "application/json",
            "x-bot-api-key": BOT_API_KEY,
        }, timeout=15)
        return r.ok
    except:
        return False

def api_patch(path, data):
    try:
        r = requests.patch(f"{BACKEND_URL}{path}", json=data, headers={
            "Content-Type": "application/json",
            "x-bot-api-key": BOT_API_KEY,
        }, timeout=10)
        return r.ok
    except:
        return False

def touch_dni(id_cliente: str):
    """Actualiza updated_at para que el rescate no lo toque."""
    api_patch("/api/bot/touch", {"id_cliente": id_cliente})

def next_dni():
    """Obtiene el siguiente DNI pendiente. Retorna el id_cliente o None."""
    data = api_get("/api/bot/next-dni")
    if not data:
        return None
    dni = data.get("dni")
    return dni if dni else None

def check_command(machine_name: str = "localhost"):
    """Retorna lista de comandos como objetos {comando, parametros}."""
    data = api_get(f"/api/bot/command?maquina={machine_name}")
    if not data:
        return []
    cmds = data.get("comandos", [])
    result = []
    for c in cmds:
        if isinstance(c, dict):
            result.append(c)
        elif isinstance(c, str):
            result.append({"comando": c, "parametros": {}})
    return result

def sync_result(id_cliente, datos, estado="completado"):
    """Sincroniza resultado con el backend."""
    return api_post("/api/internal/bot-sync", {
        "id_cliente": id_cliente,
        "datos": datos,
        "estado": estado,
    })


# ===========================================
# EXTRACCIÓN (con reintentos y manejo de errores)
# ===========================================
def extraer_datos_estructurados(page, dni):
    """Extrae datos del cliente desde Pangea. Retorna dict con estado."""
    lineas_basicas = extraer_datos_cliente(page, dni)
    if not lineas_basicas:
        return {"estado": "error", "error": "sin_datos"}

    primera = lineas_basicas[0]

    # Detectar "no es cliente" explícito (incluye PYME, GGCC, MAX LINEAS)
    if primera.get("Nombre") in ("NO ES CLIENTE", "CLIENTE PYME", "CLIENTE GGCC", "CLIENTE MAX LINEAS"):
        return {"estado": "no_cliente"}

    # Detectar cliente ya procesado (búsqueda por teléfono encontró DNI existente)
    if primera.get("Nombre") == "YA_PROCESADO" or primera.get("_skip"):
        return {"estado": "ya_procesado", "dni_real": primera.get("DNI", dni)}

    # Detectar error de conexión
    if primera.get("_error_conexion"):
        return {"estado": "error_conexion", "error": "Pangea no responde"}

    # Si todas las filas tienen N/A, marcar como error para reintento
    todas_na = all(
        f.get("Nombre", "N/A") in ("N/A", "") or f.get("Nombre", "") == f.get("Linea", "")
        for f in lineas_basicas
    )
    if todas_na and len(lineas_basicas) > 0:
        return {"estado": "error", "error": "Sin datos (N/A)"}

    # Detectar errores especiales de Pangea
    if primera.get("Nombre") == "ERROR CAMPANAS":
        return {"estado": "sin_datos", "error": "Sin servicios activos en Pangea"}

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
            "producto": lb.get("producto", "N/A"),
            "paquete": lb.get("Paquete", "N/A"),
            "estado_detallado": lb.get("estado_linea", []),
            "permanencia": lb.get("permanencia", "N/A"),
            "permanencia_fecha": lb.get("permanencia_fecha", ""),
            "consumo": lb.get("consumo", "N/A"),
            "venta_plazos": lb.get("venta_plazos", "N/A"),
            "vap": lb.get("venta_plazos", "N/A"),
            "campanas_extra": lb.get("campanas_extra", []),
        }

        # Estado de línea legado (para compatibilidad con frontend)
        estados_raw = lb.get("estado_linea", [])
        if estados_raw:
            activos = [e.get("texto", "") for e in estados_raw if e.get("activo")]
            estado_resumen = ", ".join(activos) if activos else "Activa"
        else:
            estado_resumen = "N/A"
        linea["estado_linea_resumen"] = estado_resumen

        # Estado legacy
        linea["estado"] = _estado_detallado_a_legado(estados_raw)

        lineas_detalladas.append(linea)

    return {
        "estado": "completado",
        "header": header,
        "lineas": lineas_detalladas,
        "cima_global": cima_global,
    }


def _estado_detallado_a_legado(estados: list) -> dict:
    """Convierte el formato [{texto,color,activo}] al legacy {hotline:bool, ...}."""
    result = {"hotline": False, "suspendida": False, "impago": False, "fraude": False}
    if not estados:
        return result
    for e in estados:
        txt = e.get("texto", "").lower()
        activo = e.get("activo", False)
        if "hotline" in txt: result["hotline"] = activo
        if "suspendida" in txt: result["suspendida"] = activo
        if "impago" in txt: result["impago"] = activo
        if "fraude" in txt: result["fraude"] = activo
    return result


# ===========================================
# LOGIN (con manejo de MaxSessions y PangeaDown)
# ===========================================
def login_loop(page, cred_user='', cred_pass='', dni_touch: str = None, pw=None, proxy_conf=None, reconnect=False):
    """Login con reintentos, manejo de MaxSessions y PangeaDown.
    reconnect=True: navega directo a /qualification (re-login en caliente, salta página de marcas)."""
    max_reintentos = 10
    errores_conexion = 0
    _max_sessions_hits = 0  # contador de MaxSessionsError consecutivos
    target_url = f"{ORANGE_URL}qualification" if reconnect else ORANGE_URL

    for intento in range(max_reintentos):
        if dni_touch:
            touch_dni(dni_touch)
        try:
            page.goto(target_url, timeout=90000)
            manejar_cookies_flexible(page)
            realizar_login(page, cred_user, cred_pass)
            seleccionar_marca_orange(page)
            abrir_nuevo_acto_comercial(page)
            _reset_frozen()
            errores_conexion = 0
            _max_sessions_hits = 0
            print(f"{login.WORKER_TAG} [LOGIN] OK (intento {intento+1})")
            return True
        except MaxSessionsError:
            _max_sessions_hits += 1
            print(f"{login.WORKER_TAG} [SESION] Maximo de sesiones (hit {_max_sessions_hits}) — cerrando navegador...")
            # Intentar logout para liberar sesión en servidor Pangea
            try: logout_pangea(page)
            except: pass
            try: page.close()
            except: pass
            try: context.close() if 'context' in dir() else None
            except: pass
            try: browser.close() if 'browser' in dir() else None
            except: pass
            # Esperar a que expiren sesiones en Pangea
            wait_min = min(5 * _max_sessions_hits, 15)  # 5, 10, 15 min...
            print(f"{login.WORKER_TAG} [SESION] Esperando {wait_min} min para que expiren sesiones...")
            time.sleep(wait_min * 60)
            # Recrear navegador
            if pw and proxy_conf is not None:
                try:
                    browser, context, page = crear_navegador(pw, proxy_conf)
                    _cleanup_ref["browser"] = browser
                    _cleanup_ref["context"] = context
                    _cleanup_ref["page"] = page
                    _cleanup_ref["pw"] = pw
                except Exception as e:
                    print(f"{login.WORKER_TAG} [SESION] Error recreando navegador: {e}")
                    continue
            intento = 0
            continue
        except LoginError as e:
            # Si es fallo de seleccion de marca, cerrar navegador y reiniciar desde cero
            if "seleccionar marca" in str(e).lower():
                print(f"{login.WORKER_TAG} [LOGIN] Fallo seleccion de marca — reiniciando navegador...")
                try: page.close()
                except: pass
                try: context.close()
                except: pass
                try: browser.close()
                except: pass
                time.sleep(5)
                if pw and proxy_conf is not None:
                    browser, context, page = crear_navegador(pw, proxy_conf)
                    _cleanup_ref["browser"] = browser
                    _cleanup_ref["context"] = context
                    _cleanup_ref["page"] = page
                    _cleanup_ref["pw"] = pw
                intento = 0
                continue
            # Otro LoginError normal: reintentar
            print(f"{login.WORKER_TAG} [LOGIN] Fallo {intento+1}: {e}")
            time.sleep(5)
            intento = 0
            continue
        except CaptchaBlockedError:
            print(f"{login.WORKER_TAG} [CAPTCHA] Bloqueo detectado — esperando 60s y recargando...")
            time.sleep(60)
            try: page.goto(target_url, timeout=30000)
            except: pass
            intento = 0
            continue
        except Exception as e:
            err_str = str(e)
            # Detectar caída de Pangea por mensaje de error (rápido)
            if any(kw in err_str for kw in ['ERR_TIMED_OUT', 'ERR_CONNECTION', 'ERR_NAME_NOT_RESOLVED']):
                errores_conexion += 1
                print(f"{login.WORKER_TAG} [CAIDA] Pangea no responde ({errores_conexion}/5): {err_str[:80]}")
                if errores_conexion >= 5:
                    raise PangeaDownError(f"Pangea caida tras {errores_conexion} intentos")
                time.sleep(10)
                intento = 0
                continue
            
            # Detectar caída de Pangea por #main-frame-error (DOM)
            try:
                frame_error = page.locator("#main-frame-error")
                if frame_error.count() > 0 and frame_error.first.is_visible():
                    errores_conexion += 1
                    print(f"{login.WORKER_TAG} [CAIDA] Pangea no responde (main-frame-error) ({errores_conexion}/5)")
                    if errores_conexion >= 5:
                        raise PangeaDownError(f"Pangea caida tras {errores_conexion} intentos")
                    time.sleep(10)
                    intento = 0
                    continue
            except Exception:
                pass

            print(f"{login.WORKER_TAG} [LOGIN] Fallo {intento+1}: {e}")
            if intento % 5 == 0:
                print(f"{login.WORKER_TAG} [LOGIN] Reintentando...")
            try:
                page.goto(target_url, timeout=30000)
            except:
                pass
            time.sleep(60)

    return False


# ===========================================
# PROXIES
# ===========================================
def cargar_proxies():
    """Carga todos los proxies desde proxies.txt (raiz del proyecto)."""
    for candidate in [
        Path(__file__).parent.parent / "proxies.txt",
        Path(__file__).parent / "proxies.txt",
    ]:
        if candidate.exists():
            proxies = []
            for l in candidate.read_text().split("\n"):
                l = l.strip()
                if l and not l.startswith("#"):
                    p = l.split(":")
                    if len(p) >= 2:
                        proxy = {"server": f"http://{p[0]}:{p[1]}"}
                        if len(p) >= 4:
                            proxy["username"] = p[2]
                            proxy["password"] = p[3]
                        proxies.append(proxy)
            return proxies, str(candidate)
    return [], "no encontrado"


# ===========================================
# GESTIÓN DE NAVEGADOR (crear, reciclar, destruir)
# ===========================================
def crear_navegador(pw, proxy_conf):
    """Crea browser + contexto + página con stealth."""
    browser, context = crear_contexto_espana(pw, proxy_config=proxy_conf)
    page = context.new_page()
    try:
        from playwright_stealth import stealth_sync
        stealth_sync(page)
    except:
        pass
    return browser, context, page


def destruir_navegador(browser, context, page, pw):
    """Cierra limpiamente browser, contexto, página y playwright."""
    for obj in [page, context, browser]:
        try:
            obj.close()
        except:
            pass
    try:
        pw.stop()
    except:
        pass


# ===========================================
# MAIN LOOP
# ===========================================
def main():
    global _cleanup_ref
    use_proxy = "--proxy" in sys.argv

    # Worker ID (para proxies rotativos)
    worker_id = 0
    if "--worker-id" in sys.argv:
        idx = sys.argv.index("--worker-id")
        worker_id = int(sys.argv[idx + 1])

    # Tag para logs [W{N}]
    W = f"[W{worker_id}]"
    login.WORKER_TAG = W

    # Credenciales Pangea (desde coordinator o .env)
    cred_user = os.getenv("ORANGE_USER", "")
    cred_pass = os.getenv("ORANGE_PASS", "")
    if "--credential-user" in sys.argv:
        idx = sys.argv.index("--credential-user")
        cred_user = sys.argv[idx + 1]
    if "--credential-pass" in sys.argv:
        idx = sys.argv.index("--credential-pass")
        cred_pass = sys.argv[idx + 1]

    # Nombre de máquina (para filtrar comandos)
    machine_name = "localhost"
    if "--machine" in sys.argv:
        idx = sys.argv.index("--machine")
        machine_name = sys.argv[idx + 1]

    # Max DNIs (0 = ilimitado)
    max_dnis = 0
    if "--max-dnis" in sys.argv:
        idx = sys.argv.index("--max-dnis")
        max_dnis = int(sys.argv[idx + 1])

    # Cargar proxy
    proxy_conf = None
    if use_proxy:
        proxies, pf_path = cargar_proxies()
        if proxies:
            idx = worker_id % len(proxies)
            proxy_conf = proxies[idx]
            print(f"{login.WORKER_TAG} [START] {len(proxies)} proxies cargados de {pf_path}")
            print(f"{login.WORKER_TAG} [START] Worker {worker_id} usando proxy #{idx}: {proxy_conf['server']}")
        else:
            print(f"{login.WORKER_TAG} [START] [!!] No se encontraron proxies en {pf_path}")

    print(f"{login.WORKER_TAG} [START] Bot Orange - Backend: {BACKEND_URL}")
    print(f"{login.WORKER_TAG} [START] Maquina: {machine_name} | Worker ID: {worker_id}")
    print(f"{login.WORKER_TAG} [START] Proxy: {proxy_conf['server'] if proxy_conf else 'NINGUNO'}")
    print(f"{login.WORKER_TAG} [START] Reciclaje cada {RECYCLE_EVERY} DNIs | Circuit breaker: 30 errores")
    print(f"{login.WORKER_TAG} [START] Ctrl+C para detener")

    # ── Inicializar Playwright ──
    pw = sync_playwright().start()
    browser, context, page = crear_navegador(pw, proxy_conf)
    _cleanup_ref = {"browser": browser, "context": context, "page": page, "pw": pw}

    # ── Login inicial ──
    while True:
        try:
            if login_loop(page, cred_user, cred_pass, pw=pw, proxy_conf=proxy_conf):
                break  # Login exitoso
            print(f"{login.WORKER_TAG} [CRIT] No se pudo iniciar sesion. Abortando.")
            destruir_navegador(browser, context, page, pw)
            _cleanup_ref = {"browser": None, "context": None, "page": None, "pw": None}
            return
        except PangeaDownError:
            print(f"{login.WORKER_TAG} [CAIDA] Pangea no disponible en login inicial. Pausando 1.5 horas...")
            time.sleep(5400)
            # Recrear navegador tras la pausa
            destruir_navegador(browser, context, page, pw)
            browser, context, page = crear_navegador(pw, proxy_conf)
            _cleanup_ref = {"browser": browser, "context": context, "page": page, "pw": pw}
    # Refrescar referencias (login_loop pudo recrear navegador por MaxSessionsError)
    browser = _cleanup_ref["browser"]
    context = _cleanup_ref["context"]
    page = _cleanup_ref["page"]

    # Bloquear recursos innecesarios para acelerar (imagenes, media, fonts, ayuda.orange.es)
    def _bloquear_recursos(route):
        try:
            if route.request.resource_type in ("image", "media", "font"):
                route.abort()
            elif "ayuda.orange.es" in route.request.url:
                route.abort()
            else:
                route.continue_()
        except Exception:
            try: route.continue_()
            except: pass
    page.route("**/*", _bloquear_recursos)
    print(f"{login.WORKER_TAG} [LOCK] Bloqueo de recursos activado (imagenes, media, fonts, ayuda)")

    procesados = 0
    no_clientes = 0
    errores = 0
    recycle_count = 0
    errores_consecutivos = 0
    sin_trabajo = 0
    detenido = False

    # ── Loop principal ──
    while not detenido:
        # === COMANDOS DEL FRONTEND ===
        for cmd_obj in check_command(machine_name):
            cmd = cmd_obj.get("comando", "") if isinstance(cmd_obj, dict) else cmd_obj
            params = cmd_obj.get("parametros", {}) if isinstance(cmd_obj, dict) else {}
            print(f"{login.WORKER_TAG} [CMD] Recibido: {cmd} {params}")
            if cmd == "detener":
                detenido = True
                break
            if cmd == "pausar":
                pausa = params.get("segundos", 10)
                print(f"{login.WORKER_TAG} [CMD] Pausado. Esperando {pausa}s...")
                time.sleep(pausa)

        if detenido:
            break

        # === VERIFICAR SESIÓN ANTES DE PEDIR DNI ===
        if not verificar_sesion_valida(page):
            print(f"{login.WORKER_TAG} [RETRY] Sesion invalida, relogueando antes de pedir DNI...")
            # ⚠️ Quitar bloqueo de recursos para que login pueda cargar imágenes (logo Orange, etc.)
            try:
                page.unroute("**/*")
            except Exception:
                pass
            try:
                if not login_loop(page, cred_user, cred_pass, reconnect=True):
                    print(f"{login.WORKER_TAG} [CRIT] Re-login fallo persistente. Pausa 5 min...")
                    time.sleep(300)
                    continue
                # Refrescar referencias (login_loop pudo recrear navegador por MaxSessionsError)
                page = _cleanup_ref["page"]
                # ✅ Re-aplicar bloqueo tras login exitoso
                page.route("**/*", _bloquear_recursos)
            except PangeaDownError:
                print(f"{login.WORKER_TAG} [CAIDA] Pangea no disponible. Pausando 1.5 horas...")
                time.sleep(5400)
                continue

        # === SIGUIENTE DNI ===
        dni_data = next_dni()
        if not dni_data:
            # ⚡ NO cerrar sesión — esperar a que lleguen más DNIs
            # El browser sigue abierto, la sesión de Pangea se mantiene viva
            # (cerrar sin logout deja sesiones fantasma → MaxSessionsError)
            if sin_trabajo == 0:
                print(f"{login.WORKER_TAG} [{datetime.now().strftime('%H:%M:%S')}] Sin DNIs pendientes. Esperando...")
            sin_trabajo += 1
            time.sleep(5)
            continue
        sin_trabajo = 0

        # Parsear DNI
        dni = dni_data.split("_")[-1] if "_" in dni_data else dni_data
        id_cliente = dni_data if "_" in dni_data else f"DNI_{dni}"
        if re.match(r'^[XYZ]', dni): id_cliente = f"NIE_{dni}"
        elif re.match(r'^[A-Z]', dni): id_cliente = f"NIF_{dni}"

        print(f"{login.WORKER_TAG} \n{'='*60}")
        print(f"{login.WORKER_TAG} [{datetime.now().strftime('%H:%M:%S')}] DNI: {dni} ({procesados} OK | {no_clientes} NC | {errores} ERR)")

        # Touch: mantener vivo el DNI
        touch_dni(id_cliente)

        # Pausa aleatoria (comportamiento humano, evita deteccion)
        page.wait_for_timeout(random.randint(500, 1000))

        # DEBUG: estado de página
        try:
            current_url = page.url
            if "pangea.orange.es" not in current_url:
                print(f"{login.WORKER_TAG} [ALARMA] URL externa: {current_url[:100]}")
                try:
                    page.go_back()
                    page.wait_for_timeout(3000)
                except:
                    pass
        except:
            pass

        # === PROCESAR DNI (con reintentos) ===
        exito = False
        ultimo_error = None

        for reintento in range(MAX_RETRIES):
            try:
                with Watchdog(f"dni-{dni}"):
                    datos = extraer_datos_estructurados(page, dni)

                estado = datos.get("estado", "error")

                if estado == "no_cliente":
                    no_clientes += 1
                    sync_result(id_cliente, datos, "no_cliente")
                    print(f"{login.WORKER_TAG}   -> NO CLIENTE")
                    exito = True
                    errores_consecutivos = 0
                    break

                if estado == "sin_datos":
                    # Cliente existe en Pangea pero sin servicios activos ahora
                    no_clientes += 1
                    sync_result(id_cliente, datos, "sin_datos")
                    print(f"{login.WORKER_TAG}   -> SIN DATOS (sin servicios activos en Pangea)")
                    exito = True
                    errores_consecutivos = 0
                    break

                if estado == "ya_procesado":
                    no_clientes += 1
                    sync_result(id_cliente, datos, "no_cliente")
                    print(f"{login.WORKER_TAG}   -> YA PROCESADO (DNI={datos.get('dni_real', '?')})")
                    exito = True
                    errores_consecutivos = 0
                    break

                if estado == "error_conexion":
                    raise PangeaDownError("Pangea no responde en extraccion")

                if estado == "error":
                    # Error recuperable (sin datos, N/A) -> reintentar
                    ultimo_error = datos.get("error", "desconocido")
                    if reintento < MAX_RETRIES - 1:
                        print(f"{login.WORKER_TAG}   -> ERROR recuperable ({ultimo_error}), reintento {reintento+2}/{MAX_RETRIES}")
                        touch_dni(id_cliente)
                        time.sleep(3)
                        continue
                    else:
                        # Error definitivo
                        errores += 1
                        errores_consecutivos += 1
                        sync_result(id_cliente, {"estado": "error", "error": ultimo_error, "reintentos": MAX_RETRIES}, "error")
                        print(f"{login.WORKER_TAG}   -> ERROR definitivo: {ultimo_error}")
                        exito = True  # No reintentar más, ya se guardó como error
                        break

                if estado == "completado":
                    # Enviar al backend
                    if sync_result(id_cliente, datos):
                        print(f"{login.WORKER_TAG}   -> OK ({len(datos.get('lineas', []))} lineas, CIMA={datos.get('cima_global')})")
                        procesados += 1
                        recycle_count += 1
                        errores_consecutivos = 0
                        exito = True
                    else:
                        print(f"{login.WORKER_TAG}   -> ERROR al sincronizar con backend")
                        errores += 1
                        errores_consecutivos += 1
                        exito = True  # No reintentar, el backend falló
                    break

            except WatchdogTimeout:
                print(f"{login.WORKER_TAG}   -> TIMEOUT - reintentando")
                errores += 1
                errores_consecutivos += 1
                if reintento < MAX_RETRIES - 1:
                    touch_dni(id_cliente)
                    try:
                        page.reload(timeout=30000)
                    except:
                        pass
                else:
                    sync_result(id_cliente, {"estado": "error", "error": "timeout"}, "error")
                continue

            except PangeaDownError as e:
                print(f"{login.WORKER_TAG} [CAIDA] {e} — pausando 1.5 horas")
                time.sleep(5400)
                print(f"{login.WORKER_TAG} [CAIDA] Reanudando. Recreando navegador...")
                destruir_navegador(browser, context, page, pw)
                pw = sync_playwright().start()
                browser, context, page = crear_navegador(pw, proxy_conf)
                _cleanup_ref = {"browser": browser, "context": context, "page": page, "pw": pw}
                if not login_loop(page, cred_user, cred_pass, reconnect=True):
                    detenido = True
                errores_consecutivos = 0
                break  # Salir del loop de reintentos

            except Exception as e:
                print(f"{login.WORKER_TAG}   -> ERROR: {e}")
                errores += 1
                errores_consecutivos += 1
                ultimo_error = str(e)
                if reintento < MAX_RETRIES - 1:
                    touch_dni(id_cliente)
                    try:
                        page.reload(timeout=30000)
                    except:
                        pass
                    time.sleep(2)
                else:
                    sync_result(id_cliente, {"estado": "error", "error": ultimo_error[:200], "reintentos": MAX_RETRIES}, "error")
                continue

        # === POST-PROCESAMIENTO ===

        # Circuit breaker: 30 errores consecutivos -> reiniciar navegador
        if errores_consecutivos >= 30:
            print(f"{login.WORKER_TAG} [BREAKER] {errores_consecutivos} errores consecutivos. Reiniciando navegador...")
            destruir_navegador(browser, context, page, pw)
            _cleanup_ref = {"browser": None, "context": None, "page": None, "pw": None}
            time.sleep(15)
            try:
                pw = sync_playwright().start()
                browser, context, page = crear_navegador(pw, proxy_conf)
                _cleanup_ref = {"browser": browser, "context": context, "page": page, "pw": pw}
                if login_loop(page, cred_user, cred_pass, reconnect=True):
                    print(f"{login.WORKER_TAG} [BREAKER] Navegador reiniciado OK")
                    errores_consecutivos = 0
                else:
                    print(f"{login.WORKER_TAG} [BREAKER] [CRIT] No se pudo reiniciar. Pausa 2 min...")
                    time.sleep(120)
            except Exception as breaker_err:
                print(f"{login.WORKER_TAG} [BREAKER] Error: {breaker_err}. Pausa 2 min...")
                time.sleep(120)
            continue

        # Circuit breaker light: 5 errores de conexion -> pausa 1.5h
        if errores_consecutivos >= 5:
            print(f"{login.WORKER_TAG} [CAIDA] {errores_consecutivos} errores de conexion seguidos — pausando 1.5 horas")
            time.sleep(5400)
            print(f"{login.WORKER_TAG} [CAIDA] Reanudando tras pausa...")
            destruir_navegador(browser, context, page, pw)
            _cleanup_ref = {"browser": None, "context": None, "page": None, "pw": None}
            pw = sync_playwright().start()
            browser, context, page = crear_navegador(pw, proxy_conf)
            _cleanup_ref = {"browser": browser, "context": context, "page": page, "pw": pw}
            if not login_loop(page, cred_user, cred_pass, reconnect=True):
                detenido = True
            errores_consecutivos = 0
            continue

        # Reciclaje proactivo cada 50 DNIs
        # [SEGURIDAD] Solo reciclar si RECYCLE_EVERY > 0 (0 = desactivado)
        if RECYCLE_EVERY > 0 and recycle_count >= RECYCLE_EVERY:
            print(f"{login.WORKER_TAG} [RECYCLE] {recycle_count} DNIs procesados. Reciclando navegador...")
            recycle_count = 0
            destruir_navegador(browser, context, page, pw)
            _cleanup_ref = {"browser": None, "context": None, "page": None, "pw": None}
            time.sleep(5)
            pw = sync_playwright().start()
            browser, context, page = crear_navegador(pw, proxy_conf)
            _cleanup_ref = {"browser": browser, "context": context, "page": page, "pw": pw}
            if not login_loop(page, cred_user, cred_pass, reconnect=True):
                detenido = True
                break
            print(f"{login.WORKER_TAG} [RECYCLE] Navegador reciclado OK")
            continue

        # Verificar sesion cada 25 DNIs (procesados o errores)
        if (procesados + errores) > 0 and (procesados + errores) % 25 == 0:
            if not verificar_sesion_valida(page):
                print(f"{login.WORKER_TAG} [RETRY] Sesion expirada, relogueando...")
                try:
                    page.goto(f"{ORANGE_URL}qualification", timeout=30000)
                    if not login_loop(page, cred_user, cred_pass, reconnect=True):
                        print(f"{login.WORKER_TAG} [CRIT] Re-login fallo.")
                except:
                    pass

        # Límite de DNIs
        if max_dnis > 0 and (procesados + errores) >= max_dnis:
            print(f"{login.WORKER_TAG} [LIMIT] Limite alcanzado ({max_dnis} DNIs). Pausa 60s y reinicio contadores...")
            time.sleep(60)
            procesados = 0
            errores = 0

    # ── CLEANUP ──
    destruir_navegador(browser, context, page, pw)
    _cleanup_ref = {"browser": None, "context": None, "page": None, "pw": None}
    print(f"{login.WORKER_TAG} \n[FIN] {procesados} OK | {no_clientes} NC | {errores} ERR")


if __name__ == "__main__":
    main()