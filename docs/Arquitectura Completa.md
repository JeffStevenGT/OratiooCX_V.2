# 🏗️ Oratioo CX — Arquitectura del Sistema (v3.0)

> Stack: Next.js 15 + PostgreSQL + Python/Playwright (bots)
> Deploy objetivo: VPS Dedicado (Hetzner CPX31/CPX41) con Coolify
> Versión: 3.0 — Mayo 2026, actualizado con estado real del proyecto

---

## 🌐 Frontend — Next.js 15 (App Router)

| Componente | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router) |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS 3.4 |
| Iconos | Lucide React |
| HTTP Client | fetch nativo |
| DB Driver | pg (Pool de conexiones) |

### Páginas Implementadas

| Ruta | Página | Estado |
|---|---|---|
| /login | Login con NextAuth | ✅ Funcional |
| /clientes | Tabla con datos del bot, filtros, desplegable, export CSV | ✅ Completo |
| /admin/documentos | Subida de .csv/.txt/.xlsx, cola de DNIs con stats | ✅ Completo |
| /bots | Control remoto con selector de máquina y workers | ✅ Completo |
| /infraestructura | Gestión de proxies + máquinas (CRUD) | ✅ Completo |
| /asesor, /supervisor, /jefe, /backoffice, /admin | Dashboards por rol | 🟡 Placeholders |
| /agenda | Callbacks | 🟡 Placeholder |
| /proyectos | Admin de campañas | 🟡 Placeholder |
| /power-dialer | Discador VPBX | 🟡 Placeholder |
| /usuarios | Gestión usuarios | 🟡 Placeholder |

---

## 🗄️ Base de Datos — PostgreSQL

- Host: `localhost:5433` (dev), futuro VPS
- Pool: 20 conexiones máx, idle timeout 30s, statement timeout 30s
- Driver: `pg` (sin ORM)

### Tablas Implementadas

| Tabla | Descripción | Migración |
|---|---|---|
| `clientes` | Core: id_cliente (DNI_XXXXXXXX), tipo_doc, nombre, tipo_persona | ✅ 001 |
| `proyectos` | Catálogo: orange, mainjobs, impresoras | ✅ 001 |
| `clientes_proyectos` | Datos del bot por proyecto (JSONB `datos`) | ✅ 001 |
| `historial` | Timeline único + triggers de auditoría | ✅ 001 |
| `pipeline` | Estado comercial + soft delete | ✅ 001 |
| `usuarios` | Login + roles + extensión VPBX | ✅ 001 |
| `cdr_vpbx` | Registro de llamadas | ✅ 001 |
| `comandos_bot` | Control remoto multi-máquina (maquina_destino) | ✅ 001 |
| `maquinas` | Catálogo de VPS + heartbeat | ✅ 002 |

### Índices JSONB en `clientes_proyectos.datos`

```sql
-- B-Tree sobre campos críticos para evitar escaneos secuenciales
idx_cp_cima_global  ON ((datos->>'cima_global'))
idx_cp_lineas_gin   ON ((datos->'lineas'))        -- GIN
idx_cp_estado       ON ((datos->'estado'))
idx_cp_ultima_extraccion ON (ultima_extraccion DESC)
```

### Triggers de Auditoría (Zero-Trust)

- `trigger_auditoria_pipeline`: Cualquier UPDATE de estado → INSERT en historial
- `trigger_auditoria_extraccion`: Cualquier INSERT en clientes_proyectos → INSERT en historial

### Campos RGPD (pendientes)

```sql
-- Pendiente: agregar a clientes
whatsapp_opt_in        BOOLEAN
whatsapp_numero        TEXT
whatsapp_opt_in_fecha  TIMESTAMPTZ
```

---

## 🤖 Bots — Python + Playwright

### Estructura Real (`bot/`)

```
bot/
├── coordinator_loop.py    ← Daemon multi-worker con heartbeat + rescate DNIs
├── worker_loop.py         ← Worker continuo con touch + watchdog 40s
├── login.py               ← Login Orange + extracción de datos
├── browser_setup.py       ← Config navegador + proxy España
├── bot_http.py            ← Cliente HTTP (API-First, no toca PostgreSQL)
├── watchdog.py            ← Timeout por DNI
├── cleanup_cmds.py        ← Limpieza de comandos viejos
├── reset_queue.py         ← Reset de cola manual
└── requirements.txt       ← Dependencias Python
```

### Arquitectura API-First

```
┌─────────────┐   POST /api/internal/bot-sync   ┌──────────┐
│ worker_loop │ ──────────────────────────────→ │ Next.js  │
│   (Python)  │ ←── GET /api/bot/next-dni ───── │  (VPS)   │
│             │ ←── GET /api/bot/command ────── │          │
│   PC Local  │ ──→ PATCH /api/bot/touch ─────→ │          │
└─────────────┘                                  └────┬─────┘
                                                     │
                                               ┌─────▼─────┐
                                               │ PostgreSQL │
                                               └───────────┘
```

**Cero conexiones directas a PostgreSQL desde la PC local.**

### Flujo de un DNI

1. Worker → `GET /api/bot/next-dni` → recibe `id_cliente`
2. Worker → `touch_dni(id_cliente)` → marca `updated_at = now()`
3. Worker → login + extracción en Pangea Orange
4. Worker → `POST /api/internal/bot-sync` → backend guarda JSONB
5. Repite

### Sistema Anti-Pérdida de DNIs

| Mecanismo | Qué hace |
|---|---|
| `touch_dni()` | Worker actualiza `updated_at` al tomar DNI y en cada reintento de login |
| `FOR UPDATE SKIP LOCKED` | Evita que 2 workers tomen el mismo DNI |
| `rescue_stale_dnis()` | Coordinator resetea DNIs en `en_progreso` con >30 min sin touch |
| Watchdog 40s | Si extracción se cuelga, timeout + reintento |
| `restart_dead_workers()` | Coordinator reinicia workers que mueren |

### Control Multi-Máquina

```
Frontend → POST /api/bot/command { maquina: "vps-1", comando: "iniciar", workers: 5 }
         → BD: comandos_bot (maquina_destino = "vps-1", estado = "pendiente")

Coordinator en VPS → GET /api/bot/command?maquina=vps-1 → solo comandos para él
                  → spawn_workers(5)
                  → heartbeat PATCH /api/maquinas cada 30s
```

---

## 📞 VPBX — Integración Telefónica

### Endpoints Implementados

| Endpoint | Función |
|---|---|
| `POST /api/vpbx/originate` | Click2Call |
| `POST /api/webhooks/vpbx` | RINGING / ANSWERED / HANGUP |
| `lib/vpbx.ts` | Cliente HTTP VPBX |

### Pendiente

- Redis para cola de webhooks (responder <50ms)
- Rate limiting en Click2Call (5s debounce)
- CDR sync automático
- Grabaciones → Cloudflare R2

---

## 📱 WhatsApp — Meta Cloud API (Pendiente)

- Conexión directa Meta API
- Webhooks entrantes → `/api/webhooks/whatsapp`
- Tabla `whatsapp_mensajes`
- Plantillas: Opt-In + Alerta Renove
- Panel flotante en frontend

---

## 🚀 Deploy — Plan

| Fase | Objetivo |
|---|---|
| Actual | Desarrollo local (Windows, PostgreSQL puerto 5433) |
| Próximo | `output: 'standalone'` en Next.js, probar build de producción |
| VPS | Hetzner CPX31/CPX41 + Coolify + PostgreSQL + Redis |
| Almacenamiento | Cloudflare R2 para grabaciones VPBX (ciclo de vida 6 meses) |

---

## 📋 API Routes — Inventario

| Ruta | Método | Descripción |
|---|---|---|
| /api/auth/[...nextauth] | * | Autenticación |
| /api/clientes | GET | Clientes con datos del bot (join + transform) |
| /api/clientes/[id] | GET, PATCH | Ficha individual + editar tipo_persona |
| /api/proyectos | GET | Catálogo de proyectos |
| /api/pipeline | GET | Pipeline por cliente |
| /api/usuarios | GET | Lista de usuarios |
| /api/documentos/upload | POST | Subir archivo .csv/.txt/.xlsx |
| /api/documentos/cola | GET | Estado de la cola de DNIs |
| /api/proxies | GET, POST, DELETE | CRUD proxies (proxies.txt) |
| /api/maquinas | GET, POST, PATCH, DELETE | CRUD máquinas + heartbeat |
| /api/bot/command | GET, POST | Control remoto multi-máquina |
| /api/bot/next-dni | GET | Siguiente DNI pendiente (FOR UPDATE SKIP LOCKED) |
| /api/bot/touch | PATCH | Mantener vivo `updated_at` del DNI |
| /api/bot/reset-stale | POST | Rescatar DNIs atascados (>30 min) |
| /api/internal/bot-sync | POST | Guardar resultado del bot (API-First) |
| /api/vpbx/originate | POST | Click2Call |
| /api/webhooks/vpbx | POST | Callbacks VPBX |

---

## 🔐 Roles del Sistema

| Rol | Acceso |
|---|---|
| Asesor | Dashboard, Power Dialer, Agenda, Wikiratioo |
| Supervisor | Dashboard, Clientes, Power Dialer, Agenda, Metas, Alertas |
| Jefe Área | Dashboard, Clientes, Proyectos, Metas, Alertas, Usuarios |
| Back Office | Dashboard, Tramitación |
| Admin/IT | Dashboard, Clientes, Usuarios, Infraestructura, Bots, Documentos |
| Desarrollador | Todo |

---

## 📐 Pipeline — Asignación, Notificaciones y Liberación

### Flujo de Distribución de Leads

```
Bot procesa DNIs durante el día
  │
  ▼
Mañana siguiente: Jefe de Área / Supervisor
  │
  ├─ Entra a "Asignar Leads"
  ├─ Ve todos los completados de hoy (filtrables por CIMA, Renove, etc.)
  ├─ Selecciona leads (checkbox multiple o "todos")
  ├─ Elige equipo y/o asesor(es)
  └─ Click "Asignar"
       │
       ▼
  POST /api/pipeline/assign
       │
       ├─ Inserta fila en pipeline por cada lead:
       │   { id_cliente, proyecto_id, asesor_id, estado: "pendiente",
       │     ultimo_cambio: now() }
       │
       ├─ Si hay múltiples asesores → round-robin automático
       └─ Inserta en historial: "Lead asignado a Asesor X por Jefe Y"
```

### Página "Asignar Leads" — UI

```
┌────────────────────────────────────────────────────────┐
│ Asignar Leads                                          │
│                                                        │
│ 📊 342 leads procesados hoy (filtros: CIMA, Renove)   │
│                                                        │
│ [☐] Seleccionar todos  |  [Filtros: CIMA ▼ Renove ▼] │
│                                                        │
│ ☐ DNI 1234  Juan Pérez        CIMA ✅  Renove SI      │
│ ☐ DNI 5678  María García      CIMA ❌  Renove NO      │
│ ☐ DNI 9012  Empresa XYZ       CIMA ✅  Renove SI      │
│ ...                                                    │
│                                                        │
│ Equipo:  [España ▼]     Asesor: [Repartir entre todos ▼]│
│ Cantidad a asignar: [50]  de 342 seleccionados         │
│                                                        │
│ [ Asignar 50 leads ]                                  │
└────────────────────────────────────────────────────────┘
```

### Notificaciones por Rol

| Rol | Notificación | Cuándo |
|---|---|---|
| Asesor | Badge en sidebar: "5 leads nuevos" | Al recibir asignación |
| Asesor | Badge rojo: "3 leads por vencer" | Leads con 2+ días sin tocar |
| Asesor | Toast: "Lead liberado por inactividad" | Cuando un lead vuelve al pool |
| Supervisor | Badge: "12 leads sin asignar" | Leads procesados hoy sin dueño |
| Supervisor | Badge: "3 leads liberados" | Leads que volvieron por inactividad |
| Jefe Área | Badge: "342 leads para distribuir" | Al entrar después de un batch del bot |

### Liberación Automática a los 3 Días

```
CRON (cada noche, 2 AM)
  │
  ▼
SELECT * FROM pipeline
WHERE estado = 'pendiente'
  AND deleted_at IS NULL
  AND ultimo_cambio < now() - interval '3 days'
  │
  ▼
Para cada lead liberado:
  │
  ├─ Soft delete: UPDATE pipeline SET deleted_at = now()
  ├─ Inserta en historial:
  │   tipo = 'liberacion',
  │   descripcion = 'Lead liberado automáticamente por inactividad
  │                  (3 días sin tocar). Asesor anterior: {nombre}'
  │
  └─ El lead vuelve al pool:
       → Jefe ve "leads liberados" en Asignar Leads
       → Puede reasignarlo a otro asesor
```

### Endpoints Pipeline (Pendientes)

| Ruta | Método | Descripción |
|---|---|---|
| /api/pipeline/assign | POST | Asigna leads a asesor(es) |
| /api/pipeline/mine | GET | Mis leads (asesor) |
| /api/pipeline/team | GET | Leads de mi equipo (supervisor) |
| /api/pipeline/pool | GET | Leads sin asignar (jefe) |
| /api/pipeline/release-stale | POST | Libera leads inactivos (cron) |
| /api/pipeline/notifications | GET | Badge de notificaciones por rol |

### Endpoint de Notificaciones

```typescript
// GET /api/pipeline/notifications
// Response:
{
  nuevos: 5,          // Leads recién asignados
  porVencer: 3,        // Leads con 2+ días sin tocar
  liberados: 0,        // Leads liberados hoy
  sinAsignar: 12,      // (Supervisor/Jefe) Leads sin dueño
  totalPendientes: 47  // Total en mi pipeline
}
```

El frontend consulta este endpoint cada 60 segundos (polling) y actualiza
los badges del sidebar en tiempo real.

---

## 📐 Pipeline Comercial

```
Pendiente → Contactado → Interesado → Negociación → Venta → Tramitado → Activado
                                                       → No Interesa
                                                       → No Contesta → reintentar 7d
```

---

## 🔮 Roadmap

| Prioridad | Tarea |
|---|---|
| 🔴 AHORA | Probar bot con Pangea online |
| 🔴 AHORA | Batching de 20 DNIs en worker |
| 🟡 PRONTO | `output: standalone` para build de producción |
| 🟡 PRONTO | Redis para colas + webhooks VPBX |
| 🟡 PRONTO | Campos RGPD en clientes |
| 🟡 PRONTO | Pipeline: Asignación de leads + notificaciones + liberación a 3 días |
| 🟢 DESPUÉS | WhatsApp Meta API |
| 🟢 DESPUÉS | Power Dialer funcional |
| 🟢 DESPUÉS | Dashboards por rol con métricas reales |
| ⬜ FUTURO | Bots Mainjobs + Impresoras |
| ⬜ FUTURO | Wikiratioo (formación) |
| ⬜ FUTURO | Deploy a VPS con Coolify |

---

## 📱 WhatsApp + Flujo Renove — Diseño Detallado

### Objetivo

Automatizar la comunicación con clientes que tienen dispositivos en renovación,
cumpliendo con RGPD (doble opt-in) y usando Meta Cloud API directamente (sin n8n).

### Tablas Necesarias

#### `whatsapp_mensajes`

```sql
CREATE TABLE whatsapp_mensajes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente),
    direccion TEXT NOT NULL CHECK (direccion IN ('entrante','saliente')),
    tipo TEXT NOT NULL,
        CHECK (tipo IN ('opt_in_request','opt_in_response',
                        'alerta_renove','manual','respuesta_cliente')),
    mensaje TEXT NOT NULL,
    plantilla_meta TEXT,               -- Nombre de la plantilla de Meta
    wa_message_id TEXT,                 -- ID devuelto por Meta API
    wa_status TEXT,                     -- sent, delivered, read, failed
    metadatos JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wa_cliente ON whatsapp_mensajes (id_cliente, created_at DESC);
CREATE INDEX idx_wa_status ON whatsapp_mensajes (wa_status);
```

#### Ampliación RGPD en `clientes`

```sql
ALTER TABLE clientes ADD COLUMN whatsapp_opt_in BOOLEAN DEFAULT false;
ALTER TABLE clientes ADD COLUMN whatsapp_numero TEXT;
ALTER TABLE clientes ADD COLUMN whatsapp_opt_in_fecha TIMESTAMPTZ;
ALTER TABLE clientes ADD COLUMN alertas_fidelizacion BOOLEAN DEFAULT false;
```

### Flujo 1: Doble Opt-In (Activación desde el CRM)

```
Asesor en CRM
  │
  ├─ Ve ficha del cliente
  ├─ Activa switch "Alertas de Fidelización"
  ├─ Ingresa número de WhatsApp del cliente
  └─ Click "Enviar Opt-In"
       │
       ▼
  POST /api/whatsapp/opt-in-request
       │
       ├─ Valida: número español (+34, 9 dígitos)
       ├─ Guarda en clientes: alertas_fidelizacion = true, whatsapp_numero = X
       ├─ Inserta en whatsapp_mensajes: tipo = 'opt_in_request'
       └─ Dispara Plantilla Meta API 1:
            "Hola {nombre}, ¿autorizas recibir alertas de fidelización
             de Orange por WhatsApp? Responde SI para aceptar."
                 │
                 ▼
  Cliente responde "SI" por WhatsApp
       │
       ▼
  POST /api/webhooks/whatsapp (Meta envía)
       │
       ├─ Detecta keyword "SI" en respuesta a plantilla opt_in
       ├─ Actualiza clientes: whatsapp_opt_in = true, whatsapp_opt_in_fecha = now()
       ├─ Inserta en whatsapp_mensajes: tipo = 'opt_in_response'
       └─ Responde al cliente: "¡Confirmado! Te avisaremos cuando
            detectemos oportunidades de renovación."
```

### Flujo 2: Alerta Renove Automática (Disparo desde el Bot)

```
Bot extrae datos de Orange
  │
  ├─ Detecta línea con variante_renove != "N/A"
  └─ Envía JSON con el campo ya existente: tiene_renove = true,
       variante_renove = "Renove mixto al mejor precio..."
            │
            ▼
  POST /api/internal/bot-sync
       │
       ├─ Backend recibe los datos
       ├─ Lee el flag: datos.lineas[].tiene_renove === true
       ├─ Cruza con BD:
       │   SELECT whatsapp_opt_in, whatsapp_numero, alertas_fidelizacion
       │   FROM clientes WHERE id_cliente = $1
       │
       ├─ SI whatsapp_opt_in = true AND alertas_fidelizacion = true:
       │   │
       │   ├─ Dispara Plantilla Meta API 2 (Alerta Renove):
       │   │   "{nombre}, hemos detectado que tu línea {numero}
       │   │    tiene disponible un {variante_renove}.
       │   │    ¿Quieres que te llamemos para aprovecharlo?"
       │   │
       │   ├─ Inserta en whatsapp_mensajes: tipo = 'alerta_renove'
       │   └─ Inserta en historial: tipo = 'whatsapp',
       │        descripcion = 'Alerta Renove enviada automáticamente'
       │
       └─ SI NO tiene opt-in → no hace nada, solo guarda los datos
```

### Flujo 3: WhatsApp Entrante (Cliente responde)

```
Cliente envía mensaje por WhatsApp
       │
       ▼
  POST /api/webhooks/whatsapp (Meta webhook)
       │
       ├─ Busca cliente por número en clientes.whatsapp_numero
       ├─ Inserta en whatsapp_mensajes: tipo = 'respuesta_cliente'
       └─ Empuja evento a frontend vía Pusher/SSE:
            { tipo: 'whatsapp_entrante', id_cliente, mensaje }
                 │
                 ▼
  Frontend (Zustand store)
       │
       ├─ Notificación toast: "Nuevo mensaje de {nombre}"
       └─ Panel flotante de chat se actualiza en tiempo real
```

### Endpoints WhatsApp (Pendientes)

| Ruta | Método | Descripción |
|---|---|---|
| /api/whatsapp/opt-in-request | POST | Dispara plantilla de opt-in |
| /api/whatsapp/send | POST | Envía mensaje manual desde el CRM |
| /api/webhooks/whatsapp | POST | Recibe mensajes entrantes de Meta |
| /api/whatsapp/mensajes | GET | Historial de chat por cliente |

### UI: Switch de Alertas de Fidelización

En el desplegable de Clientes (FichaCliente), debajo del tipo de persona:

```
┌─────────────────────────────────────────┐
│ Alertas de Fidelización  [ switch ON/OFF ] │
│                                         │
│ Si está ON:                             │
│   WhatsApp: [ input: +34 6XX XXX XXX  ] │
│   Estado Opt-In: ✅ Confirmado / ⏳ Pendiente / ❌ No autorizado │
│                                         │
│ [Botón: Enviar solicitud Opt-In]        │
└─────────────────────────────────────────┘
```

### Panel de Chat Flotante (Zustand)

```typescript
// stores/chat-store.ts
interface ChatState {
  abierto: boolean;
  clienteActual: string | null;
  mensajes: Mensaje[];
  noLeidos: number;
  abrirChat: (idCliente: string) => void;
  cerrarChat: () => void;
  recibirMensaje: (msg: Mensaje) => void;
}
```

El panel aparece en la esquina inferior derecha como un modal flotante,
estilo WhatsApp Web, accesible desde cualquier página del CRM.
Comparte diseño unificado con el modal de Tramitación.

---

## 🔔 Notificaciones y Tipificación — Diseño Detallado

### Tipos de Notificación

| Tipo | Disparador | Canal | Destino |
|---|---|---|---|
| Alerta Renove | Bot detecta renove + opt-in activo | WhatsApp (Meta) | Cliente |
| Opt-In Request | Asesor activa switch en CRM | WhatsApp (Meta) | Cliente |
| Lead Asignado | Supervisor asigna lead | In-App (Pusher/SSE) | Asesor |
| Callback Pendiente | Agenda programa callback | In-App + Toast | Asesor |
| Cliente Responde | Meta webhook entrante | In-App (Pusher/SSE) | Asesor asignado |
| Bot Error | Worker muere o proxy falla | In-App (Admin) | Admin/IT |

### Flujo de Tipificación en el CRM

```
Asesor en Power Dialer
  │
  ├─ Click2Call → VPBX originate
  ├─ Habla con el cliente
  └─ Al colgar → aparece modal de tipificación:
       │
       ├─ ¿Contactó?:  SI / NO (buzón, no contesta)
       ├─ Estado:       Interesado / No Interesa / Callback
       ├─ Notas:        [textarea]
       ├─ ¿Activar Alertas Fidelización? [switch]
       │    └─ Si ON → [input WhatsApp]
       └─ Guardar
            │
            ▼
       PATCH /api/pipeline
            │
            ├─ Actualiza pipeline.estado
            ├─ Inserta en historial (vía trigger PostgreSQL)
            ├─ Si callback → agenda en callback_at
            └─ Si switch ON → dispara flujo Opt-In
```

### Estados de Tipificación

```
Pendiente → Contactado → Interesado → Negociación → Venta → Tramitado → Activado
                                                  → No Interesa
            → No Contesta → Callback programado (reintentar en 7 días)
            → Buzón / Apagado → Callback programado
```

### Protección de Datos en Tipificación

- Un asesor solo puede tipificar sus propios leads (`WHERE asesor_id = session.userId`)
- El trigger `trigger_auditoria_pipeline` registra cada cambio de estado en `historial`
- El campo `alertas_fidelizacion` y `whatsapp_opt_in` requieren acción explícita del asesor (no se activan solos)
- La plantilla de Opt-In incluye texto legal RGPD
- El cliente puede revocar opt-in respondiendo "BAJA" por WhatsApp → webhook actualiza `whatsapp_opt_in = false`
