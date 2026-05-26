"""Quick script to check Supabase state"""
import os, json
from dotenv import load_dotenv
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

def _api(method, path, body=None):
    from urllib.request import Request, urlopen
    from urllib.error import HTTPError
    url = f"{SUPABASE_URL}/rest/v1{path}"
    data = json.dumps(body).encode() if body else None
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=10) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else []
    except Exception as e:
        return []

print("=== DOCUMENTOS ===")
docs = _api("GET", "/documentos?select=*&order=created_at.desc&limit=10")
for d in docs:
    print(f"  ID={d['id']} | archivo={d.get('nombre_archivo')} | estado={d.get('estado')} | total={d.get('total_dnis')} | proc={d.get('procesados')} | pend={d.get('pendientes')}")

print("\n=== MAQUINAS ===")
maqs = _api("GET", "/maquinas?select=*")
for m in maqs:
    print(f"  nombre={m.get('nombre')} | estado={m.get('estado')} | workers={m.get('workers_activos')} | workers_config={m.get('workers_config')} | ultimo_hb={m.get('ultimo_heartbeat')}")

print("\n=== LINEAS (counts) ===")
total = _api("GET", "/lineas?select=id&limit=0")
pend = _api("GET", "/lineas?select=id&atributos_dinamicos->>estado=eq.pendiente&limit=0")
comp = _api("GET", "/lineas?select=id&atributos_dinamicos->>estado=neq.pendiente&limit=0")
print(f"  Total: {len(total)} | Pendientes: {len(pend)} | Procesados/errores: {len(comp)}")

if total:
    print("\n=== LINEAS (sample) ===")
    lines = _api("GET", "/lineas?select=dni,atributos_dinamicos&limit=5&order=created_at.desc")
    for l in lines:
        print(f"  DNI: {l.get('dni')} | estado: {l.get('atributos_dinamicos', {}).get('estado')}")

print("\n=== COMANDOS RECIENTES ===")
cmds = _api("GET", "/comandos_bot?select=*&order=creado_el.desc&limit=5")
for c in cmds:
    print(f"  ID={c['id']} | cmd={c.get('comando')} | destino={c.get('maquina_destino')} | estado={c.get('estado')} | resultado={c.get('resultado','')[:50]}")
