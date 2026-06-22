# OratiooCX_V.2 — CRM Multi-Proyecto

**Plataforma de automatización de call center** con scraping de portales de carriers, pipeline de ventas, power dialer VoIP y dashboards de inteligencia comercial.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS |
| Bot | Python 3.11+ + Playwright (Chromium headless) |
| Base de datos | PostgreSQL (vía `pg` en Node.js) |
| Auth | NextAuth.js (credentials + JWT, 8h expiry) |
| VoIP | VPBX (Click2Call, grabaciones, CDR) |
| Mensajería | Meta Cloud API (WhatsApp) |
| Cache | Redis (opcional, fallback sin Redis) |

---

## Estructura del proyecto

```
OratiooCX_V.2/
├── bot/                    # Bot Python — scraping de portales carrier
│   ├── coordinator_loop.py # Daemon 24/7: lanza workers, heartbeat, rescate DNIs
│   ├── worker_loop.py      # Worker individual: toma DNI → login → extrae → sync
│   ├── worker_structured.py# Worker con Watchdog + Stealth (testing)
│   ├── login.py            # Lógica de login + extracción de datos
│   ├── browser_setup.py    # Config Chromium: geolocalización ES, proxies, headless
│   ├── bot_http.py         # Cliente HTTP: sync_resultado()
│   ├── main.py             # Standalone local: numeros.txt → JSON
│   └── requirements.txt    # playwright, python-dotenv
│
├── src/                    # Frontend Next.js + API Routes
│   ├── middleware.ts        # Auth middleware + role-based route protection
│   ├── app/
│   │   ├── inicio/          # Splash screen + config de proyectos
│   │   ├── login/           # Login con credentials
│   │   └── (dashboard)/     # Rutas protegidas (23 páginas)
│   ├── components/
│   │   └── shared/          # Sidebar, LivePanel, FlipCard, ClipboardModal, etc.
│   └── lib/
│       ├── db.ts            # Pool PostgreSQL (max 20, timeout 30s)
│       ├── auth.ts          # NextAuth.js config
│       ├── auth-roles.ts    # requireRole(), requireAuth()
│       ├── vpbx.ts          # Cliente VPBX (15 funciones)
│       ├── whatsapp.ts      # Meta Cloud API
│       └── redis.ts         # Redis client (Upstash)
│
├── migrations/              # Migraciones SQL
│   ├── 001_cumpleanos_anuncios.sql
│   └── 002_indices_rendimiento.sql
│
└── next.config.js           # Config standalone + security headers
```

---

## Roles del sistema

| Rol | Dashboard | Permisos |
|-----|-----------|----------|
| `desarrollador` | Jefe | Admin total: CRUD proyectos, usuarios, asignación masiva |
| `jefe_area` | Jefe | Vista ejecutiva, equipos, parámetros operativos |
| `supervisor` | Supervisor | LivePanel, asignación, pausas del equipo |
| `asesor` | Asesor | Power Dialer, mis leads, fichaje |
| `back_office` | Backoffice | Tramitación, documentos |
| `auditor_calidad` | Calidad | QA, scoring, auditoría |
| `it` | Admin | Usuarios, bots, infraestructura |

---

## Endpoints principales (59 rutas API)

| Grupo | Rutas | Descripción |
|-------|-------|-------------|
| `api/bot/` | `next-dni`, `command`, `touch`, `reset-stale`, `credenciales` | Comunicación con el bot Python |
| `api/pipeline/` | CRUD, `estadisticas`, `mine`, `agenda`, `intento`, `tipificar`, `tramitacion`, `release-stale`, `liberados`, `notifications` | Pipeline de ventas |
| `api/internal/` | `bot-sync` | Sync de resultados del bot (transacción atómica) |
| `api/dashboard/` | `proyecto`, `rendimiento`, `forecast`, `scoring`, `cinturones`, `salud-base` | Inteligencia comercial |
| `api/usuarios/` | CRUD | Gestión de usuarios |
| `api/vpbx/` | `originate`, `agents`, `extensions`, `cdr` | VoIP |
| `api/whatsapp/` | `send`, `plantillas` | Mensajería |

---

## Flujo de datos simplificado

```
┌──────────┐    ┌──────────────┐    ┌───────────┐    ┌──────────┐
│  Pangea  │    │  Bot Python  │    │  Next.js   │    │  Dashboard│
│ (Orange) │◄───│ (Playwright) │───►│  API REST  │───►│  (React)  │
└──────────┘    └──────────────┘    └───────────┘    └──────────┘
                       │                   │
                       ▼                   ▼
                ┌──────────────┐    ┌───────────┐
                │  PostgreSQL  │    │   VPBX    │
                │  (clientes,  │    │  (VoIP)   │
                │   pipeline)  │    └───────────┘
                └──────────────┘
```

---

## Seguridad

- **BOT_API_KEY**: requerida en `.env`, sin default inseguro. El bot y la API fallan si no está definida.
- **Credenciales Pangea**: se pasan vía variables de entorno (`ORANGE_USER`, `ORANGE_PASS`), nunca por argumentos CLI (visibles en `ps aux`).
- **Headless**: `True` por defecto en producción. Override con `BOT_HEADLESS=0` para debugging.
- **Rate limiting**: vía Redis (opcional).
- **Headers de seguridad**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
