"""
piloto.py — Copia exacta del worker de master + verbose dump
=====================================================================
- Mismo login, mismos reintentos, mismas funciones
- Lee DNIs de numeros.txt (local)
- NO guarda nada en BD
- Dump de todas las pestañas para análisis
"""
import os, sys, time, random, json
import argparse
from pathlib import Path
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

_env_file = Path(__file__).parent / ".env"
if not _env_file.exists():
    _env_file = Path(__file__).parent / ".env.example"
load_dotenv(_env_file)

sys.path.insert(0, str(Path(__file__).parent / "bot"))
from browser_setup import crear_contexto_espana
from login import (
    realizar_login, seleccionar_marca_orange, abrir_nuevo_acto_comercial,
    extraer_datos_cliente, manejar_cookies_flexible, manejar_maximo_sesiones
)

ORANGE_URL = "https://pangea.orange.es/"


def cargar_proxies():
    pf = Path(__file__).parent / "proxies.txt"
    if not pf.exists():
        return []
    proxies = []
    for l in pf.read_text("utf-8").split("\n"):
        l = l.strip()
        if not l or l.startswith("#"):
            continue
        p = l.split(":")
        if len(p) == 4:
            proxies.append({"server": f"http://{p[0]}:{p[1]}", "username": p[2], "password": p[3]})
    return proxies


def dump_todas_pestanas(page, wlog):
    lineas_vistas = set()
    pagina = 1
    hay_mas = True
    while hay_mas:
        bloques = page.locator(".client-tariff-flex")
        wlog(f"  --- Página {pagina} — {bloques.count()} bloque(s) ---")
        for i in range(bloques.count()):
            bloque = bloques.nth(i)
            try:
                num_linea = bloque.locator(".line-section .color-primary strong").inner_text().strip()
            except:
                continue
            if num_linea in lineas_vistas:
                hay_mas = False
                break
            lineas_vistas.add(num_linea)
            try:
                heading = bloque.locator(".client-tariff-heading")
                etiq = [h.inner_text().strip() for h in heading.locator("span.label").all()]
            except:
                etiq = []
            wlog(f"\n  == Linea: {num_linea}  {etiq}")

            # Datos de linea (status, consumo, permanencia, VAP)
            try:
                ls = bloque.locator("ocs-line-status").inner_text().strip()
                wlog(f"    [STATUS] {ls[:200]}")
            except:
                pass
            try:
                ld = bloque.locator("ocs-line-details").inner_text().strip()
                wlog(f"    [DETAILS] {ld[:400]}")
            except:
                pass
            try:
                plan = bloque.locator(".line-section").inner_text().strip()
                wlog(f"    [PLAN] {plan[:200]}")
            except:
                pass

            tab_bar = bloque.locator(".client-tariff-section-navs")
            if tab_bar.count() > 0:
                tabs = tab_bar.locator("button.Title")
                wlog(f"    [TABS] {tabs.count()} tabs")
                for t_idx in range(tabs.count()):
                    try:
                        nombre = tabs.nth(t_idx).inner_text().strip()
                        tabs.nth(t_idx).click(timeout=5000)
                        time.sleep(0.4)
                        cc = bloque.locator(".client-tariff-section-cards")
                        if cc.count() > 0:
                            cards = cc.locator("> div")
                            ncards = cards.count()
                            if ncards > 0:
                                wlog(f"    [{nombre}] {ncards} cards")
                                for c_idx in range(ncards):
                                    try:
                                        t = cards.nth(c_idx).inner_text().strip()[:400]
                                        wlog(f"      Card: {t}")
                                    except:
                                        pass
                            else:
                                wlog(f"    [{nombre}] sin cards")
                    except:
                        pass

        btn = page.locator("button.ocs-pagination-next")
        if btn.count() > 0 and not btn.is_disabled():
            btn.click(force=True, timeout=30000)
            time.sleep(2)
            pagina += 1
        else:
            hay_mas = False

    # Secciones inferiores (permanencias, descuentos, facturas, consumo)
    wlog('')
    wlog('  [SECCIONES INFERIORES]')
    for nombre, sel in [('PERMANENCIAS','.mod-permanency-chart'),('DESCUENTOS','.mod-promotions-and-discounts'),('FACTURAS','.mod-invoice-histogram-main'),('CONSUMO GRUPO','group-consumption-fed')]:
        try:
            txt = page.locator(sel).inner_text().strip()[:600]
            if txt:
                wlog(f'  [{nombre}] {txt}')
        except:
            pass


def procesar_worker(dnis_chunk, worker_id, proxy_conf):
    lf = Path(__file__).parent / f"piloto_logs_w{worker_id}.txt"
    fh = open(lf, "w", encoding="utf-8")

    def wlog(m=""):
        print(m)
        fh.write(m + "\n")
        fh.flush()

    wlog(f"[Worker {worker_id}] {len(dnis_chunk)} DNIs — {dnis_chunk[:3]}")
    wlog(f"[Worker {worker_id}] Proxy: {proxy_conf['server'] if proxy_conf else 'ninguno'}")
    wlog("=" * 80)

    # ── PLAYWRIGHT + BROWSER (exactamente como worker.py) ──
    pw = sync_playwright().start()
    try:
        browser, context = crear_contexto_espana(pw, proxy_config=proxy_conf)
        page = context.new_page()
    except Exception as e:
        wlog(f"[FATAL] No se pudo iniciar Playwright: {e}")
        pw.stop()
        fh.close()
        return

    # ── LOGIN con 5 reintentos (exactamente como worker.py) ──
    login_ok = False
    for intento in range(999):
        try:
            page.goto(ORANGE_URL, timeout=90000)
            manejar_cookies_flexible(page)
            realizar_login(page)
            seleccionar_marca_orange(page)
            abrir_nuevo_acto_comercial(page)
            wlog("[LOGIN] OK (intento " + str(intento+1) + ")")
            login_ok = True
            break
        except Exception as e:
            wlog("[LOGIN] Fallo intento " + str(intento+1) + ": " + str(e))
            wlog("[LOGIN] Reintentando en 30s...")
            try:
                page.goto(ORANGE_URL, timeout=30000)
            except:
                pass
            time.sleep(30)


    # ── PROCESAR DNIs ──
    procesados = errores = no_clientes = 0
    modal_abierto = False

    for idx, dni in enumerate(dnis_chunk):
        wlog(f"\n{'='*80}")
        wlog(f"[W{worker_id}][{idx+1}/{len(dnis_chunk)}] DNI: {dni}")

        try:
            lineas = extraer_datos_cliente(page, dni, buscar_por_dni=True, modal_ya_abierto=modal_abierto)
            if not lineas:
                continue

            primera = lineas[0]
            if primera.get("Nombre") == "NO ES CLIENTE":
                no_clientes += 1
                modal_abierto = primera.get("_modal_abierto", False)
                wlog(f"  -> NO CLIENTE")
                continue

            modal_abierto = primera.get("_modal_abierto", False)
            wlog(f"  Cliente: {primera.get('Nombre','N/A')} | {primera.get('DNI','N/A')} | {len(lineas)} línea(s)")

            # DUMP de todas las pestañas
            dump_todas_pestanas(page, wlog)
            procesados += 1

        except Exception as e:
            wlog(f"  [ERROR] {e}")
            errores += 1
            try:
                page.reload(timeout=30000)
                time.sleep(3)
                page.goto(ORANGE_URL, timeout=30000)
                manejar_cookies_flexible(page)
                realizar_login(page)
                seleccionar_marca_orange(page)
                abrir_nuevo_acto_comercial(page)
                modal_abierto = False
                wlog(f"  [RECOVERY] Relogueado")
            except:
                wlog(f"  [FATAL] No se pudo recuperar")
                break

        wlog(f"  --- {procesados} OK / {no_clientes} NC / {errores} ERR ---")

    browser.close()
    pw.stop()
    fh.close()
    wlog(f"\n[Worker {worker_id}] FIN: {procesados} OK / {no_clientes} NC / {errores} ERR")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=1)
    args = parser.parse_args()
    nw = max(1, min(args.workers, 20))

    nf = Path(__file__).parent / "numeros.txt"
    if not nf.exists():
        print(f"[ERROR] Falta {nf}")
        sys.exit(1)
    dnis = [l.strip().upper() for l in nf.read_text("utf-8").split("\n")
            if l.strip() and not l.strip().startswith("#")]

    proxies = cargar_proxies()
    if len(proxies) < nw:
        print(f"[WARN] {len(proxies)} proxies para {nw} workers")

    chunks = [[] for _ in range(nw)]
    for i, d in enumerate(dnis):
        chunks[i % nw].append(d)

    import multiprocessing as mp
    procs = []
    for wid in range(nw):
        proxy = proxies[wid % len(proxies)] if proxies else None
        p = mp.Process(target=procesar_worker, args=(chunks[wid], wid + 1, proxy))
        procs.append(p)
        p.start()
        print(f"  Worker {wid+1} — {len(chunks[wid])} DNIs")

    print(f"\n[ESPERANDO] {nw} worker(s)...\n")
    for p in procs:
        p.join()
    print(f"\n[FIN] Logs: piloto_logs_w*.txt")


if __name__ == "__main__":
    main()
