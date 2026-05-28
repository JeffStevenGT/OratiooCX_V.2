import sys, os, json
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, r'C:\Users\Jeff\Desktop\Proyectos\Oratioo_CX\bot')
from dotenv import load_dotenv
load_dotenv(r'C:\Users\Jeff\Desktop\Proyectos\Oratioo_CX\bot\.env')
from supabase_client import _api

rows = _api('GET', '/lineas?select=dni,nombre,linea,paquete,atributos_dinamicos&atributos_dinamicos->>estado=eq.pendiente&limit=20')
print(f"Pendientes: {len(rows)}")
print(f"{'DNI':15} {'nombre':25} {'linea':15} {'paq':15} {'estado':12}")
print('-'*85)
for r in rows:
    ad = r.get('atributos_dinamicos', {})
    if isinstance(ad, str):
        try: ad = json.loads(ad)
        except: ad = {}
    nom = (r.get('nombre') or '')[:25]
    lin = (r.get('linea') or '')[:15]
    paq = (r.get('paquete') or '')[:15]
    print(f"  {r['dni']:15} {nom:25} {lin:15} {paq:15} pendiente")
