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

load_dotenv()

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

def next_dni():
    data = api_get("/api/bot/next-dni")
    return data.get("dni") if data else None

def check_command():
    """Retorna lista de comandos como objetos {comando, parametros}."""
    data = api_get("/api/bot/command")
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
    return {"hotline":"Hotline" in texto, "suspendida":"Suspendida" in texto,
            "impago":"Impago" in texto, "fraude":"Fraude" in texto}

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
                 "es_principal": lb.get("es_principal",False), "activo_desde": lb.get("activo_desde","N/A")}
        try:
            bloque = page.locator(f".client-tariff-flex:has-text('{linea['numero']}')")
            if bloque.count()>0:
                b=bloque.first
                try: linea["estado"]=parse_estado_linea(b.locator("ocs-line-status").inner_text().strip())
                except: pass
                try:
                    d=b.locator("ocs-line-details").inner_text().strip()
                    linea["consumo"]=extraer_campo(d,r'Consumo\s+([^\n]+)')
                    linea["permanencia"]=extraer_campo(d,r'Permanencia\s+([^\n]+)')
                    linea["vap"]=extraer_campo(d,r'Venta a Plazos\s*\n?\s*([^\n]+)')
                except: pass
        except: pass
        lineas_detalladas.append(linea)

    return {"estado":"completado","header":header,"lineas":lineas_detalladas,"cima_global":cima_global}


# ═══════════════════════════════════════════
# LOGIN
# ═══════════════════════════════════════════
def login_loop(page):
    for intento in range(999):
        try:
            page.goto(ORANGE_URL, timeout=90000)
            manejar_cookies_flexible(page)
            realizar_login(page)
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
def main():
    use_proxy = "--proxy" in sys.argv

    # Cargar proxy
    proxy_conf = None
    if use_proxy:
        pf = Path(__file__).parent / "proxies.txt"
        if pf.exists():
            for l in pf.read_text().split("\n"):
                l=l.strip()
                if l and not l.startswith("#"):
                    p=l.split(":")
                    if len(p)==4:
                        proxy_conf={"server":f"http://{p[0]}:{p[1]}","username":p[2],"password":p[3]}
                        break

    print(f"[START] Bot Orange - Backend: {BACKEND_URL}")
    print(f"[START] Proxy: {proxy_conf['server'] if proxy_conf else 'NINGUNO'}")
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
    if not login_loop(page):
        browser.close(); pw.stop(); return

    procesados = no_clientes = errores = 0
    detenido = False

    while not detenido:
        # Verificar comandos del frontend
        for cmd_obj in check_command():
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
            time.sleep(5)
            continue

        # Extraer dni (puede venir como "DNI_12345678A" o "12345678A")
        dni = dni_data.split("_")[-1] if "_" in dni_data else dni_data
        id_cliente = dni_data if "_" in dni_data else f"DNI_{dni}"
        if re.match(r'^[XYZ]', dni): id_cliente = f"NIE_{dni}"
        elif re.match(r'^[A-Z]', dni): id_cliente = f"NIF_{dni}"

        print(f"\n{'='*60}")
        print(f"[{datetime.now().strftime('%H:%M:%S')}] DNI: {dni} ({procesados} OK | {no_clientes} NC | {errores} ERR)")

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
                login_loop(page)
            except:
                pass

        except Exception as e:
            print(f"  -> ERROR: {e}")
            errores += 1
            try:
                page.reload(timeout=30000)
                login_loop(page)
            except:
                print("  -> [FATAL] No se pudo recuperar")
                detenido = True

    browser.close()
    pw.stop()
    print(f"\n[FIN] {procesados} OK | {no_clientes} NC | {errores} ERR")


if __name__ == "__main__":
    main()
