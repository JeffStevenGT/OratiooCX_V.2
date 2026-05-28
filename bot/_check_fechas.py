import sys, os, json
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, r'C:\Users\Jeff\Desktop\Proyectos\Oratioo_CX\bot')
from dotenv import load_dotenv
load_dotenv(r'C:\Users\Jeff\Desktop\Proyectos\Oratioo_CX\bot\.env')
from supabase_client import _api

# Buscar solo completados/no_cliente y ver su fecha_procesado REAL
rows = _api('GET', '/lineas?select=dni,created_at,atributos_dinamicos&order=created_at.desc&limit=100')
probs = []
for r in rows:
    ad = r.get('atributos_dinamicos', {})
    if isinstance(ad, str):
        try: ad = json.loads(ad)
        except: ad = {}
    est = ad.get('estado', '')
    if est not in ('completado', 'no_cliente'):
        continue
    
    fp = ad.get('fecha_procesado', '')
    ca = (r.get('created_at') or '')[:19]
    
    # Si fecha_procesado no es YYYY-MM-DD limpio, reportar
    if fp and not (len(fp) == 10 and fp[4] == '-' and fp[7] == '-'):
        probs.append(f"  {r['dni']}: fecha_procesado={repr(fp)}, created_at={ca}")
    
    # Si apareceria en ambos filtros (28 y 27), reportar
    if fp:
        if fp >= '2026-05-28':
            probs.append(f"  {r['dni']}: fecha_procesado={fp} -> aparece en filtro HOY (28)")
        if fp >= '2026-05-27' and fp < '2026-05-28':
            probs.append(f"  {r['dni']}: fecha_procesado={fp} -> aparece en filtro AYER (27)")
    else:
        # Sin fecha_procesado: cae al fallback created_at
        if ca >= '2026-05-28':
            probs.append(f"  {r['dni']}: SIN fecha_procesado, created_at={ca} -> aparece como HOY por fallback")

if not probs:
    print("Todos los completados tienen fecha_procesado correcto.")
else:
    print(f"{len(probs)} casos raros:")
    for p in probs[:30]:
        print(p)

print()
# Conteo simple
fp_counts = {}
for r in rows:
    ad = r.get('atributos_dinamicos', {})
    if isinstance(ad, str):
        try: ad = json.loads(ad)
        except: ad = {}
    if ad.get('estado') not in ('completado', 'no_cliente'):
        continue
    fp = ad.get('fecha_procesado', 'SIN_FECHA')
    fp_counts[fp] = fp_counts.get(fp, 0) + 1

for fp, count in sorted(fp_counts.items(), reverse=True):
    print(f"  fecha_procesado={fp}: {count} registros")
