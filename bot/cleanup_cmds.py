"""Cancel pending abrir_navegador commands"""
from dotenv import load_dotenv
import os, json
load_dotenv()

URL = os.getenv('SUPABASE_URL', '').rstrip('/')
KEY = os.getenv('SUPABASE_SERVICE_KEY', '')

def api(method, path, body=None):
    from urllib.request import Request, urlopen
    url = f'{URL}/rest/v1{path}'
    data = json.dumps(body).encode() if body else None
    headers = {'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'}
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=10) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else []
    except: return []

cmds = api('GET', '/comandos_bot?maquina_destino=eq.PC-Jeff&estado=eq.pendiente&select=id,comando&limit=20')
count = 0
for c in cmds:
    if c.get('comando') == 'abrir_navegador':
        api('PATCH', f"/comandos_bot?id=eq.{c['id']}", {'estado': 'cancelado', 'resultado': 'Limpieza'})
        count += 1
print(f'Limpios {count} comandos pendientes')
