# Oratioo CX — Documento de Requisitos Técnicos (TRD)

> **Versión:** 5.3 | **Fecha:** 12 Junio 2026 | **Autor:** Jeff Steven Gil Toribio
> **Stack:** Next.js 15 + TypeScript + PostgreSQL 16 + Python 3.13 + Playwright

---

## 1. Visión General Técnica

### 1.1 Arquitectura Híbrida

El sistema sigue una arquitectura **híbrida PC local + VPS**:

```
┌─────────────────────────────────────────────────────────────────┐
│  🖥️ PC LOCAL (Windows)                 ☁️ VPS HETZNER (Alemania) │
│                                                                 │
│  Bot Python + Playwright              Next.js 15 App Router     │
│  ├─ coordinator_loop.py               ├─ 20 páginas frontend    │
│  ├─ worker_loop.py (×N)               ├─ 59 endpoints API       │
│  ├─ login.py                          ├─ Middleware RBAC        │
│  ├─ browser_setup.py                  ├─ NextAuth.js v5         │
│  └─ bot_http.py                       ├─ PostgreSQL 16          │
│       │                               ├─ Redis (opcional)       │
│       │ API HTTP                      └─ Nginx + SSL            │
│       └─────────────────────────────────┤                       │
│                                         │                       │
│  20 proxies españoles                   │                       │
│  Chromium headless                      │                       │
└─────────────────────────────────────────────────────────────────┘
```

**¿Por qué el bot en PC local?**
- Orange Pangea detecta IPs de datacenter → las bloquea
- Una IP residencial local no levanta sospechas
- Costo: 0€ adicional/mes (PC existente)
- Desacople: si el VPS cae, el bot sigue extrayendo
- Un VPS con RAM/CPU para Chrome + 5 workers costaría 80-150€/mes

### 1.2 Stack Tecnológico

| Capa | Tecnología | Versión | Justificación |
|------|-----------|---------|---------------|
| **Frontend Framework** | Next.js (App Router) | 15.5.19 | SSR, API Routes, Middleware integrado |
| **Lenguaje Frontend** | TypeScript | 5.7 | Tipado estático, mantenibilidad |
| **Estilos** | Tailwind CSS | 3.4 | Utility-first, productivo, theme-aware |
| **Iconos** | Lucide React | latest | Consistencia visual, tree-shakeable |
| **Gráficos** | Recharts | latest | React-native, declarativo, ligero |
| **Formularios** | React Hook Form + Zod | latest | Validación con tipos inferidos |
| **Estado** | React Context + useState | nativo | Sin dependencias externas innecesarias |
| **Auth** | NextAuth.js v5 (beta) | 5.0.0-beta.25 | Credentials Provider + JWT stateless |
| **Base de Datos** | PostgreSQL | 16 | Robusta, gratuita, escala a millones |
| **DB Driver** | pg (Pool) | latest | Conexiones nativas, sin ORM |
| **Cache/Colas** | Redis (Upstash) | opcional | Rate limiting, webhook queue, cache |
| **Bot Lenguaje** | Python | 3.13 | Type hints, ecosistema de automatización |
| **Bot Automatización** | Playwright (Chromium) | latest | Headless, multi-contexto, stealth |
| **Telefonía** | VPBX (Siptize) REST API | — | Click2Call, CDR, grabaciones, agentes |
| **Mensajería** | Meta Cloud API (WhatsApp) | v21.0 | Envío de plantillas, webhooks entrantes |
| **Deploy** | Plesk + Nginx | — | Auto-deploy desde Git, SSL Let's Encrypt |
| **Servidor Producción** | Hetzner CPX41 | — | 8 vCPU, 16 GB RAM, 160 GB SSD, ~20€/mes |

---

## 2. Base de Datos

### 2.1 Esquema General

```
PostgreSQL 16 — Schema: public
│
├── Tablas Core (11)
│   ├── clientes              — Entidad única por id_cliente (DNI_..., NIE_..., NIF_...)
│   ├── clientes_proyectos    — Datos JSONB por cliente+proyecto (UPSERT)
│   ├── pipeline              — Estado comercial multi-proyecto
│   ├── historial             — Timeline de eventos (extracciones, llamadas, cambios)
│   ├── detecciones           — Cambios detectados entre extracciones
│   ├── compras               — Ventas registradas
│   ├── analisis_perdidos     — Leads cerrados sin venta
│   ├── proyectos             — Configuración multi-proyecto (JSONB config)
│   ├── usuarios              — Auth con roles + extension_vpbx
│   ├── configuracion         — Clave-valor dinámico
│   └── pausas                — Tracking de pausas (tipo, inicio, fin, duración)
│
├── Tablas Bot (3)
│   ├── maquinas              — Workers distribuidos: heartbeat, workers_activos
│   ├── comandos_bot          — Cola de comandos frontend → coordinator
│   └── credenciales_bot      — Credenciales Pangea para workers
│
├── Tablas VPBX (1)
│   └── cdr_vpbx              — Registro de llamadas (webhooks VPBX)
│
├── Tablas WhatsApp (2)
│   ├── whatsapp_mensajes     — Historial de mensajes (entrante/saliente)
│   └── whatsapp_plantillas   — Plantillas configurables por proyecto
│
├── Tablas Calidad (3)
│   ├── tipificaciones_config — Estados/sub-estados configurables por proyecto
│   ├── listas_negras         — Teléfonos bloqueados (Robinson, fallecidos, no_llamar)
│   └── qa_evaluaciones       — Evaluaciones de calidad (rúbrica 5 criterios)
│
├── Tablas Inteligencia (5)
│   ├── scoring_leads         — Scoring Orange (niveles A+ a E)
│   ├── scoring_contactabilidad — Scoring Yone (historial contacto + compras)
│   ├── metricas_diarias      — Snapshot diario por asesor
│   ├── cinturones            — Niveles de gamificación
│   ├── logros_cinturon       — Historial de cinturones por asesor/mes
│   └── notificaciones_supervisor — Alertas automáticas al supervisor
│
├── Funciones PL/pgSQL (11)
├── Vistas (2)
├── Triggers (4)
└── Índices (20+)
```

### 2.2 Tabla `clientes` — Entidad Central

```sql
CREATE TABLE clientes (
    id_cliente TEXT PRIMARY KEY,        -- "DNI_12345678A", "NIE_X...", "NIF_B..."
    tipo_documento TEXT NOT NULL,       -- DNI, NIE, NIF
    numero_documento TEXT NOT NULL,     -- Sin prefijo: 12345678A
    nombre_razon_social TEXT,
    tipo_persona TEXT DEFAULT 'natural', -- natural, autonomo, empresa
    cnae TEXT,
    telefonos JSONB,                    -- Legacy: array de strings
    telefonos_v2 JSONB DEFAULT '[]',    -- [{"num","tipo","origen"}, ...]
    emails TEXT[],
    direccion JSONB,                    -- {calle, ciudad, cp, provincia}
    whatsapp_opt_in BOOLEAN DEFAULT false,
    whatsapp_numero TEXT,
    whatsapp_opt_in_fecha TIMESTAMPTZ,
    alertas_fidelizacion BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ              -- Soft delete (RGPD)
);
```

### 2.3 Tabla `pipeline` — Corazón Comercial

```sql
CREATE TABLE pipeline (
    id BIGSERIAL PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente),
    proyecto_id BIGINT NOT NULL REFERENCES proyectos(id) DEFAULT 1,
    asesor_id BIGINT NOT NULL REFERENCES usuarios(id),
    estado TEXT NOT NULL DEFAULT 'pendiente',
    sub_estado TEXT,
    notas TEXT,
    intentos INTEGER DEFAULT 0,
    ronda_actual INTEGER DEFAULT 1,
    ultimo_intento_ronda TIMESTAMPTZ,
    fin_permanencia DATE,
    callback_at TIMESTAMPTZ,
    ultimo_cambio TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Índices críticos
CREATE INDEX idx_pipeline_asesor_estado ON pipeline(asesor_id, estado, deleted_at);
CREATE INDEX idx_pipeline_proyecto_estado ON pipeline(proyecto_id, deleted_at, estado);
-- Un lead activo por (cliente, proyecto, asesor)
CREATE UNIQUE INDEX idx_pipeline_unique_active ON pipeline(id_cliente, proyecto_id, asesor_id)
    WHERE deleted_at IS NULL;
```

### 2.4 Tabla `clientes_proyectos` — Datos por Proyecto

```sql
CREATE TABLE clientes_proyectos (
    id BIGSERIAL PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente),
    proyecto_id BIGINT NOT NULL REFERENCES proyectos(id),
    datos JSONB NOT NULL DEFAULT '{}',  -- Todos los datos extraídos por el bot
    ultima_extraccion TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(id_cliente, proyecto_id)
);
```

**Estructura de `datos` JSONB (ejemplo Orange):**

```json
{
  "estado": "completado",
  "version_extraccion": 2,
  "primera_extraccion_at": "2026-06-08T10:00:00.000Z",
  "header": {
    "nombre": "ROCIO MARTINEZ",
    "telefono": "622534699",
    "tipo_cliente": "Particular",
    "paquete": "Love Empresa Smart"
  },
  "lineas": [
    {
      "numero": "622534699",
      "cima": true,
      "estado": "Activa",
      "consumo": 45.90,
      "permanencia": "2028-03-15",
      "vap": 120.50,
      "tv": true,
      "activo_desde": "2024-03-15",
      "renove": {
        "tipo": "Mixto Max Descuento",
        "color": "verde",
        "productos": ["Fibra 600Mb", "Móvil 50GB"],
        "descuento": "30%"
      },
      "campanas": ["Pack Familiar", "Segunda Línea"],
      "bonos": [],
      "sva": []
    }
  ]
}
```

### 2.5 Sistema de Versionado y Detección de Cambios

Cada extracción del bot incrementa `version_extraccion` en el JSONB:

| Escenario | version_extraccion | ¿Genera detecciones? |
|-----------|-------------------|---------------------|
| Primera extracción | 1 | No |
| Datos previos reales | ≥ 2 | Sí (compara vs anterior) |
| Legacy sin campo | Se infiere v≥1 si tiene líneas | Sí (si hay diff) |

### 2.6 Funciones PL/pgSQL Clave

| Función | Propósito |
|---------|-----------|
| `tomar_siguiente_dni(proyecto_id)` | Toma atómica de DNI con FOR UPDATE SKIP LOCKED |
| `salud_base(proyecto_id)` | Ratio de registros limpios vs totales |
| `calcular_scoring_lead(id_cliente, proyecto_id)` | Scoring por datos Orange (14 factores) |
| `calcular_scoring_masivo(proyecto_id)` | Scoring Orange masivo |
| `calcular_scoring_contacto_masivo(proyecto_id)` | Scoring Yone por historial |
| `forecast_ventas(proyecto_id, dias_hist, dias_forecast)` | Predicción de ventas con intervalos |
| `cinturon_actual(asesor_id, mes)` | Cinturón de gamificación + próximo nivel |
| `generar_metricas_diarias(proyecto_id, fecha)` | Snapshot diario de métricas |
| `tasa_reutilizacion(proyecto_id, dias)` | Frecuencia de reanálisis de registros |
| `metricas_abandono(proyecto_id, dias)` | Leads perdidos por motivo |
| `telefonos_agregar / marcar_contacto / nums` | Helpers para telefonos_v2 |

### 2.7 Triggers

| Trigger | Tabla | Evento | Acción |
|---------|-------|--------|--------|
| `trg_auditoria_pipeline` | pipeline | INSERT/UPDATE | Registra cambios en historial |
| `trg_auditoria_extraccion` | clientes_proyectos | INSERT/UPDATE | Registra extracciones en historial |
| `trg_auto_lista_negra` | pipeline | UPDATE | Si sub_estado.afecta_calidad → INSERT en listas_negras |
| `trg_updated_at` | varias | UPDATE | Actualiza updated_at a now() |

---

## 3. Arquitectura de la API

### 3.1 Estructura

```
src/app/api/
├── auth/[...nextauth]/route.ts     — NextAuth.js handler
├── health/route.ts                  — Healthcheck público
├── sse/route.ts                     — Server-Sent Events (notificaciones)
│
├── bot/                             — Endpoints internos (x-bot-api-key)
│   ├── command/route.ts             — GET coordinator polling / POST frontend
│   ├── next-dni/route.ts            — Siguiente DNI pendiente (FOR UPDATE SKIP LOCKED)
│   ├── credenciales/route.ts        — Pool de credenciales activas
│   ├── touch/route.ts               — Mantener vivo DNI durante procesamiento
│   └── reset-stale/route.ts         — Rescatar DNIs atascados
│
├── internal/
│   └── bot-sync/route.ts            — Guardar resultados del bot + detectar cambios
│
├── clientes/                        — CRUD clientes
├── pipeline/                        — 11 endpoints de pipeline
├── pausas/                          — CRUD pausas
├── proxies/                         — CRUD proxies
├── maquinas/                        — CRUD máquinas + heartbeat
├── usuarios/                        — CRUD usuarios
├── configuracion/                   — Config clave-valor
├── proyectos/                       — CRUD proyectos + stats
├── auditoria/                       — Timeline sistema
├── compras/                         — Scoring compras
├── detecciones/                     — Cambios detectados
├── listas-negras/                   — Reportes CSV
├── tipificaciones-config/           — Estados/sub-estados dinámicos
├── qa/                              — Evaluaciones calidad
├── documentos/                      — Upload + cola
├── perfil/password/                 — Cambiar contraseña
├── vpbx/                            — Click2Call + agents + extensions + CDR vars
├── webhooks/                        — VPBX + WhatsApp entrantes
├── whatsapp/                        — Send + plantillas
├── dashboard/                       — 9 endpoints de dashboards
└── admin/                           — Stats + credenciales
```

### 3.2 Seguridad de API

```typescript
// Capa 1: Middleware Next.js (rutas)
// Capa 2: requireRole() / requireAuth() / requirePipelineOwnership()
// Capa 3: x-bot-api-key para endpoints internos

// Ejemplo de protección en endpoint:
export async function POST(req: Request) {
  const session = await requireRole('jefe_area', 'supervisor', 'desarrollador');
  // ... lógica del endpoint
}

// Ejemplo de protección de ownership (asesor solo sus leads):
export async function PATCH(req: Request) {
  const body = await req.json();
  const session = await requirePipelineOwnership(body.id);
  // ... lógica del endpoint
}
```

### 3.3 Catálogo Completo de Endpoints (62)

| # | Método | Ruta | Auth | Descripción |
|---|--------|------|------|-------------|
| 1 | GET | /api/auth/session | Session | Sesión actual |
| 2 | POST | /api/auth/callback/credentials | Público | Login |
| 3 | GET | /api/health | Público | Healthcheck |
| 4 | GET | /api/sse | Session | SSE notificaciones |
| 5 | GET/POST | /api/bot/command | x-bot-api-key / jefe,it,dev,sup | Comandos coordinator |
| 6 | GET | /api/bot/next-dni | x-bot-api-key | Siguiente DNI |
| 7 | GET | /api/bot/credenciales | x-bot-api-key | Credenciales Pangea |
| 8 | PATCH | /api/bot/touch | x-bot-api-key | Mantener DNI vivo |
| 9 | POST | /api/bot/reset-stale | x-bot-api-key | Rescatar DNIs |
| 10 | POST | /api/internal/bot-sync | x-bot-api-key | Guardar resultados bot |
| 11-13 | GET/PATCH | /api/clientes[/id] | Session | CRUD clientes |
| 14 | POST | /api/clientes/reanalizar | jefe/sup | Reanalizar cliente |
| 15 | GET/POST/PATCH/DELETE | /api/pipeline | varía | CRUD pipeline |
| 16 | GET | /api/pipeline/mine | Session | Mis leads |
| 17 | POST | /api/pipeline/intento | Ownership | Registrar intento |
| 18 | POST | /api/pipeline/tipificar | Ownership | Tipificar lead |
| 19 | GET | /api/pipeline/notifications | Session | Contadores sidebar |
| 20 | GET | /api/pipeline/agenda | Session | Agenda callbacks |
| 21 | GET | /api/pipeline/liberados | Session | Leads liberados |
| 22 | POST | /api/pipeline/release-stale | Internal | CRON liberación |
| 23 | GET | /api/pipeline/estadisticas | Session | KPIs pipeline |
| 24 | GET | /api/pipeline/backoffice-stats | Session | Stats tramitación |
| 25 | GET | /api/pipeline/tramitacion | Session | Tramitación |
| 26-28 | POST/PUT/GET | /api/pausas | Session | CRUD pausas |
| 29-31 | GET/POST/DELETE | /api/proxies | Session | CRUD proxies |
| 32-35 | GET/POST/PATCH/DELETE | /api/maquinas | Session | CRUD máquinas |
| 36-38 | GET/POST/PATCH | /api/usuarios | varía | CRUD usuarios |
| 39-40 | GET/POST | /api/configuracion | Session | Config dinámica |
| 41-43 | GET/POST/PATCH | /api/proyectos | varía | CRUD proyectos |
| 44 | GET | /api/proyectos/stats | Session | Stats proyectos |
| 45 | GET | /api/auditoria | sup/jefe/dev | Timeline |
| 46-48 | GET/POST/DELETE | /api/compras | Session | CRUD compras |
| 49 | GET | /api/detecciones | Session | Cambios detectados |
| 50 | GET | /api/listas-negras | sup/jefe/dev | Reportes CSV |
| 51-53 | GET/POST/PATCH | /api/tipificaciones-config | varía | Estados dinámicos |
| 54-55 | GET/POST | /api/qa | varía | Evaluaciones calidad |
| 56-57 | GET/POST | /api/documentos/cola,upload | Session | Upload lotes |
| 58 | POST | /api/perfil/password | Session | Cambiar contraseña |
| 59-61 | POST/GET | /api/fichajes[/equipo] | Session / sup,jefe,dev,bo,it | Fichaje electrónico (POST, GET historial, GET equipo) |
| 62-66 | POST/GET | /api/vpbx/* | Session | Click2Call, agents, extensions, CDR |
| 67-69 | POST/GET | /api/whatsapp/* | Session | Send, plantillas |
| 70-71 | POST | /api/webhooks/vpbx,whatsapp | Público | Webhooks entrantes |
| 72-80 | GET/POST/PATCH | /api/dashboard/* | Session | 9 endpoints dashboards |
| 81-83 | GET/POST/PATCH/DELETE | /api/admin/* | it/dev/jefe | Stats, credenciales |

---

## 4. Arquitectura del Bot (Python)

### 4.1 Componentes

```
bot/
├── coordinator_loop.py      — Daemon 24/7: lanza workers, polling comandos, heartbeat, rescate
├── worker_loop.py           — Worker: toma DNI → login → extrae → sync vía API
├── worker_structured.py     — Worker con Watchdog 40s + Stealth (testing, --dni flag)
├── bot_http.py              — Cliente HTTP: sync_resultado() y sync_no_cliente()
├── login.py                 — Lógica de login + extracción de datos (pestañas, estados)
├── browser_setup.py         — Config Chromium: geolocalización España, proxies, user-agent
├── main.py                  — Standalone local: lee numeros.txt, extrae, guarda JSON
├── piloto.py                — Piloto multi-worker sin BD (verbose dump)
└── test_bot.py              — Test rápido de 1 DNI por API
```

### 4.2 Flujo del Coordinator

```
coordinator_loop.py (daemon 24/7)
│
├── 1. Registro: se identifica con nombre de máquina
├── 2. Heartbeat: PATCH /api/maquinas cada 30s
├── 3. Polling: GET /api/bot/command?maquina=X cada 5s
├── 4. Rescate DNIs: POST /api/bot/reset-stale cada 60s
├── 5. Liberación: POST /api/pipeline/release-stale a las 2 AM
├── 6. Auto-recuperación: reinicia workers muertos (máx 5/hora)
│
└── Workers (×N):
    ├── GET /api/bot/next-dni → siguiente DNI
    ├── Login Orange Pangea → extraer datos
    ├── PATCH /api/bot/touch → mantener vivo
    └── POST /api/internal/bot-sync → guardar resultados
```

### 4.3 Flujo de Extracción (Worker)

```
Worker Loop:
│
├── 1. load_dotenv() → credenciales Orange
├── 2. Crear browser Playwright con proxy español
├── 3. login_loop() → autenticar en Orange Pangea
│
└── 4. while True:
    ├── GET /api/bot/next-dni → id_cliente
    ├── PATCH /api/bot/touch → mantener vivo
    ├── Navegar a búsqueda de cliente
    ├── Extraer datos de cabecera
    ├── Iterar líneas (paginación)
    │   ├── Datos básicos de línea
    │   ├── Pestaña Destacadas → CIMA, estados
    │   ├── Pestaña Renove → tipo, descuento, productos
    │   ├── Pestaña Bonos y Descuentos
    │   ├── Pestaña Cambio Tarifa
    │   └── Pestaña SVA
    ├── POST /api/internal/bot-sync → guardar
    └── Continuar con siguiente DNI
```

---

## 5. Sistema de Autenticación y Autorización

### 5.1 Autenticación

- **NextAuth.js v5** con Credentials Provider
- Contraseñas: **bcrypt** (10 rondas de salt)
- Sesiones: **JWT stateless** firmadas con `NEXTAUTH_SECRET`
- Expiración: **8 horas**
- Validación de complejidad: 8+ caracteres, 1 mayúscula, 1 número

### 5.2 Autorización (RBAC de 2 Capas)

**Capa 1 — Middleware (rutas):**

```typescript
// src/middleware.ts — Mapa de rutas por rol
const roleRoutes = {
  '/asesor': ['asesor', 'supervisor', 'jefe_area', 'desarrollador'],
  '/supervisor': ['supervisor', 'jefe_area', 'desarrollador'],
  '/jefe': ['jefe_area', 'desarrollador'],
  '/asignar-leads': ['jefe_area', 'supervisor', 'desarrollador'],
  '/usuarios': ['jefe_area', 'desarrollador'],
  '/infraestructura': ['it', 'desarrollador'],
  '/vpbx': ['supervisor', 'jefe_area', 'desarrollador', 'it'],
  // ...
};
```

**Capa 2 — API (endpoints):**

```typescript
// requireRole('jefe_area', 'supervisor', 'desarrollador')
// requirePipelineOwnership(id) — asesor solo modifica sus leads
// requireAuth() — cualquier sesión válida
```

### 5.3 Endpoints del Bot (API Key)

Endpoints `/api/bot/*` y `/api/internal/*` protegidos con header `x-bot-api-key`:

```typescript
// Verificación en cada endpoint del bot
const apiKey = req.headers.get('x-bot-api-key');
if (apiKey !== process.env.BOT_API_KEY) {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
}
```

### 5.4 Protecciones de Seguridad

| Protección | Implementación |
|------------|----------------|
| SQL Injection | 100% queries parametrizadas ($1, $2) |
| Race Conditions | FOR UPDATE SKIP LOCKED en next-dni |
| CSRF | NextAuth maneja automáticamente |
| Rate Limiting | Redis (Click2Call 3s) o memoria |
| Soft Delete | deleted_at en pipeline y clientes |
| RGPD | Anonimización + soft delete |

---

## 6. Integraciones Externas

### 6.1 VPBX (Siptize)

| Funcionalidad | Endpoint VPBX | Endpoint CRM |
|---------------|---------------|-------------|
| Click2Call | GET /originatecall/{ext}/{num} | POST /api/vpbx/originate |
| Listar extensiones | GET /extension | GET /api/vpbx/extensions |
| Estado agentes | GET /agent | GET /api/vpbx/agents |
| CDR llamada | GET /cdr/{callId} | — |
| Escribir variables CDR | POST /cdr/{callId}/updatevars | POST /api/vpbx/cdr/[id]/vars |
| Webhooks llamadas | POST → URL_CRM | POST /api/webhooks/vpbx |

**Rate Limiting Click2Call:** Máximo 1 llamada cada 3 segundos por extensión (Redis o memoria).

### 6.2 WhatsApp (Meta Cloud API)

| Funcionalidad | Endpoint | Auth |
|---------------|----------|------|
| Enviar mensaje | POST /{phone_id}/messages | Token permanente |
| Webhook entrante | POST → URL_CRM/webhooks/whatsapp | verify_token |
| Plantillas | Gestionadas en Meta Business | — |

**Restricción:** Solo se envían plantillas pre-aprobadas (no texto libre).

### 6.3 Redis (Upstash)

| Uso | Implementación |
|-----|----------------|
| Rate limiting Click2Call | Contador por extensión con TTL 3s |
| Webhook queue VPBX | Encolar eventos antes de procesar |
| Cache agentes VPBX | TTL 5 segundos |
| Cache extensiones | Invalidación en mutaciones |

**Fallback:** Si `REDIS_URL` no está configurada, todo funciona en memoria local sin Redis.

---

## 7. Frontend — Estructura y Componentes

### 7.1 Árbol de Páginas

```
src/app/
├── layout.tsx                       — Root layout
├── page.tsx                         — Redirect /
├── login/page.tsx                   — Login (público)
├── inicio/page.tsx                  — Splash + config proyectos (⚙️ overlay)
├── (dashboard)/                     — Rutas protegidas
│   ├── layout.tsx                   — Sidebar + ProjectSelector
│   ├── asesor/page.tsx              — Mis Leads + filtros
│   ├── supervisor/page.tsx          — LivePanel + rendimiento
│   ├── jefe/page.tsx                — Funnel + comparativa
│   ├── backoffice/page.tsx          — Pendientes/Tramitados
│   ├── admin/page.tsx               — Métricas sistema
│   ├── power-dialer/page.tsx        — Discador
│   ├── agenda/page.tsx              — Callbacks
│   ├── clientes/page.tsx            — Tabla maestra
│   ├── asignar-leads/page.tsx       — Chips jerárquicos
│   ├── estadisticas/page.tsx        — KPIs + gráficos
│   ├── auditoria/page.tsx           — Timeline
│   ├── calidad/page.tsx             — QA
│   ├── metas/page.tsx               — Ranking
│   ├── alertas/page.tsx             — Notificaciones
│   ├── vpbx/page.tsx                — Extensiones + agentes
│   ├── usuarios/page.tsx            — CRUD usuarios
│   ├── bots/page.tsx                — Apps: 4 tabs (Control, Proxies, Máquinas, Config)
│   ├── proyectos/page.tsx           — CRUD proyectos
│   ├── rendimiento/page.tsx         — Ranking + cinturones
│   ├── inteligencia/page.tsx        — Scoring + forecast
│   ├── perfil/page.tsx              — Datos personales
│   └── wikiratioo/page.tsx          — Base conocimiento
└── api/                             — 59 endpoints
```

### 7.2 Componentes Compartidos

```
src/components/
├── shared/
│   ├── Sidebar.tsx              — Menú lateral v2: acordeón, badges rojos, jerarquía visual
│   ├── LivePanel.tsx            — Panel en vivo de asesores (VPBX real)
│   ├── MiEstado.tsx             — Widget de pausa (Power Dialer)
│   ├── FlipCard.tsx             — Card con giro 3D
│   ├── Paginator.tsx            — Paginación unificada (Mostrar [10▼] de N)
│   ├── Toast.tsx                — Notificaciones toast
│   ├── StatCard.tsx             — Tarjeta de estadística
│   ├── ClipboardModal.tsx       — Modal para copiar datos
│   ├── NotificationBadge.tsx    — Badge rojo con contador
│   ├── OratiooLogo.tsx          — Logo SVG
│   ├── ProjectSelector.tsx      — Selector de proyecto activo
│   ├── WhatsAppChat.tsx         — Chat flotante WhatsApp
│   ├── Skeleton.tsx             — Loading skeletons
│   ├── ThemeProvider.tsx        — Dark/Light mode
│   ├── Breadcrumb.tsx           — Navegación jerárquica
│   └── Tooltip.tsx              — Tooltips
└── clientes/
    └── FichaCliente.tsx         — Modal 360° del cliente
```

### 7.3 Librerías del Proyecto

```
src/lib/
├── db.ts                  — Pool PostgreSQL (20 max, 30s timeout)
├── auth.ts                — NextAuth.js config (credentials + JWT)
├── auth-roles.ts          — requireRole(), requireAuth(), requirePipelineOwnership()
├── vpbx.ts                — Cliente VPBX (14 funciones)
├── redis.ts               — Redis client (rate limit, queue, cache)
├── whatsapp.ts            — Meta Cloud API (sendText, sendTemplate, webhook)
├── project-context.tsx     — Contexto de proyecto seleccionado
├── pipeline-colors.ts     — Colores para estados de pipeline
├── keyboard-shortcuts.ts  — Atajos de teclado
└── api-helpers.ts         — Helpers para API routes
```

---

## 8. Despliegue

### 8.1 Entornos

| Entorno | Infraestructura | BD | URL |
|---------|-----------------|----|-----|
| Desarrollo | PC local (Windows) | localhost:5433 | localhost:3000 |
| Producción | VPS Hetzner CPX41 | PostgreSQL 16 | (por definir) |

### 8.2 Deploy con Plesk

```
GitHub/GitLab (rama submaster)
    │
    ▼
Plesk (VPS Hetzner)
    ├── Build: next build
    ├── Start: next start
    ├── SSL: Let's Encrypt (auto)
    └── Nginx reverse proxy
```

### 8.3 Variables de Entorno

```bash
# Base de datos
DATABASE_URL=postgresql://postgres@localhost:5433/oratioo_cx

# NextAuth
NEXTAUTH_SECRET=<secret>
NEXTAUTH_URL=http://localhost:3000

# VPBX
VPBX_API_KEY=sk_live_xxx
VPBX_API_URL=https://vpbx.me/api

# Bot
BOT_API_KEY=oratioo-bot-internal-key

# Meta WhatsApp
WHATSAPP_TOKEN=<token>
WHATSAPP_PHONE_ID=<phone_id>
WHATSAPP_VERIFY_TOKEN=<verify_token>

# Redis (opcional)
REDIS_URL=<url>
REDIS_TOKEN=<token>

# Orange Pangea
ORANGE_USER=<user>
ORANGE_PASS=<pass>
```

---

## 9. Métricas Técnicas del Proyecto

| Indicador | Cantidad |
|-----------|----------|
| Rutas Next.js | 81 |
| Endpoints API | 59 |
| Páginas frontend | 21 |
| Componentes compartidos | 16 |
| Tablas PostgreSQL | 30 |
| Funciones PL/pgSQL | 11 |
| Vistas | 2 |
| Triggers | 4 |
| Índices | 20+ |
| Migraciones SQL | 20+ |
| Roles de usuario | 7 |
| Workers Python | 5 archivos core |
| Módulos Python bot | 9 archivos |

---

## 10. Convenciones y Estándares

### 10.1 Código

- **TypeScript:** estricto en frontend
- **Python:** type hints en bot
- **Commits:** español, formato [conventional commits](https://www.conventionalcommits.org/)
- **Rama activa:** `submaster`
- **Estilos:** Tailwind utility-first, sin CSS custom (excepto animaciones)

### 10.2 Base de Datos

- **Query params:** 100% parametrizadas ($1, $2)
- **UPSERT:** ON CONFLICT (col1, col2) DO UPDATE
- **Proyecto:** todo filtrado por `proyecto_id`
- **Timestamps:** `TIMESTAMPTZ` universal
- **Soft delete:** `deleted_at` en tablas críticas

### 10.3 API

- **Auth:** `requireAuth()` o `requireRole()` en cada endpoint
- **Bot endpoints:** `x-bot-api-key` header
- **Response:** JSON siempre
- **Errores:** `{ error: 'mensaje' }` con código HTTP
- **Status codes:** 200 (ok), 201 (created), 400 (bad request), 401 (unauth), 403 (forbidden), 404 (not found), 500 (server error)

---

## 11. Cumplimiento Normativo — Fichaje Electrónico (España)

### 11.1 Tabla `fichajes`

```sql
CREATE TABLE fichajes (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    metodo TEXT DEFAULT 'manual',   -- 'manual', 'auto_login', 'supervisor'
    ip TEXT,
    notas TEXT,
    modalidad TEXT DEFAULT 'presencial' CHECK (modalidad IN ('presencial', 'remoto')),
    corregido_por BIGINT REFERENCES usuarios(id),
    correcion_motivo TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_fichajes_usuario_fecha ON fichajes(usuario_id, timestamp DESC);
```

### 11.2 Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/fichajes` | Registrar entrada/salida (acepta `modalidad`) |
| GET | `/api/fichajes?mes=&hoy=&hoy_fin=` | Historial personal o equipo (timezone-safe) |
| GET | `/api/fichajes/equipo?fecha=&fecha_fin=` | Vista equipo con cruce de pausas |

### 11.3 Matriz de Cumplimiento Legal

| # | Requisito | Norma | Estado | Implementación |
|---|-----------|-------|:---:|----------------|
| 1 | Registro diario inicio/fin | RD-ley 8/2019 | ✅ | `fichajes` con `entrada`/`salida` + `TIMESTAMPTZ` |
| 2 | Horario concreto (h:m) | RD-ley 8/2019 | ✅ | Precisión milisegundos |
| 3 | Pausas registradas | RD-ley 8/2019 | ✅ | Tabla `pausas`, cruzada en reportes |
| 4 | Total horas trabajadas | RD-ley 8/2019 | ✅ | Cálculo: salida − entrada − pausas |
| 5 | Conservación 4 años | RD-ley 8/2019 | ✅ | Sin DELETE automático |
| 6 | Acceso del trabajador | RD-ley 8/2019 | ✅ | Página `/fichaje` — `requireAuth()` |
| 7 | Inspección de Trabajo | RD-ley 8/2019 | ✅ | Export CSV (BOM UTF-8, `;`, columnas ES) |
| 8 | Representantes legales | RD-ley 8/2019 | ✅ | Roles sup/jefe/dev/bo/it acceden |
| 9 | Modalidad presencial/remoto | Ley 10/2021 | ✅ | Columna `modalidad` + toggle UI |
| 10 | Registro manual supervisor | RD-ley 8/2019 | ✅ | `target_user_id` + `motivo` + `corregido_por` |
| 11 | Zona horaria local | Implícito | ✅ | Rangos TIMESTAMPTZ con offset del navegador |
| 12 | Offline resiliente | Mejor práctica | ✅ | localStorage + sync automático |
| 13 | Usuario desactivado no ficha | RD-ley 8/2019 | ✅ | Triple check: login + middleware JWT + API |

### 11.4 Lo que NO exige la ley

| Concepto | ¿Obligatorio? |
|----------|:---:|
| API gubernamental (no existe) | ❌ |
| Integración con nóminas | ❌ |
| PDF firmado digitalmente | ❌ |
| Fichaje biométrico | ❌ |
| Geolocalización | ❌ |