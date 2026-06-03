# Oratioo CX — Descripción General del Proyecto (v3.0)

> CRM omnicanal con bots, discador VPBX, WhatsApp, pipeline comercial y base de clientes 360°
> Actualizado: 03/06/2026 — Rama `submaster`

---

## 1. ¿Qué es Oratioo CX?

CRM omnicanal diseñado para **call centers** multi-campaña. Usa **bots automatizados** (Python + Playwright) que extraen datos reales de portales como Orange Pangea, eliminando la extracción manual de leads.

---

## 2. Stack Tecnológico (v3.0)

### Frontend + API

| Componente | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router) |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS 3.4 |
| Iconos | Lucide React |
| Estado | React Context |
| DB Driver | `pg` (Pool, 20 conexiones) |
| Auth | NextAuth.js (credentials + JWT) |

### Base de Datos

| Componente | Tecnología |
|---|---|
| Motor | PostgreSQL 16 |
| Dev | localhost:5433 |
| Prod objetivo | VPS Hetzner + Coolify |

### Bots (Python)

| Componente | Tecnología |
|---|---|
| Lenguaje | Python 3.13 |
| Automatización | Playwright (Chromium) |
| Proxies | 20 proxies españoles (1:1 por worker) |
| Conexión | API-First (HTTP a Next.js, cero PostgreSQL directo) |

### Comunicaciones

| Componente | Tecnología | Estado |
|---|---|---|
| Centralita | VPBX | Endpoints listos |
| WhatsApp | Meta Cloud API | Diseñado, pendiente |
| Redis | Colas + Webhooks | Pendiente |

### Despliegue

| Componente | Dev | Prod Objetivo |
|---|---|---|
| Web + API | localhost:3000 | VPS Hetzner CPX31/CPX41 + Coolify |
| BD | PostgreSQL local | PostgreSQL en VPS |
| Archivos | Disco local | Cloudflare R2 |
| Build | `next build` | `output: standalone` |

---

## 3. Arquitectura General (v3.0)

```
┌─────────────────────────────────────────┐
│         NEXT.JS (Standalone)            │
│                                         │
│  API Routes (18 endpoints)             │
│  /api/clientes  /api/bot/command        │
│  /api/documentos /api/proxies           │
│  /api/maquinas  /api/vpbx               │
│  /api/internal/bot-sync                 │
│                                         │
│  Pages: clientes, bots, infraestructura,│
│         documentos, power-dialer...     │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
┌────────┐ ┌──────┐ ┌─────────┐
│PostgreSQL│ │VPBX  │ │  R2     │
│(local/VPS)│ │API   │ │(futuro) │
└────────┘ └──────┘ └─────────┘
    ▲
    │ HTTP (API-First, sin conexión directa)
    │
┌───┴──────────────┐
│  BOTS (PC Local) │
│                  │
│ coordinator_loop │── Heartbeat + comandos
│ worker_loop × N  │── Extracción Orange
│                  │
│ proxies.txt      │── 20 IPs españolas
└──────────────────┘
```

---

## 4. Modelo de Datos

### Core: `clientes`
- `id_cliente TEXT PK` — `"DNI_12345678A"`, `"NIE_X1234567L"`, `"NIF_B12345678"`
- `tipo_persona` — natural (default para DNI/NIE), empresa (default para NIF), autonomo (editable)

### Datos por proyecto: `clientes_proyectos`
- `datos JSONB` — header, lineas, cima_global, estado
- Índices B-Tree sobre campos clave del JSONB

### Historial: `historial`
- Triggers automáticos: `trigger_auditoria_pipeline`, `trigger_auditoria_extraccion`

### WhatsApp: `whatsapp_mensajes` (diseñado)
- Campos RGPD en `clientes`: `whatsapp_opt_in`, `whatsapp_numero`, `whatsapp_opt_in_fecha`, `alertas_fidelizacion`

---

## 5. Bots Automatizados

### Flujo API-First
```
Worker → GET /api/bot/next-dni → recibe id_cliente
Worker → PATCH /api/bot/touch → marca updated_at
Worker → login + extracción Orange (Playwright)
Worker → POST /api/internal/bot-sync → guarda JSONB
```

### Mecanismos de Resiliencia
- Watchdog 40s por DNI
- Touch DNI en cada reintento de login
- Rescate automático de DNIs atascados (>30 min)
- `FOR UPDATE SKIP LOCKED` anti-duplicados
- Control multi-máquina vía `comandos_bot`

---

## 6. Power Dialer + VPBX

- Click2Call: `POST /api/vpbx/originate`
- Webhooks: RINGING / ANSWERED / HANGUP → `POST /api/webhooks/vpbx`
- CDR sync → tabla `cdr_vpbx`
- Protección: 5s debounce en botón de llamada
- Redis pendiente para responder webhooks en <50ms

---

## 7. WhatsApp + Flujo Renove

Ver doc dedicado: [[ORATIOO CX - WhatsApp y Notificaciones]]

- Doble Opt-In RGPD
- Alerta Renove automática: bot detecta → backend cruza opt-in → dispara WhatsApp
- Panel flotante de chat en frontend (Zustand)
- Tabla `whatsapp_mensajes` + campos RGPD en `clientes`

---

## 8. Pipeline Comercial

```
Pendiente → Contactado → Interesado → Negociación → Venta → Tramitado → Activado
                                              → No Interesa
                         → No Contesta → Callback 7 días
```

---

## 9. Roles y Permisos

| Rol | Acceso |
|---|---|
| Asesor | Dashboard, Power Dialer, Agenda, Wikiratioo |
| Supervisor | + Clientes, Metas, Alertas |
| Jefe Área | + Proyectos, Usuarios |
| Back Office | Dashboard, Tramitación |
| Admin/IT | + Infraestructura, Bots, Documentos |
| Desarrollador | Todo |

---

## 10. Roadmap

| 🔴 AHORA | 🟡 PRONTO | 🟢 DESPUÉS | ⬜ FUTURO |
|---|---|---|---|
| Probar bot con Pangea | Deploy VPS + Coolify | Power Dialer VPBX | Bots nuevos |
| Batching 20 DNIs | Redis para colas | WhatsApp + Renove | Wikiratioo |
| | standalone build | Pipeline UI + Dashboards | Docker + escalar |

---

## 11. Costos Proyectados

| Fase | Infra | Costo/mes |
|---|---|---|
| Dev (actual) | PostgreSQL local | $0 |
| Prod inicial | VPS Hetzner CPX31 | ~$20-40 |
| Escalado | CPX41 + R2 | ~$40-60 |
