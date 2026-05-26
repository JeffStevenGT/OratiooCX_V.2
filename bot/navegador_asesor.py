"""
navegador_asesor.py — Abre un navegador visible para que un asesor
consulte Orange manualmente con su proxy asignado.

USO (normalmente lanzado por coordinator.py):
  python navegador_asesor.py --proxy-server http://ip:puerto --proxy-user user --proxy-pass pass
"""

import os
import sys
import time
import json
import signal
import argparse

from browser_setup import crear_contexto_espana
from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--proxy-server", default="")
    parser.add_argument("--proxy-user", default="")
    parser.add_argument("--proxy-pass", default="")
    parser.add_argument("--asesor-id", default="0")
    args = parser.parse_args()

    proxy_config = None
    if args.proxy_server:
        proxy_config = {
            "server": args.proxy_server,
            "username": args.proxy_user,
            "password": args.proxy_pass,
        }

    pid = os.getpid()
    print(f"[NavA#{args.asesor_id}|PID:{pid}] Abriendo navegador con proxy {args.proxy_server}")

    with sync_playwright() as p:
        try:
            browser, context = crear_contexto_espana(p, proxy_config=proxy_config)
            page = context.new_page()

            # Ir a Orange
            page.goto("https://pangea.orange.es/", timeout=90000)

            print(f"[NavA#{args.asesor_id}] Navegador abierto. El asesor debe hacer login manual.")
            print(f"[NavA#{args.asesor_id}] Cerrando automaticamente en 30 min si no hay actividad...")

            # Esperar a que el usuario cierre el navegador, con timeout de 30 min
            try:
                page.wait_for_timeout(1800000)  # 30 min
            except KeyboardInterrupt:
                pass
            except:
                pass

        except Exception as e:
            print(f"[NavA#{args.asesor_id}] Error: {e}")
        finally:
            try:
                browser.close()
            except:
                pass

    print(f"[NavA#{args.asesor_id}] Navegador cerrado")
    sys.exit(0)


if __name__ == "__main__":
    main()
