# WORKFLOW.md — Lógica del Bot y Manejo de Estados

## Ciclo de vida de un DNI

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CICLO DE VIDA                                 │
│                                                                       │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐               │
│  │ pendiente│───►│ en_progreso  │───►│  completado  │               │
│  └──────────┘    └──────────────┘    └──────────────┘               │
│       ▲               │    │              │    │                     │
│       │               │    └──────────────┘    │                     │
│       │               │     watchodg timeout    │                     │
│       │               ▼                        ▼                     │
│       │        ┌──────────────┐    ┌──────────────┐                 │
│       └────────│ error_sync   │    │  no_cliente  │                 │
│        rescue  └──────────────┘    └──────────────┘                 │
│        _stale                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Estados del bot (`clientes_proyectos.datos->>'estado'`)

| Estado | Significado | Transición |
|--------|-------------|------------|
| `pendiente` | DNI listo para ser procesado | → `en_progreso` (next-dni) |
| `en_progreso` | Un worker está extrayendo datos | → `completado` / `no_cliente` / `error_sync` |
| `completado` | Extracción exitosa con datos | → (re-análisis posible vía frontend) |
| `no_cliente` | DNI no encontrado en Pangea | → (re-análisis si se sospecha falso negativo) |
| `error_sync` | Falló sync tras 3 reintentos con backoff exponencial | → `pendiente` (rescate) |
| `ya_procesado` | Cliente duplicado (búsqueda por teléfono) | → `no_cliente` en DB |

---

## Coordinator Daemon (`coordinator_loop.py`)

### Funciones principales

```python
def main():
    # 1. Registro
    machine_name = socket.gethostname()
    
    # 2. Heartbeat cada 30s
    send_heartbeat(machine_name)
    
    # 3. Polling de comandos cada 5s
    for cmd in poll_commands(machine_name):
        handle_command(cmd, machine_name)
    
    # 4. Reiniciar workers muertos (límite 5/hora)
    restart_dead_workers(machine_name)
    
    # 5. Rescatar DNIs atascados cada 60s
    if now - last_rescue > 60:
        rescue_stale_dnis(minutos=30)
    
    # 6. Liberar leads inactivos (>3 días) de madrugada
    if 2 <= now.hour < 3:
        release_stale_leads(dias=3)
```

### Comandos aceptados

| Comando | Parámetros | Efecto |
|---------|-----------|--------|
| `iniciar` | `workers: 5` | Lanza N workers |
| `detener` | — | Detiene todos los workers |
| `pausar` | `segundos: 10` | Pausa temporal (desde worker) |

---

## Worker (`worker_loop.py`)

### Algoritmo principal

```python
def main():
    # 1. Login inicial en Pangea
    if not login_loop(page, cred_user, cred_pass):
        return  # error fatal
    
    while not detenido:
        # 2. Verificar comandos del frontend
        for cmd in check_command(machine_name):
            if cmd == "detener": detenido = True
            if cmd == "pausar": time.sleep(pausa)
        
        # 3. Obtener siguiente DNI pendiente
        dni_data = next_dni()
        if not dni_data:
            time.sleep(5)  # sin trabajo → esperar
            continue
        
        # 4. Touch: mantener vivo el DNI
        touch_dni(id_cliente)
        
        # 5. Extraer datos de Pangea
        datos = extraer_datos_estructurados(page, dni)
        
        # 6. Sincronizar con backend (3 reintentos con backoff)
        if sync_result(id_cliente, datos):
            procesados += 1
        
        # 7. Reciclar navegador cada 50 DNIs
        if recycle_count >= 50:
            reciclar_navegador()
```

### Login en Pangea (`login.py`)

```python
def login_loop(page, cred_user, cred_pass, dni_touch=None):
    """Login con 10 reintentos. Maneja MaxSessionsError."""
    max_reintentos = 10
    intento = 0
    while intento < max_reintentos:
        try:
            page.goto(ORANGE_URL, timeout=90000)
            manejar_cookies_flexible(page)
            realizar_login(page, cred_user, cred_pass)
            seleccionar_marca_orange(page)
            abrir_nuevo_acto_comercial(page)
            return True
        except MaxSessionsError:
            # Máximo de sesiones: esperar 5 min y reintentar SIN LÍMITE
            for _ in range(10):  # 10 x 30s = 5 min
                time.sleep(30)
                if dni_touch: touch_dni(dni_touch)
            continue  # no incrementa intento → loop infinito
        except Exception:
            intento += 1
            time.sleep(60)
    return False
```

### Blindaje Anti-Herramientas

El bot inyecta CSS al iniciar cada página para ocultar el menú de herramientas de Pangea, evitando clicks accidentales que bloquean la sesión:

```python
# browser_setup.py
context.add_init_script("""
    const style = document.createElement('style');
    style.textContent = `
        .o-comp__tools-menu-container,
        div[ng-show="toolsCtrl.showMenu"] {
            display: none !important;
            pointer-events: none !important;
        }
    `;
    document.head.appendChild(style);
""")
```

---

## Manejo de Errores y Resiliencia

### Sync con reintentos (`sync_result`)

```python
def sync_result(id_cliente, datos, estado="completado"):
    """3 reintentos con backoff exponencial (2s, 4s, 8s).
    Si todos fallan → marca error_sync."""
    for intento in range(1, 4):
        if api_post("/api/internal/bot-sync", {...}):
            return True
        time.sleep(2 ** intento)
    
    # Fallback: marcar como error_sync
    api_post("/api/internal/bot-sync", {..., "estado": "error_sync"})
    return False
```

### Rescate de DNIs atascados

El coordinator ejecuta `rescue_stale_dnis()` cada 60 segundos:

```sql
UPDATE clientes_proyectos
SET datos = jsonb_set(datos, '{estado}', '"pendiente"')
WHERE datos->>'estado' = 'en_progreso'
  AND updated_at < now() - '30 minutes'::interval
```

### Reciclaje de navegador

Cada 50 DNIs procesados, el worker cierra y reabre el navegador para liberar memoria y evitar detección.

### Watchdog

Cada extracción tiene un timeout de 40 segundos. Si se excede, se hace reload y relogin:

```python
with Watchdog(f"dni-{dni}"):
    datos = extraer_datos_estructurados(page, dni)
# WatchdogTimeout → reload + login_loop()
```

---

## Configuración del navegador (`browser_setup.py`)

```python
# Headless por defecto en producción
headless = os.getenv("BOT_HEADLESS", "1") != "0"

launch_args = {
    "headless": headless,
    "args": [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
    ],
}

context_args = {
    "timezone_id": "Europe/Madrid",
    "locale": "es-ES",
    "geolocation": {"longitude": -3.703790, "latitude": 40.416775},
    "viewport": {"width": 1366, "height": 768},
    "user_agent": "Mozilla/5.0 ... Chrome/125.0.0.0 Safari/537.36",
}
```

### Proxies

Los proxies se cargan desde `bot/proxies.txt` (uno por worker, rotativo):

```
# Formato: ip:puerto:usuario:contraseña
192.168.1.100:8080:user:pass
```

### Stealth

```python
from playwright_stealth import stealth_sync
stealth_sync(page)
```
