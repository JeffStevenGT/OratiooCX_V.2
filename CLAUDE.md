# Oratioo CX

Call center automation platform. Bot scrapes Pangea (Orange carrier portal) for customer data, stores in PostgreSQL, and serves via Next.js dashboard.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript |
| Estilos | Tailwind CSS |
| Bot | Python 3 + Playwright (Chromium) |
| BD | PostgreSQL (vía Next.js API interna) |
| Auth | NextAuth.js (credentials + JWT, 8h expiry) |
| VoIP | VPBX (Click2Call, grabaciones, CDR) |
| Mensajería | Meta Cloud API (WhatsApp) |
| Almacenamiento | VPBX nativo (grabaciones 1 año) |
| Cache/Colas | Redis (opcional, fallback automático sin Redis) |

---

## Estructura completa de archivos

### `bot/` — Bot Python (scraping de Pangea Orange)

```
bot/
├── coordinator_loop.py    # Daemon 24/7: lanza workers, polling de comandos, heartbeat, rescate DNIs
├── worker_loop.py         # Worker individual: toma DNI de API → login → extrae → sync vía API
├── worker_structured.py   # Worker con Watchdog 40s + Stealth (testing, --dni flag)
├── bot_http.py            # Cliente HTTP: sync_resultado() y sync_no_cliente()
├── login.py               # Lógica de login + extracción de datos (pestañas, estados, campañas)
├── browser_setup.py       # Config Chromium: geolocalización España, proxies, user-agent
├── main.py                # Standalone local: lee numeros.txt, extrae, guarda en JSON
├── piloto.py              # Piloto multi-worker sin BD (verbose dump de todas las pestañas)
├── test_bot.py            # Test rápido de 1 DNI por API
├── requirements.txt       # playwright, python-dotenv
└── clean_logs.bat         # Limpieza de logs de workers
```

### `src/` — Frontend Next.js

```
src/
├── middleware.ts                    # Auth middleware + role-based route protection
├── app/
│   ├── layout.tsx                   # Root layout
│   ├── page.tsx                     # Redirect /
│   ├── not-found.tsx                # 404
│   ├── login/page.tsx               # Login con credentials
│   ├── inicio/                      # Splash screen post-login + config overlay de proyectos
│   └── (dashboard)/                 # Rutas protegidas
│       ├── layout.tsx               # Layout con Sidebar + ProjectSelector
│       ├── admin/page.tsx           # Admin (it/desarrollador)
│       │   └── admin/anuncios/page.tsx # Gestión de anuncios
│       ├── agenda/page.tsx          # Agenda de leads
│       ├── alertas/page.tsx         # Alertas y detecciones
│       ├── asesor/page.tsx          # Vista de asesor
│       ├── asignar-leads/page.tsx   # Asignación por chips (jerarquía CEO→Jefe→Sup→Asesor)
│       ├── auditoria/page.tsx       # Auditoría del sistema
│       ├── backoffice/page.tsx      # Backoffice / tramitación
│       ├── bots/page.tsx            # Control de bots y workers
│       ├── calidad/page.tsx         # QA / calidad
│       ├── clientes/page.tsx        # Clientes con datos del bot
│       ├── estadisticas/page.tsx    # Estadísticas de pipeline + tiempos operativos
│       ├── inteligencia/page.tsx    # Scoring y forecast
│       ├── jefe/page.tsx            # Vista de jefe de área
│       ├── metas/page.tsx           # Metas y objetivos
│       ├── perfil/page.tsx          # Perfil de usuario
│       ├── power-dialer/page.tsx    # Discador con campos dinámicos por proyecto + pausas
│       ├── proyectos/page.tsx       # Gestión de proyectos (accesible desde /inicio solamente)
│       ├── rendimiento/page.tsx     # Rendimiento de asesores
│       ├── supervisor/page.tsx      # Vista de supervisor + LivePanel + PausasResumen
│       ├── usuarios/page.tsx        # CRUD de usuarios
│       ├── vpbx/page.tsx            # Gestión VPBX: extensiones + agentes en vivo
│       ├── wikiratioo/page.tsx      # Wiki / documentación (progreso por usuario)
│       └── fichaje/page.tsx         # Fichaje electrónico (RD-ley 8/2019 España)
├── components/
│   ├── clientes/FichaCliente.tsx
│   └── shared/
│       ├── Sidebar.tsx          # Sidebar v2: acordeón, badges rojos, jerarquía visual
│       ├── LivePanel.tsx        # Panel en vivo con pausas y timers
│       ├── MiEstado.tsx         # Widget de pausa para Power Dialer
│       ├── FlipCard.tsx         # Card que gira al hacer click
│       ├── Paginator.tsx        # Paginación unificada (Mostrar [10▼] de N)
│       ├── Toast.tsx, StatCard.tsx
│       ├── AnunciosModal.tsx     # Modal full-screen de anuncios al entrar al proyecto
│       ├── ClipboardModal.tsx, NotificationBadge.tsx
│       ├── OratiooLogo.tsx, ProjectSelector.tsx, WhatsAppChat.tsx
│       ├── Skeleton.tsx, ThemeProvider.tsx
│       ├── TopLoader.tsx      # Barra de progreso al navegar (feedback instantáneo)
│       ├── ErrorBoundary.tsx   # Captura crashes de React
│       ├── OfflineIndicator.tsx # Banner cuando no hay conexión
│       └── Breadcrumb.tsx, Tooltip.tsx
└── lib/
    ├── db.ts              # Pool PostgreSQL (max 20, timeout 30s)
    ├── auth.ts            # NextAuth.js config (credentials + JWT)
    ├── auth-roles.ts      # requireRole(), requireAuth(), requirePipelineOwnership()
    ├── vpbx.ts            # Cliente VPBX (15 funciones: originate, CDR, agentes, extensiones, grabaciones, TTS)
    ├── redis.ts           # Redis client (@upstash/redis): rate limit, webhook queue, cache TTL, pub/sub
    ├── whatsapp.ts        # Meta Cloud API (sendText, sendTemplate, webhook)
    ├── storage.ts         # Cloudflare R2 (@deprecated, se usa VPBX nativo)
    ├── project-context.tsx # Contexto de proyecto seleccionado (incluye config)
    ├── pipeline-colors.ts # Colores para estados de pipeline
    ├── keyboard-shortcuts.ts
    └── api-helpers.ts     # Helpers para API routes
```

### `src/app/api/` — API Routes (59 endpoints)

```
api/
├── auth/[...nextauth]/route.ts     # NextAuth.js handler
├── health/route.ts                  # Healthcheck (público)
├── sse/route.ts                     # SSE notificaciones (auth requerida)
│
├── bot/                             # Endpoints internos del bot (x-bot-api-key)
│   ├── command/route.ts             # POST (frontend) / GET (coordinator polling)
│   ├── next-dni/route.ts            # GET → siguiente DNI pendiente (FOR UPDATE SKIP LOCKED)
│   ├── credenciales/route.ts        # GET → credenciales Pangea activas
│   ├── touch/route.ts               # PATCH → mantener vivo DNI durante procesamiento
│   └── reset-stale/route.ts         # POST → rescatar DNIs atascados
│
├── internal/
│   └── bot-sync/route.ts            # POST → guardar resultados + detectar cambios
│
├── anuncios/route.ts                  # CRUD anuncios (supervisor+)
├── anuncios/no-leidos/route.ts        # GET anuncios no leídos por rol
├── anuncios/marcar-leido/route.ts     # POST marcar como leídos
├── anuncios/cumpleanos-auto/route.ts  # POST generar anuncio de cumpleaños
├── maquinas/route.ts                # CRUD máquinas + heartbeat PATCH
├── clientes/route.ts                # GET clientes con datos del bot
├── clientes/[id]/route.ts           # GET/PATCH cliente individual
├── clientes/reanalizar/route.ts     # POST → reanalizar cliente
├── pipeline/route.ts                # GET/POST/PATCH/DELETE pipeline (multi-proyecto)
├── pipeline/mine/route.ts           # GET → mis leads (filtra por proyecto_id)
├── pipeline/agenda/route.ts         # Agenda
├── pipeline/estadisticas/route.ts   # Estadísticas + tiempos operativos (pausas + CDR)
├── pipeline/intento/route.ts        # Registrar intento de contacto
├── pipeline/tipificar/route.ts      # Tipificar lead
├── pipeline/tramitacion/route.ts    # Tramitación backoffice
├── pipeline/release-stale/route.ts  # Liberar leads inactivos
├── pipeline/liberados/route.ts      # Leads liberados
├── pipeline/notifications/route.ts  # Notificaciones (contextual por rol/proyecto)
├── pipeline/backoffice-stats/route.ts
│
├── pausas/route.ts                  # CRUD de pausas: POST iniciar, PUT finalizar, GET historial
├── proxies/route.ts                 # CRUD proxies.txt
├── usuarios/route.ts                # CRUD usuarios + extension_vpbx
├── configuracion/route.ts           # Config dinámica clave-valor
├── proyectos/route.ts               # CRUD proyectos + config JSONB (logo_url, campos_lead, metas)
├── proyectos/stats/route.ts         # Stats por proyecto
├── auditoria/route.ts               # Historial del sistema
├── compras/route.ts                 # Scoring de compras
├── detecciones/route.ts             # Detecciones de cambios
├── listas-negras/route.ts           # Listas negras
├── tipificaciones-config/route.ts   # Config de tipificaciones
├── qa/route.ts                      # Quality assurance
├── documentos/cola/route.ts         # Cola de DNIs desde documentos
├── documentos/upload/route.ts       # Upload de Excel
├── perfil/password/route.ts         # Cambiar contraseña
├── fichajes/route.ts                # Fichaje electrónico (POST, GET historial)
├── fichajes/equipo/route.ts         # Vista equipo: fichajes del día + pausas
├── whatsapp/send/route.ts           # Enviar WhatsApp
├── whatsapp/plantillas/route.ts     # Plantillas WhatsApp
├── webhooks/vpbx/route.ts           # Webhook VPBX (CDR events + Redis queue)
├── webhooks/whatsapp/route.ts       # Webhook WhatsApp (incoming)
├── vpbx/agents/route.ts             # Agentes VPBX (cache Redis 5s)
├── vpbx/extensions/route.ts         # Extensiones + usuarios asignados (GET + PUT invalidar cache)
├── vpbx/originate/route.ts          # Click2Call (rate limit Redis)
├── vpbx/cdr/[callId]/vars/route.ts  # Variables CDR
├── dashboard/abandono/route.ts
├── dashboard/cinturones/route.ts
├── dashboard/forecast/route.ts
├── dashboard/notificaciones/route.ts
├── dashboard/proyecto/route.ts
├── dashboard/rendimiento/route.ts
├── dashboard/reportes/route.ts
├── dashboard/reutilizacion/route.ts
├── dashboard/salud-base/route.ts
├── dashboard/scoring/route.ts
├── dashboard/scoring-contactabilidad/route.ts
├── admin/credenciales/route.ts
├── admin/credenciales/[id]/route.ts
└── admin/stats/route.ts
```

---

## Arquitectura del Bot

### Flujo de producción

```
┌─────────────────────────────────────────────────────────┐
│ coordinator_loop.py (daemon 24/7)                       │
│                                                         │
│  1. Se registra con nombre de máquina                   │
│  2. Heartbeat cada 30s → PATCH /api/maquinas            │
│  3. Polling GET /api/bot/command?maquina=X cada 5s      │
│  4. Rescata DNIs atascados cada 60s                     │
│  5. Libera leads inactivos a las 2 AM                   │
│  6. Auto-reinicia workers muertos (máx 5/hora)          │
│                                                         │
│  ┌─ worker_loop.py (PID 1) ─┐                           │
│  │ GET /api/bot/next-dni    │                           │
│  │ Login Pangea             │                           │
│  │ Extraer datos            │                           │
│  │ POST /api/internal/      │                           │
│  │   bot-sync               │                           │
│  │ PATCH /api/bot/touch     │ (mantiene vivo el DNI)    │
│  └──────────────────────────┘                           │
│  ┌─ worker_loop.py (PID 2) ─┐ (mismo flujo, otro proxy) │
│  └──────────────────────────┘                           │
│  ...                                                    │
└─────────────────────────────────────────────────────────┘
```

### Modos de ejecución

| Modo | Comando | Usa BD | Cuándo |
|---|---|---|---|
| Producción | `python coordinator_loop.py --machine-name X --workers N` | ✅ PostgreSQL vía API | 24/7 |
| Test individual | `python test_bot.py` | ✅ API (1 DNI) | Debug |
| Test estructurado | `python worker_structured.py --dni XXXXXXXXX` | ✅ API (1 DNI) | Debug detallado |
| Local standalone | `python main.py` | ❌ Solo JSON | Pruebas sin red |
| Piloto | `python piloto.py --workers N` | ❌ Solo logs | Dump masivo |

---

## Base de Datos

### Tablas principales

| Tabla | Propósito |
|---|---|
| `clientes` | Entidad única por `id_cliente` (DNI_..., NIE_..., NIF_...) |
| `proyectos` | Proyectos con `config` JSONB (logo_url, campos_lead, metas, cooldown, etc.) |
| `clientes_proyectos` | Datos JSONB por cliente+proyecto (UPSERT, un cliente puede estar en N proyectos) |
| `historial` | Timeline único: extracciones, llamadas, tipificaciones, compras |
| `pipeline` | Estado comercial multi-proyecto: filtrado por `proyecto_id` |
| `usuarios` | Auth con roles + `extension_vpbx` |
| `maquinas` | Workers distribuidos: heartbeat, workers_activos |
| `comandos_bot` | Cola de comandos del frontend al coordinator |
| `configuracion` | Clave-valor dinámico |
| `detecciones` | Cambios detectados entre análisis |
| `analisis_perdidos` | Leads cerrados como no_interesa/no_contesta |
| `pausas` | Tracking de pausas: tipo, inicio, fin, duración |
| `anuncios` | Anuncios/comunicados multi-rol con tipos y roles_visibles |
| `anuncios_leidos` | Tracking de qué usuario leyó cada anuncio |
| `fichajes` | Fichaje electrónico: entrada/salida (España RD-ley 8/2019) |
| `cdr_vpbx` | Registro de llamadas VPBX |

### Roles

| Rol | Permisos |
|---|---|
| `asesor` | Solo sus leads, perfil, wikiraatioo, power-dialer, pausas |
| `supervisor` | Su equipo, estadísticas, asignación, pipeline, calidad, metas, VPBX |
| `jefe_area` | Todo excepto admin. Configura proyectos. |
| `back_office` | Tramitación, clientes, perfil |
| `auditor_calidad` | Calidad, perfil, wikiraatioo |
| `it` | Infraestructura (dentro de Apps), VPBX, configuración |
| `desarrollador` | **Todo** (bypass en middleware). Configura proyectos desde /inicio. |

### Jerarquía de asignación de leads

```
CEO / Dev → asigna a Jefes de Área
Jefe de Área → asigna a Supervisores
Supervisor → asigna a Asesores
```

Asignación por chips: cada subordinado es un chip con input numérico. Botón "Repartir igual" divide equitativamente.

---

## Variables de Entorno (`.env.local`)

```bash
# Base de datos
DATABASE_URL=postgresql://postgres@localhost:5433/oratioo_cx

# NextAuth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000

# VPBX
VPBX_API_KEY=...
VPBX_API_URL=https://vpbx.me/api

# Bot Pangea
BOT_API_KEY=oratioo-bot-internal-key

# Redis (opcional — sin configurar = fallback automático a memoria)
REDIS_URL=
REDIS_TOKEN=

# Cloudflare R2 (@deprecated, se usa VPBX nativo para grabaciones)
R2_ENDPOINT=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```

---

## Sistema de Pausas

- **Tabla `pausas`**: tipo (baño, almuerzo, descanso, reunión, capacitación, otro), inicio, fin, duración
- **API**: POST iniciar, PUT finalizar, GET historial (?activa=1, ?hoy=1, ?equipo=1)
- **Power Dialer**: botón ⏸ en header → modal con tipos → pantalla completa bloqueante con timer
- **LivePanel (supervisor)**: timer con color graduado (blanco→ámbar→naranja→rojo según tiempo)
- **Sin límites automáticos**: el supervisor decide. Los colores son solo señal visual.

## Sistema de Anuncios

- **Tabla `anuncios`**: proyecto_id, titulo, mensaje, tipo (general/record_ventas/festividad/cambio_condiciones/cumpleanos), roles_visibles (text[]), creado_por, activo
- **Tabla `anuncios_leidos`**: (anuncio_id, user_id) PK compuesta, leido_at
- **API**: CRUD en `/api/anuncios` (POST requiere supervisor+), GET `/api/anuncios/no-leidos?proyecto_id=X` (filtrado por rol), POST `/api/anuncios/marcar-leido`
- **Modal al entrar**: al hacer click en un proyecto desde `/inicio`, se muestra `AnunciosModal` con anuncios no leídos filtrados por el rol del usuario y `roles_visibles`
- **Sin anuncios nuevos**: salta directo al dashboard sin molestar
- **Admin**: página `/admin/anuncios` con formulario de creación (título, mensaje, tipo, selector de roles visibles) + lista con toggle activar/desactivar
- **Cumpleaños automático**: cron job diario a las 00:05 AM (hora Perú) llama a `POST /api/anuncios/cumpleanos-auto` que busca usuarios con `fecha_nacimiento = hoy` y publica anuncio tipo `cumpleanos` visible para todos los roles

## Cumpleaños

- **Campo `fecha_nacimiento`** en tabla `usuarios` (date, nullable)
- **Alta/edición**: campo date en formulario de creación y edición de usuarios
- **API**: incluido en GET/POST/PATCH de `/api/usuarios`
- **Auto-anuncio**: `POST /api/anuncios/cumpleanos-auto` se ejecuta diariamente vía cron. Si hay cumpleañeros, publica anuncio con nombres. Si no, no hace nada.
- **Zona horaria**: el cron corre en `America/Lima` (GMT-5). El anuncio dura 24h, cubriendo tanto Perú como España.

## Ranking con Metas

- **`GET /api/dashboard/rendimiento`** devuelve:
  - `ranking[]` — todos los asesores ordenados por ventas con posición, ventas, contactados, contactabilidad, efectividad, tasa_contestacion, ocupacion, wrap_up, calidad
  - `porcentaje_meta` — % respecto a la meta mensual (de tabla `metas`)
  - `media_necesaria` — ventas/día restantes para alcanzar la meta
  - `estado_meta` — `cumplida` (100%+), `en_camino` (75%+), `retrasado` (<75%), `sin_meta`
- **Cálculo**: usa la meta del mes actual (`metas.mes = 'YYYY-MM'`) para cada asesor, días restantes del mes

## Multi-proyecto

- Un mismo cliente puede estar en N proyectos vía `clientes_proyectos.proyecto_id`
- Cada proyecto define sus `campos_lead` en `proyectos.config` JSONB
- El Power Dialer renderiza los campos dinámicamente según el proyecto activo
- Las APIs filtran por `proyecto_id` para aislar datos
- Configuración de proyectos via overlay en `/inicio` (solo admin/dev)
- Solo existe el proyecto Orange (mainjobs e impresoras eliminados)

## Reglas del proyecto

1. **Nunca modificar** `node_modules/` ni `.next/`
2. **Workers usan proxies 1:1** — cada worker recibe un proxy exclusivo
3. **PostgreSQL solo vía API** — el bot nunca toca la BD directamente
4. **UPSERT por `(id_cliente, proyecto_id)`** — un registro por cliente+proyecto
5. **Coordinador multi-máquina** — cada máquina se registra con nombre único
6. **Datos de clientes confidenciales** — no se comparten con terceros
7. **`proxies.txt` y `numeros.txt`** están en `.gitignore`
8. **Auth en todas las API routes** — usar `requireAuth()` o `requireRole()`
9. **API key `x-bot-api-key`** en endpoints internos del bot
10. **NO se usa Supabase** — eliminado completamente (2026-06-09)
11. **Redis es opcional** — sin `REDIS_URL` todo funciona en memoria (rate limit, cache, colas)
12. **Multi-proyecto** — filtrar siempre por `proyecto_id` en queries
13. **Migraciones ya aplicadas** — no tocar la BD directamente, usar API

---

## Convenciones

- TypeScript estricto en frontend
- Python con type hints en bot
- Commits en español, formato [conventional commits](https://www.conventionalcommits.org/)
- Rama activa: `submaster`
- Build: `next build` (Next.js 15.5.19)
- BD local: `postgresql://postgres@localhost:5433/oratioo_cx`
- Deploy: Docker (Dockerfile + docker-compose.yml)

## Cumplimiento Normativo Fichaje (España)

| Norma | Requisito | Cumple |
|-------|-----------|:---:|
| RD-ley 8/2019 | Registro diario de jornada | ✅ |
| RD-ley 8/2019 | Conservación 4 años | ✅ |
| RD-ley 8/2019 | Acceso del trabajador + inspección | ✅ |
| Ley 10/2021 | Modalidad presencial/remoto | ✅ |
| RD-ley 2/2024 | Usuario desactivado no ficha (triple check) | ✅ |

Ver docs/Oratioo CX - PRD.md sección 5.3 para detalle completo.
