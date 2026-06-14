"""
Bot de prueba con proxy - procesa un DNI pendiente
"""
import sys, os, time, requests, random
from dotenv import load_dotenv
from pathlib import Path
load_dotenv()
from playwright.sync_api import sync_playwright
from login import realizar_login, seleccionar_marca_orange, abrir_nuevo_acto_comercial, manejar_cookies_flexible, extraer_datos_cliente
from browser_setup import crear_contexto_espana

# Cargar proxy aleatorio
proxies_file = Path(__file__).parent.parent / 'proxies.txt'
proxies = []
for line in proxies_file.read_text().split('\n'):
    line = line.strip()
    if line and not line.startswith('#'):
        parts = line.split(':')
        if len(parts) >= 4:
            proxies.append({
                'server': f'http://{parts[0]}:{parts[1]}',
                'username': parts[2],
                'password': parts[3]
            })
proxy = random.choice(proxies) if proxies else None
print(f'[TEST] Proxy: {proxy["server"] if proxy else "NINGUNO (problema!)"}')

ORANGE_URL = 'https://pangea.orange.es/'
BACKEND_URL = os.getenv('BOT_API_URL', 'http://localhost:3000')
BOT_KEY = os.getenv('BOT_API_KEY', 'oratioo-bot-internal-key')

pw = sync_playwright().start()
browser, context = crear_contexto_espana(pw, proxy_config=proxy)
page = context.new_page()

try:
    print('[TEST] Navegando a Orange...')
    page.goto(ORANGE_URL, timeout=90000)
    manejar_cookies_flexible(page)
    print('[TEST] Login...')
    realizar_login(page)
    print('[TEST] Seleccionando marca Orange...')
    seleccionar_marca_orange(page)
    print('[TEST] Abriendo acto comercial...')
    abrir_nuevo_acto_comercial(page)
    
    r = requests.get(f'{BACKEND_URL}/api/bot/next-dni',
                     headers={'x-bot-api-key': BOT_KEY}, timeout=10)
    if r.ok:
        dni_json = r.json() if r.text.strip().startswith('{') else {'dni': r.text.strip()}
        dni_raw = dni_json.get('dni', '')
        import re
        dni = re.sub(r'^[A-Z]+_', '', str(dni_raw))
        print(f'[TEST] Procesando: {dni}')
        datos = extraer_datos_cliente(page, dni)
        for i, d in enumerate(datos):
            prod = d.get('producto', 'N/A')
            print(f'  L{i+1}: {d.get("Linea")} | {prod} | CIMA={d.get("es_cima")} | R={d.get("variante_renove")}')
            estados = d.get('estado_linea', [])
            for e in estados:
                flag = 'ACTIVO' if e['activo'] else 'inactivo'
                print(f'        Estado: {e["texto"]} ({flag})')
            extras = d.get('campanas_extra', [])
            for c in extras:
                print(f'        Campana: {c["tipo"]}={c["texto"][:50]}')
        print('\n[TEST] OK - extraccion completa')
    else:
        print(f'[TEST] Error obteniendo DNI: {r.status_code}')
except Exception as e:
    print(f'[TEST] ERROR: {e}')
    import traceback
    traceback.print_exc()
finally:
    try:
        browser.close()
    except:
        pass
    pw.stop()
