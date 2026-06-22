"""
browser_setup.py — Configuración del navegador con proxy y geolocalización España
=================================================================================
Basado en el flujo del proyecto de referencia Bot_Orange.

[SEGURIDAD] headless=True por defecto en producción.
Para depuración local, define BOT_HEADLESS=0 en tu .env
"""

import random, os
from pathlib import Path


def crear_contexto_espana(playwright, proxy_config: dict = None):
    """
    Crea browser + contexto con geolocalización España.

    proxy_config: {
        "server": "http://ip:puerto" o "socks5://ip:puerto",
        "username": "...",
        "password": "..."
    }
    Si proxy_config es None, se lanza sin proxy.

    [SEGURIDAD] El navegador corre en modo headless por defecto.
    Para ver la UI en desarrollo: BOT_HEADLESS=0 en .env
    """
    # headless=True por defecto en producción; solo se desactiva con BOT_HEADLESS=0
    headless = os.getenv("BOT_HEADLESS", "1") != "0"
    launch_args = {
        "headless": headless,
        "args": [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
        ],
    }

    browser = playwright.chromium.launch(**launch_args)

    context_args = {
        "timezone_id": "Europe/Madrid",
        "locale": "es-ES",
        "geolocation": {"longitude": -3.703790, "latitude": 40.416775},
        "permissions": ["geolocation"],
        "viewport": {"width": 1366, "height": 768},
        "user_agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0.0.0 Safari/537.36"
        ),
    }

    if proxy_config:
        context_args["proxy"] = {
            "server": proxy_config["server"],
        }
        if proxy_config.get("username"):
            context_args["proxy"]["username"] = proxy_config["username"]
        if proxy_config.get("password"):
            context_args["proxy"]["password"] = proxy_config["password"]

    context = browser.new_context(**context_args)

    # ── BLINDAJE PERMANENTE: inyectar CSS anti-Herramientas en CADA pagina ──
    # Este script corre ANTES de que la pagina cargue, sobrevive a navegaciones.
    context.add_init_script("""
        const antiToolsStyle = document.createElement('style');
        antiToolsStyle.id = 'oratioo-blindaje-tools';
        antiToolsStyle.textContent = `
            .o-comp__tools-menu-container,
            div[ng-show="toolsCtrl.showMenu"] {
                display: none !important;
                visibility: hidden !important;
                pointer-events: none !important;
            }
            .o-comp__tools__select,
            button.o-comp__form-select--bold {
                pointer-events: none !important;
            }
        `;
        (document.head || document.documentElement).appendChild(antiToolsStyle);
    """)
    print("  [Browser] Blindaje anti-Herramientas instalado (init_script)")

    return browser, context


def parsear_proxy(linea: str) -> dict | None:
    """
    Parsea una línea de proxies.txt.
    Formatos aceptados:
      - ip:puerto:usuario:contraseña
      - http://usuario:contraseña@ip:puerto
      - ip:puerto (sin auth)
    """
    linea = linea.strip()
    if not linea or linea.startswith("#"):
        return None

    # Formato: ip:puerto:usuario:contraseña
    partes = linea.split(":")
    if len(partes) == 4:
        return {
            "server": f"http://{partes[0]}:{partes[1]}",
            "username": partes[2],
            "password": partes[3],
        }

    # Formato: http://usuario:pass@ip:puerto
    if "@" in linea:
        protocolo_resto = linea.split("://", 1)
        if len(protocolo_resto) == 2:
            resto = protocolo_resto[1]
            creds, host = resto.split("@", 1)
            user, passw = creds.split(":", 1)
            return {
                "server": f"http://{host}",
                "username": user,
                "password": passw,
            }

    # Formato simple: ip:puerto
    if len(partes) == 2:
        return {
            "server": f"http://{linea}",
        }

    return None


def cargar_proxies(archivo: str = None) -> list[dict]:
    """Carga todos los proxies desde proxies.txt."""
    if not archivo:
        archivo = str(Path(__file__).parent / "proxies.txt")

    proxies = []
    with open(archivo, "r", encoding="utf-8") as f:
        for linea in f:
            proxy = parsear_proxy(linea)
            if proxy:
                proxies.append(proxy)

    return proxies


def proxy_aleatorio(proxies: list[dict]) -> dict | None:
    """Selecciona un proxy al azar de la lista."""
    if not proxies:
        return None
    return random.choice(proxies)
