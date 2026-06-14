"""
bot/worker_loop.py — Worker Continuo para Producción
=====================================================
Ejecuta 24/7 polling al backend de Next.js.

Flujo:
  1. GET /api/bot/next-dni → siguiente DNI pendiente
  2. Extrae datos estructurados de Orange
  3. POST /api/internal/bot-sync → backend guarda
  4. GET /api/bot/command → comandos del frontend (iniciar, pausar, detener)
  5. Repite hasta que no haya DNIs o reciba comando de detener

USO:
  python worker_loop.py          # Sin proxy
  python worker_loop.py --proxy  # Con proxy de proxies.txt
"""

import sys, os, time, re, json, threading, requests
from pathlib import Path
from datetime import datetime
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))
from browser_setup import crear_contexto_espana
from login import (
    extraer_datos_cliente, realizar_login, seleccionar_marca_orange,
    abrir_nuevo_acto_comercial, manejar_cookies_flexible
)

load_dotenv(Path(__file__).parent.parent / '.env')

ORANGE_URL = "https://pangea.orange.es/"
BACKEND_URL = os.getenv("BOT_API_URL", "http://localhost:3000")
BOT_API_KEY = os.getenv("BOT_API_KEY", "oratioo-bot-internal-key")
WATCHDOG_TIMEOUT = 40

# ═══════════════════════════════════════════
# WATCHDOG
# ═══════════════════════════════════════════
class WatchdogTimeout(Exception): pass

class Watchdog:
    def __init__(self, label, timeout=WATCHDOG_TIMEOUT):
        self.label = label
        self.timeout = timeout
        self._timer = None
        self._timed_out = False

    def _on_timeout(self):
        self._timed_out = True
        print(f"  [WATCHDOG] {self.label}: TIMEOUT {self.timeout}s")

    def __enter__(self):
        self._timer = threading.Timer(self.timeout, self._on_timeout)
        self._timer.daemon = True
        self._timer.start()
        return self

    def __exit__(self, *a):
        if self._timer: self._timer.cancel()
        return self._timed_out


# ═══════════════════════════════════════════
# BACKEND API
# ═══════════════════════════════════════════
def api_get(path):
    r = requests.get(f"{BACKEND_URL}{path}", headers={"x-bot-api-key": BOT_API_KEY}, timeout=10)
    return r.json() if r.ok else None

def api_post(path, data):
    r = requests.post(f"{BACKEND_URL}{path}", json=data, headers={
        "Content-Type": "application/json",
        "x-bot-api-key": BOT_API_KEY,
    }, timeout=15)
    return r.ok

def api_patch(path, data):
    r = requests.patch(f"{BACKEND_URL}{path}", json=data, headers={
        "Content-Type": "application/json",
        "x-bot-api-key": BOT_API_KEY,
    }, timeout=10)
    return r.ok

def touch_dni(id_cliente: str):
    """Actualiza updated_at para que el rescate no lo toque."""
    api_patch("/api/bot/touch", {"id_cliente": id_cliente})

def next_dni():
    data = api_get("/api/bot/next-dni")
    return data.get("dni") if data else None

def check_command(machine_name: str = "localhost"):
    """Retorna lista de comandos como objetos {comando, parametros}."""
    data = api_get(f"/api/bot/command?maquina={machine_name}")
    if not data:
        return []
    # comandos ahora vienen como objetos, no strings
    cmds = data.get("comandos", [])
    result = []
    for c in cmds:
        if isinstance(c, dict):
            result.append(c)
        elif isinstance(c, str):
            # compatibilidad hacia atrás
            result.append({"comando": c, "parametros": {}})
    return result

def sync_result(id_cliente, datos, estado="completado"):
    return api_post("/api/internal/bot-sync", {"id_cliente": id_cliente, "datos": datos, "estado": estado})


# ═══════════════════════════════════════════
# EXTRACCIÓN
# ═══════════════════════════════════════════
def parse_estado_linea(texto):
    # Detecta estados activos (con color no-gris) desde el DOM
    return {"hotline":"Hotline" in texto, "suspendida":"Suspendida" in texto,
            "impago":"Impago" in texto, "fraude":"Fraude" in texto}

def estado_detallado_a_legado(estados: list) -> dict:
    """Convierte el formato de login.py [{texto,color,activo}] al formato legacy
    que espera el frontend {hotline:bool, suspendida:bool, ...}"""
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

def extraer_campo(texto, patron):
    m = re.search(patron, texto)
    return m.group(1).strip() if m else "N/A"

def extraer_datos_estructurados(page, dni):
    lineas_basicas = extraer_datos_cliente(page, dni)
    if not lineas_basicas: return {"estado":"error","error":"sin_datos"}
    primera = lineas_basicas[0]
    if primera.get("Nombre") == "NO ES CLIENTE": return {"estado":"no_cliente"}

    header = {"nombre": primera.get("Nombre","N/A"), "dni": primera.get("DNI",dni),
              "direccion": primera.get("Direccion","N/A"), "paquete": primera.get("Paquete","N/A")}
    cima_global = any(l.get("es_cima") for l in lineas_basicas)

    lineas_detalladas = []
    for lb in lineas_basicas:
        linea = {"numero": lb.get("Linea","N/A"), "etiquetas": lb.get("etiquetas",[]),
                 "es_cima": lb.get("es_cima",False), "tiene_renove": lb.get("tiene_renove_mixto",False),
                 "variante_renove": lb.get("variante_renove","N/A"), "tiene_tv": lb.get("tiene_tv",False),
                 "es_principal": lb.get("es_principal",False), "activo_desde": lb.get("activo_desde","N/A"),
                 # NUEVOS CAMPOS desde login.py
                 "producto": lb.get("producto", "N/A"),
                 "estado_detallado": lb.get("estado_linea", []),
                 "permanencia": lb.get("permanencia", "N/A"),
                 "consumo": lb.get("consumo", "N/A"),
                 "venta_plazos": lb.get("venta_plazos", "N/A"),
                 "vap": lb.get("venta_plazos", "N/A"),  # alias para frontend legacy
                 "campanas_extra": lb.get("campanas_extra", []),
        }
        # Fallback: extracción directa del DOM si login.py no capturó o para compatibilidad
        try:
            bloque = page.locator(f".client-tariff-flex:has-text('{linea['numero']}')")
            if bloque.count()>0:
                b=bloque.first
                # Usar login.py para estado si está disponible (tiene info de color)
                if not linea.get("estado_detallado"):
                    try: linea["estado"]=parse_estado_linea(b.locator("ocs-line-status").inner_text().strip())
                    except: pass
                else:
                    linea["estado"]=estado_detallado_a_legado(linea["estado_detallado"])
                # Detalles (consumo, permanencia, VAP) como fallback
                try:
                    d=b.locator("ocs-line-details").inner_text().strip()
                    if linea.get("consumo","N/A")=="N/A": linea["consumo"]=extraer_campo(d,r'Consumo\s+([^\n]+)')
                    if linea.get("permanencia","N/A")=="N/A": linea["permanencia"]=extraer_campo(d,r'Permanencia\s+([^\n]+)')
                    if not linea.get("vap"): linea["vap"]=extraer_campo(d,r'Venta a Plazos\s*\n?\s*([^\n]+)')
                except: pass
        except: pass
        lineas_detalladas.append(linea)

    return {"estado":"completado","header":header,"lineas":lineas_detalladas,"cima_global":cima_global}


# ═══════════════════════════════════════════
# LOGIN
# ═══════════════════════════════════════════
def login_loop(page, cred_user='', cred_pass='', dni_touch: str = None):
    max_reintentos = 10
    for intento in range(max_reintentos):
        # Mantener vivo el DNI mientras reintentamos login
        if dni_touch:
            touch_dni(dni_touch)
        try:
            page.goto(ORANGE_URL, timeout=90000)
            manejar_cookies_flexible(page)
            realizar_login(page, cred_user, cred_pass)
            seleccionar_marca_orange(page)
            abrir_nuevo_acto_comercial(page)
            print(f"[LOGIN] OK (intento {intento+1})")
            return True
        except Exception as e:
            print(f"[LOGIN] Fallo {intento+1}: {e}")
            if intento % 5 == 0: print(f"[LOGIN] Reintentando...")
            try: page.goto(ORANGE_URL, timeout=30000)
            except: pass
            time.sleep(60)


# ═══════════════════════════════════════════
# MAIN LOOP
# ═══════════════════════════════════════════
def cargar_proxies():
    """Carga todos los proxies desde proxies.txt (raíz del proyecto)."""
    # Buscar en raíz del proyecto (../proxies.txt) o en bot/proxies.txt
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


def main():
    use_proxy = "--proxy" in sys.argv

    # Obtener worker ID (para proxies rotativos)
    worker_id = None
    if "--worker-id" in sys.argv:
        idx = sys.argv.index("--worker-id")
        worker_id = int(sys.argv[idx + 1])

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

    # Cargar proxy
    proxy_conf = None
    if use_proxy:
        proxies, pf_path = cargar_proxies()
        if proxies:
            # Each worker gets its own proxy by index
            idx = (worker_id or 0) % len(proxies)
            proxy_conf = proxies[idx]
            print(f"[START] {len(proxies)} proxies cargados de {pf_path}")
            print(f"[START] Worker {worker_id or 0} usando proxy #{idx}: {proxy_conf['server']}")
        else:
            print(f"[START] ⚠️ No se encontraron proxies en {pf_path}")

    print(f"[START] Bot Orange - Backend: {BACKEND_URL}")
    print(f"[START] Máquina: {machine_name} | Worker ID: {worker_id or 0}")
    print(f"[START] Proxy: {proxy_conf['server'] if proxy_conf else 'NINGUNO (⚠️ Orange no abre sin IP española)'}")
    print("[START] Ctrl+C para detener")

    pw = sync_playwright().start()
    browser, context = crear_contexto_espana(pw, proxy_config=proxy_conf)
    page = context.new_page()

    # Stealth
    try:
        from playwright_stealth import stealth_sync
        stealth_sync(page)
        print("[START] Stealth activado")
    except: pass

    # Login
    if not login_loop(page, cred_user, cred_pass):
        browser.close(); pw.stop(); return

    procesados = no_clientes = errores = sin_trabajo = 0
    detenido = False

    while not detenido:
        # Verificar comandos del frontend
        for cmd_obj in check_command(machine_name):
            cmd = cmd_obj.get("comando", "") if isinstance(cmd_obj, dict) else cmd_obj
            params = cmd_obj.get("parametros", {}) if isinstance(cmd_obj, dict) else {}
            print(f"[CMD] Recibido: {cmd} {params}")
            if cmd == "detener":
                detenido = True
                break
            if cmd == "pausar":
                pausa = params.get("segundos", 10)
                print(f"[CMD] Pausado. Esperando {pausa}s...")
                time.sleep(pausa)

        if detenido: break

        # Siguiente DNI
        dni_data = next_dni()
        if not dni_data:
            # Sin DNIs pendientes: esperar con backoff progresivo
            # Si pasan 60s sin trabajo, cerrar navegador y esperar 5 min
            sin_trabajo += 1
            if sin_trabajo >= 12:  # 12 * 5s = 60s sin trabajo
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Sin DNIs pendientes. Cerrando sesion...")
                sin_trabajo = 0
                try:
                    page.close()
                    context.close()
                    browser.close()
                    pw.stop()
                except:
                    pass
                time.sleep(300)  # 5 min de espera
                # Reconectar
                pw = sync_playwright().start()
                browser, context = crear_contexto_espana(pw, proxy_config=proxy_conf)
                page = context.new_page()
                if not login_loop(page, cred_user, cred_pass):
                    detenido = True
                    break
                continue
            time.sleep(5)
            continue
        sin_trabajo = 0  # reset contador

        # Extraer dni (puede venir como "DNI_12345678A" o "12345678A")
        dni = dni_data.split("_")[-1] if "_" in dni_data else dni_data
        id_cliente = dni_data if "_" in dni_data else f"DNI_{dni}"
        if re.match(r'^[XYZ]', dni): id_cliente = f"NIE_{dni}"
        elif re.match(r'^[A-Z]', dni): id_cliente = f"NIF_{dni}"

        print(f"\n{'='*60}")
        print(f"[{datetime.now().strftime('%H:%M:%S')}] DNI: {dni} ({procesados} OK | {no_clientes} NC | {errores} ERR)")

        # Touch: avisar al rescate que este DNI está siendo procesado
        touch_dni(id_cliente)

        try:
            with Watchdog(f"dni-{dni}"):
                datos = extraer_datos_estructurados(page, dni)

            estado = datos.get("estado", "error")
            if estado == "no_cliente":
                no_clientes += 1
                sync_result(id_cliente, datos, "no_cliente")
                print(f"  -> NO CLIENTE")
                continue
            if estado == "error":
                errores += 1
                print(f"  -> ERROR: {datos.get('error','?')}")
                continue

            # Enviar al backend
            if sync_result(id_cliente, datos):
                print(f"  -> OK ({len(datos.get('lineas',[]))} lineas, CIMA={datos.get('cima_global')})")
                procesados += 1
            else:
                print(f"  -> ERROR al sincronizar")
                errores += 1

        except WatchdogTimeout:
            print(f"  -> TIMEOUT - reintentando login")
            errores += 1
            try:
                page.reload(timeout=30000)
                login_loop(page, cred_user, cred_pass, dni_touch=id_cliente)
            except:
                pass

        except Exception as e:
            print(f"  -> ERROR: {e}")
            errores += 1
            try:
                page.reload(timeout=30000)
                login_loop(page, cred_user, cred_pass, dni_touch=id_cliente)
            except:
                print("  -> [FATAL] No se pudo recuperar")
                detenido = True

    browser.close()
    pw.stop()
    print(f"\n[FIN] {procesados} OK | {no_clientes} NC | {errores} ERR")


if __name__ == "__main__":
    main()
