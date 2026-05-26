"""
asesor_agent.py — Agente local para el asesor
=============================================
Se ejecuta en segundo plano en la PC del asesor.
Escucha comandos desde Supabase y abre Chrome con el proxy asignado.

USO (una sola vez en la PC del asesor):
  python asesor_agent.py --email lenin.cerna@oratioo.com

Esto abre una ventana minimizada. Para cerrarlo: Ctrl+C en la terminal.
Para que se ejecute automáticamente al encender la PC, crear un acceso directo
en la carpeta de inicio de Windows.
"""

import os
import sys
import json
import time
import subprocess
import argparse
import platform
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from pathlib import Path

# ── Config desde .env compartido ──────────────────
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
POLL_INTERVAL = 5  # segundos


def _api(method, path, body=None):
    if not SUPABASE_URL or not SERVICE_KEY:
        return []
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
    except HTTPError as e:
        err = e.read().decode()[:150] if e.fp else str(e)
        print(f"[AsesorAgent] HTTPError {e.code}: {err}")
        return []
    except Exception as e:
        return []


def obtener_proxy_asesor(email):
    """Obtiene el proxy asignado al asesor desde Supabase."""
    data = _api("GET", f"/usuarios?select=proxy_asignado&email=eq.{email}&limit=1")
    if data and len(data) > 0:
        return data[0].get("proxy_asignado", "")
    return ""


def abrir_navegador(proxy, email):
    """
    Abre Chrome/Edge con el proxy configurado.
    """
    proxy_server = proxy
    if proxy and ":" in proxy:
        partes = proxy.split(":")
        proxy_server = f"{partes[0]}:{partes[1]}"

    url = "https://pangea.orange.es/"

    print(f"[AsesorAgent] Abriendo Orange... Proxy: {proxy_server}")

    system = platform.system()

    if system == "Windows":
        # Intentar Chrome
        chrome_paths = [
            os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
        ]

        for ch_path in chrome_paths:
            if os.path.exists(ch_path):
                cmd = [ch_path]
                if proxy:
                    cmd.extend([f"--proxy-server=http://{proxy_server}"])
                cmd.append(url)
                subprocess.Popen(cmd, shell=False)
                print(f"[AsesorAgent] Chrome iniciado desde: {ch_path}")
                return

        # Fallback a Edge
        edge_paths = [
            os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
            os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
        ]
        for ed_path in edge_paths:
            if os.path.exists(ed_path):
                cmd = [ed_path]
                if proxy:
                    cmd.extend([f"--proxy-server=http://{proxy_server}"])
                cmd.append(url)
                subprocess.Popen(cmd, shell=False)
                print(f"[AsesorAgent] Edge iniciado desde: {ed_path}")
                return

        # Último recurso: start (abre el navegador por defecto, sin proxy)
        subprocess.Popen(["start", url], shell=True)
        print("[AsesorAgent] Navegador por defecto abierto (sin proxy)")

    elif system == "Linux":
        cmd = ["google-chrome"]
        if proxy:
            cmd.extend([f"--proxy-server=http://{proxy_server}"])
        cmd.append(url)
        try:
            subprocess.Popen(cmd)
        except FileNotFoundError:
            subprocess.Popen(["xdg-open", url])
    elif system == "Darwin":
        cmd = ["open", "-a", "Google Chrome"]
        if proxy:
            cmd.extend(["--args", f"--proxy-server=http://{proxy_server}"])
        cmd.append(url)
        try:
            subprocess.Popen(cmd)
        except FileNotFoundError:
            subprocess.Popen(["open", url])

    print("[AsesorAgent] Navegador abierto")


def main():
    parser = argparse.ArgumentParser(description="Agente local para abrir Orange con proxy")
    parser.add_argument("--email", required=True, help="Email del asesor")
    args = parser.parse_args()

    email = args.email.strip()

    print(f"{'='*50}")
    print(f"  ORATIOO CX - Agente local del asesor")
    print(f"{'='*50}")
    print(f"  Email: {email}")
    print(f"  Escuchando comandos... (cada {POLL_INTERVAL}s)")
    print(f"  Presiona Ctrl+C para salir")
    print(f"{'='*50}\n")

    while True:
        try:
            # Buscar comandos "abrir_navegador" para este asesor
            comandos = _api(
                "GET",
                f"/comandos_bot?comando=eq.abrir_navegador&estado=eq.pendiente"
                f"&order=creado_el.asc&limit=5",
            )

            for cmd in comandos:
                params = cmd.get("parametros", {}) or {}
                cmd_email = params.get("asesor_email", "")

                if cmd_email == email:
                    # Es para este asesor
                    proxy_especifico = params.get("proxy_asignado", "")
                    proxy = proxy_especifico or obtener_proxy_asesor(email)

                    print(f"[AsesorAgent] Comando recibido! Proxy: {proxy or 'sin proxy'}")

                    abrir_navegador(proxy, email)

                    # Marcar como completado
                    _api("PATCH", f"/comandos_bot?id=eq.{cmd['id']}", {
                        "estado": "completado",
                        "resultado": "Navegador abierto en PC del asesor",
                    })
                    print("[AsesorAgent] Comando completado")

            time.sleep(POLL_INTERVAL)

        except KeyboardInterrupt:
            print("\n[AsesorAgent] Deteniendo...")
            break
        except Exception as e:
            print(f"[AsesorAgent] Error: {e}")
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
