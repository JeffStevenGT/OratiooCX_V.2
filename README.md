# Oratioo CX — CRM Omnicanal

> CRM con bots de extracción, discador VPBX, WhatsApp y pipeline comercial.
> Stack: Next.js 15 + PostgreSQL + Python/Playwright

## 🚀 Quick Start

```bash
# Terminal 1 — Frontend + API
npm install
npm run dev          # http://localhost:3000

# Terminal 2 — Bot (coordinator daemon)
python bot/coordinator_loop.py --machine-name localhost
```

## 📂 Estructura

```
Oratioo_CX/
├── src/                    # Next.js (App Router)
│   ├── app/
│   │   ├── (dashboard)/    # Páginas protegidas por rol
│   │   │   ├── admin/documentos/  ← Subida de DNIs
│   │   │   ├── bots/              ← Control remoto
│   │   │   ├── clientes/          ← Tabla con datos del bot
│   │   │   └── infraestructura/   ← Proxies + máquinas
│   │   └── api/            # API Routes (18 endpoints)
│   ├── components/         # Sidebar, FichaCliente, CallButton
│   └── lib/                # db.ts, auth.ts, vpbx.ts
├── bot/                    # Bots Python (Playwright)
│   ├── coordinator_loop.py ← Daemon multi-worker + heartbeat
│   ├── worker_loop.py      ← Worker continuo + touch + watchdog
│   ├── login.py            ← Login + extracción Orange
│   └── browser_setup.py    ← Config navegador + proxy España
├── supabase/               # Migraciones SQL
│   ├── 001_migracion_inicial.sql
│   └── 002_maquinas.sql
├── proxies.txt             # Lista de proxies ip:puerto:user:pass
└── .env.local              # DATABASE_URL, ORANGE_USER, ORANGE_PASS
```

## 🗄️ Base de Datos

PostgreSQL local (puerto 5433). Tablas principales:

| Tabla | Uso |
|---|---|
| `clientes` | Core: DNI/NIE/NIF + tipo_persona |
| `clientes_proyectos` | Datos extraídos por proyecto (JSONB) |
| `historial` | Timeline + triggers de auditoría |
| `pipeline` | Estados comerciales |
| `comandos_bot` | Control remoto multi-máquina |
| `maquinas` | Catálogo de VPS + heartbeat |

## 🤖 Flujo del Bot

```
Documentos → subir .xlsx/.csv → DNIs pendientes
Bots → seleccionar máquina → Iniciar con N workers
Workers → GET /api/bot/next-dni → extraer Orange → POST /api/internal/bot-sync
Clientes → ver resultados con filtros, desplegable, export CSV
```

## 🔧 Endpoints Clave

| Endpoint | Descripción |
|---|---|
| `/api/bot/command` | Control remoto (iniciar/detener/pausar) |
| `/api/bot/next-dni` | Siguiente DNI pendiente (FOR UPDATE SKIP LOCKED) |
| `/api/bot/touch` | Mantener vivo DNI durante procesamiento |
| `/api/bot/reset-stale` | Rescatar DNIs atascados (>30 min) |
| `/api/internal/bot-sync` | Guardar resultado del bot |
| `/api/documentos/upload` | Subir archivo (.csv/.txt/.xlsx) |
| `/api/documentos/cola` | Estado de cola de DNIs |
| `/api/proxies` | CRUD proxies (proxies.txt) |
| `/api/maquinas` | CRUD máquinas + heartbeat |

## 📋 Comandos Útiles

```bash
# Bot
python bot/coordinator_loop.py --machine-name localhost --workers 5
python bot/coordinator_loop.py --machine-name localhost   # espera comando del front

# BD
node -e "const {Pool}=require('pg');const p=new Pool({connectionString:'postgresql://postgres@localhost:5433/oratioo_cx'});p.query(require('fs').readFileSync('supabase/002_maquinas.sql','utf8')).then(()=>{console.log('OK');p.end()})"

# Build
npx next build --no-lint
```
