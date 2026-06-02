"""
piloto.py — Prueba piloto de análisis de Orange Pangea
======================================================
Usa el login.py completo de master (robusto) y agrega verbose dump
de todas las pestañas de todas las líneas para analizar la estructura.

USO:
  python piloto.py --workers N
"""
import os, sys, re, time, random, json, multiprocessing as mp
import argparse
from pathlib import Path
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

_env_file = Path(__file__).parent / ".env"
if not _env_file.exists():
    _env_file = Path(__file__).parent / ".env.example"
load_dotenv(_env_file)

sys.path.insert(0, str(Path(__file__).parent))
from bot.login import extraer_datos_cliente, realizar_login, seleccionar_marca_orange, abrir_nuevo_acto_comercial


def login_orange(page):
    """Wrapper del login completo de master."""
    page.goto("https://pangea.orange.es/", timeout=60000)
    realizar_login(page)
    seleccionar_marca_orange(page)
    abrir_nuevo_acto_comercial(page)
    page.wait_for_selector("button[title='Cambiar cliente']", timeout=20000)


def cargar_proxies():
    prox_file = Path(__file__).parent / "proxies.txt"
    if not prox_file.exists():
        return []
    proxies = []
    for linea in prox_file.read_text(encoding="utf-8").split("\n"):
        l = linea.strip()
        if not l or l.startswith("#"):
            continue
        partes = l.split(":")
        if len(partes) == 4:
            proxies.append({
                "server": f"http://{partes[0]}:{partes[1]}",
                "username": partes[2],
                "password": partes[3],
            })
    return proxies


def dump_todas_pestanas(page, worker_id, wlog):
    """Dump de TODAS las pestañas de TODAS las líneas (igual que antes)."""
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
                etiquetas = [h.inner_text().strip() for h in heading.locator("span.label").all()]
            except:
                etiquetas = []

            wlog(f"\n  📱 Línea: {num_linea}")
            wlog(f"    Etiquetas: {etiquetas}")

            # Dump de todas las pestañas
            tab_bar = bloque.locator(".client-tariff-section-navs")
            if tab_bar.count() > 0:
                tabs = tab_bar.locator("button.Title")
                wlog(f"    [TABS] {tabs.count()} pestañas")
                for t_idx in range(tabs.count()):
                    try:
                        nombre = tabs.nth(t_idx).inner_text().strip()
                        tabs.nth(t_idx).click(timeout=5000)
                        page.wait_for_timeout(400)
                        cards_c = bloque.locator(".client-tariff-section-cards")
                        if cards_c.count() > 0:
                            cards = cards_c.locator("> div")
                            wlog(f"    [{nombre}] {cards.count()} cards")
                            for c_idx in range(cards.count()):
                                try:
                                    txt = cards.nth(c_idx).inner_text().strip()[:400]
                                    wlog(f"      Card: {txt}")
                                except:
                                    pass
                        else:
                            wlog(f"    [{nombre}] sin cards")
                    except:
                        pass

        btn = page.locator("button.ocs-pagination-next")
        if btn.count() > 0 and not btn.is_disabled():
            btn.click(force=True, timeout=30000)
            page.wait_for_timeout(2000)
            pagina += 1
        else:
            hay_mas = False


def procesar_worker(dnis_chunk, worker_id, proxy_conf):
    log_file = Path(__file__).parent / f"piloto_logs_w{worker_id}.txt"
    fh = open(log_file, "w", encoding="utf-8")

    def wlog(msg=""):
        print(msg)
        fh.write(msg + "\n")
        fh.flush()

    wlog(f"[Worker {worker_id}] {len(dnis_chunk)} DNIs")
    wlog(f"[Worker {worker_id}] Primeros: {dnis_chunk[:3]}")
    if proxy_conf:
        wlog(f"[Worker {worker_id}] Proxy: {proxy_conf['server']}")
    wlog("=" * 80)

    # Iniciar navegador (usando browser_setup)
    p = sync_playwright().start()
    launch_kwargs = {"headless": False}
    if proxy_conf:
        launch_kwargs["proxy"] = {"server": proxy_conf["server"]}
    browser = p.chromium.launch(**launch_kwargs)
    ctx_kwargs = {"viewport": {"width": 1366, "height": 768}}
    if proxy_conf and proxy_conf.get("username"):
        ctx_kwargs["http_credentials"] = {
            "username": proxy_conf["username"],
            "password": proxy_conf["password"],
        }
    context = browser.new_context(**ctx_kwargs)
    page = context.new_page()

    # Login (función robusta de master)
    try:
        login_orange(page)
    except Exception as e:
        wlog(f"[FATAL] Login falló: {e}")
        browser.close()
        p.stop()
        fh.close()
        return
    wlog("[LOGIN] OK")
    wlog("=" * 80)

    procesados = 0
    errores = 0
    no_clientes = 0
    modal_abierto = False

    for idx, dni in enumerate(dnis_chunk):
        wlog(f"\n{'='*80}")
        wlog(f"[W{worker_id}][{idx+1}/{len(dnis_chunk)}] DNI: {dni}")

        try:
            lineas = extraer_datos_cliente(page, dni, buscar_por_dni=True, modal_ya_abierto=modal_abierto)
            if not lineas:
                wlog(f"  -> SIN DATOS")
                continue

            primera = lineas[0]
            if primera.get("Nombre") == "NO ES CLIENTE":
                no_clientes += 1
                modal_abierto = primera.get("_modal_abierto", False)
                wlog(f"  -> NO CLIENTE")
                continue

            modal_abierto = primera.get("_modal_abierto", False)
            wlog(f"  Cliente: {primera.get('Nombre', 'N/A')} | DNI: {primera.get('DNI', 'N/A')}")
            wlog(f"  Líneas encontradas: {len(lineas)}")

            # Dump completo de pestañas
            dump_todas_pestanas(page, worker_id, wlog)
            procesados += 1

        except Exception as e:
            wlog(f"  [ERROR] {e}")
            errores += 1
            try:
                page.reload(timeout=30000)
                page.wait_for_timeout(3000)
                login_orange(page)
                modal_abierto = False
            except:
                wlog(f"  [FATAL] No se pudo recuperar")
                break

        wlog(f"  --- Progreso: {procesados} OK / {no_clientes} NC / {errores} ERR ---")

    browser.close()
    p.stop()
    fh.close()

    wlog(f"\n{'='*80}")
    wlog(f"[Worker {worker_id}] FIN: {procesados} OK / {no_clientes} NC / {errores} ERR")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=1, help="Workers paralelos")
    args = parser.parse_args()
    num_w = max(1, min(args.workers, 20))

    num_file = Path(__file__).parent / "numeros.txt"
    if not num_file.exists():
        print(f"[ERROR] No existe {num_file}")
        sys.exit(1)
    dnis = []
    for l in num_file.read_text(encoding="utf-8").split("\n"):
        l = l.strip()
        if l and not l.startswith("#"):
            dnis.append(l.upper())
    print(f"[INICIO] {len(dnis)} DNIs para {num_w} worker(s)")

    proxies = cargar_proxies()
    if len(proxies) < num_w:
        print(f"[WARN] {len(proxies)} proxies para {num_w} workers — algunos sin proxy")

    chunks = [[] for _ in range(num_w)]
    for i, d in enumerate(dnis):
        chunks[i % num_w].append(d)

    procs = []
    for wid in range(num_w):
        proxy = proxies[wid % len(proxies)] if proxies else None
        p = mp.Process(target=procesar_worker, args=(chunks[wid], wid + 1, proxy))
        procs.append(p)
        p.start()
        print(f"  Worker {wid+1} — {len(chunks[wid])} DNIs")

    print(f"\n[ESPERANDO] {num_w} worker(s)...\n")
    for p in procs:
        p.join()

    print(f"\n[FIN] Logs: piloto_logs_w*.txt")


if __name__ == "__main__":
    main()
