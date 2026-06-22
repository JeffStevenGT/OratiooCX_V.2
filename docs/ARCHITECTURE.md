# ARCHITECTURE.md — Arquitectura de OratiooCX_V.2

## Visión general

OratiooCX_V.2 sigue una arquitectura de **tres capas** con comunicación vía API REST:

```
┌─────────────────────────────────────────────────────────────────┐
│                        CAPA DE DATOS                            │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌────────────┐  │
│  │ clientes │   │ pipeline │   │ usuarios │   │ historial  │  │
│  └──────────┘   └──────────┘   └──────────┘   └────────────┘  │
│  ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │clientes_proy │ │ pausas   │ │detecciones│ │ cdr_vpbx     │  │
│  └──────────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│                      PostgreSQL 15                              │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ pg (Node.js) / requests (Python)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CAPA DE API (Next.js)                       │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ middleware.ts│  │ api/bot/*    │  │ api/pipeline/*         │ │
│  │ (auth JWT)   │  │ (x-bot-key)  │  │ (role-based)           │ │
│  └─────────────┘  └──────────────┘  └────────────────────────┘ │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ api/internal │  │ api/vpbx/*   │  │ api/whatsapp/*         │ │
│  │ bot-sync     │  │ (VoIP)       │  │ (Meta Cloud)           │ │
│  └─────────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
              ▲                           ▲
              │ REST (x-bot-api-key)      │ REST (JWT session)
              ▼                           ▼
┌──────────────────────┐    ┌─────────────────────────────────────┐
│    CAPA BOT (Python)  │    │       CAPA FRONTEND (React)         │
│                       │    │                                      │
│  coordinator_loop.py  │    │  (dashboard)/                        │
│  ├─ spawn_workers()   │    │  ├─ jefe/       (visión ejecutiva)  │
│  ├─ poll_commands()   │    │  ├─ supervisor/ (live panel)         │
│  ├─ send_heartbeat()  │    │  ├─ asesor/     (power dialer)      │
│  └─ rescue_stale()    │    │  ├─ estadisticas/ (KPIs)            │
│                       │    │  ├─ rendimiento/ (ranking)          │
│  worker_loop.py       │    │  └─ ... (23 páginas)                │
│  ├─ next_dni()        │    │                                      │
│  ├─ login_loop()      │    │  componentes compartidos:            │
│  ├─ extraer_datos()   │    │  ├─ Sidebar, LivePanel, FlipCard    │
│  └─ sync_result()     │    │  ├─ ClipboardModal, AnunciosModal   │
│                       │    │  └─ Skeleton, Toast, TopLoader      │
└──────────────────────┘    └─────────────────────────────────────┘
```

---

## Flujo de extracción (Bot → API → DB)

### 1. Coordinator Daemon (`coordinator_loop.py`)

```python
# Arranque
python coordinator_loop.py --machine-name vps-espana-1 --workers 5
```

- Corre 24/7, se registra con nombre de máquina
- Envía heartbeat cada 30s (`PATCH /api/maquinas`)
- Polling de comandos cada 5s (`GET /api/bot/command?maquina=NOMBRE`)
- Lanza N workers (`worker_loop.py`) con credenciales Pangea como env vars
- Auto-reinicia workers muertos (límite: 5/hora)
- Rescata DNIs atascados en `en_progreso` (>30 min sin touch)
- Libera leads inactivos (>3 días) de madrugada (2-3 AM)

### 2. Worker (`worker_loop.py`)

```python
# Lanzado por el coordinator
python worker_loop.py --proxy --worker-id 0 --machine vps-espana-1
```

**Ciclo de vida:**

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ next_dni │───►│  login   │───►│ extraer  │───►│  sync    │
│ (GET)    │    │ Pangea   │    │ datos    │    │ (POST)   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     ▲                                               │
     └───────────────────────────────────────────────┘
                    (loop infinito)
```

### 3. API Interna (`api/internal/bot-sync`)

```typescript
// Transacción atómica con SELECT FOR UPDATE
await transaction(async (client) => {
  // 1. Leer datos anteriores con lock
  const prev = await client.query(
    `SELECT datos FROM clientes_proyectos 
     WHERE id_cliente = $1 AND proyecto_id = $2 FOR UPDATE`,
    [id_cliente, pid]
  );

  // 2. UPSERT datos nuevos
  await client.query(
    `INSERT INTO clientes_proyectos (...) VALUES (...)
     ON CONFLICT (id_cliente, proyecto_id) DO UPDATE ...`
  );

  // 3. Detectar cambios vs análisis anterior
  const cambios = detectarCambios(datosViejos, datosNuevos);

  // 4. INSERT batch de detecciones
  // 5. INSERT historial
});
```

---

## Estados del pipeline

```
pendiente ──► contactado ──► interesado ──► negociacion ──► venta
    │              │              │
    └──► no_contesta│              └──► no_interesa
                   │
                   └──► buzon
```

---

## Sistema de archivos del bot

| Archivo | Función |
|---------|---------|
| `coordinator_loop.py` | Daemon principal: orquesta workers, heartbeat, comandos |
| `worker_loop.py` | Worker de producción: polling API, login, extracción, sync |
| `worker_structured.py` | Worker con Watchdog 40s + Stealth (para testing con `--dni`) |
| `login.py` | Lógica de login en Pangea: cookies, MultiSession, Anti-Herramientas |
| `browser_setup.py` | Config Chromium: geolocalización España, proxies rotativos, user-agent |
| `bot_http.py` | Cliente HTTP para sync vía API |
| `main.py` | Standalone: lee `numeros.txt`, extrae, guarda JSON local |
| `proxies.txt` | Lista de proxies (formato `ip:puerto:user:pass`) |

---

## Comunicación entre capas

| Origen | Destino | Protocolo | Auth |
|--------|---------|-----------|------|
| Coordinator → API | `GET/PATCH /api/bot/*` | HTTPS | `x-bot-api-key` |
| Worker → API | `GET/POST /api/bot/*`, `/api/internal/*` | HTTPS | `x-bot-api-key` |
| Frontend → API | Todas las rutas | HTTPS | JWT (NextAuth) |
| API → PostgreSQL | Conexión directa | TCP 5432 | `DATABASE_URL` |
| API → VPBX | REST | HTTPS | API key VPBX |
| API → WhatsApp | Meta Cloud API | HTTPS | Token permanente |
