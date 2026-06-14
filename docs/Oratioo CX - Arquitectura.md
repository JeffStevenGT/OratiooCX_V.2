# Oratioo CX — Arquitectura del Sistema (v5.3)

> **Stack:** Next.js 15 + TypeScript + PostgreSQL 16 + Python 3.13 / Playwright
> **Deploy Objetivo:** VPS Hetzner CPX41 con Plesk + PC local para bots
> **Alcance:** CRM omnicanal multi-proyecto con bots, VPBX, WhatsApp, pipeline, doble scoring, forecast y gamificación
> **Última actualización:** 10 Junio 2026

---

## 1. Visión General y Alcance Multi-Proyecto

Oratioo CX es un CRM omnicanal diseñado para gestionar **múltiples proyectos comerciales simultáneos** bajo una misma plataforma unificada. Cada proyecto representa una campaña o línea de negocio independiente, con sus propios datos, equipos, configuraciones y KPIs, pero compartiendo la infraestructura central.

### 1.1 Proyectos Actuales y Futuros

| Proyecto   | Tipo       | Estado        | Descripción                                                                    |
| ---------- | ---------- | ------------- | ------------------------------------------------------------------------------ |
| Orange     | Telecom    | En desarrollo | Venta de líneas móviles, fibra y TV. Datos extraídos automáticamente de Pangea |
| Repsol     | Utilities  | Futuro        | Comercialización de luz y gas                                                  |

### 1.2 Arquitectura Multi-Proyecto

Cada proyecto comparte la infraestructura central pero mantiene datos aislados:

```
┌───────────────────────────────────────────────────────────┐
│                  ORATIOO CX PLATFORM                      │
│                                                           │
│  ┌──────────┐  ┌──────────┐    │
│  │ ORANGE   │  │ REPSOL   │    │
│  │ proyecto │  │ proyecto │    │
│  │  id=1    │  │  id=2    │    │
│  └────┬─────┘  └────┬─────┘    │
│       │             │          │
│  ┌────┴─────────────┴───────┐ │
│  │              INFRAESTRUCTURA COMPARTIDA              │ │
│  │  • PostgreSQL (schemas o filtrado por proyecto_id)   │ │
│  │  • Next.js API (rutas con ?proyecto_id param)        │ │
│  │  • Bots Python (workers asignados por proyecto)      │ │
│  │  • VPBX (centralita multi-campaña)                   │ │
│  │  • WhatsApp (multi-número por proyecto)              │ │
│  └──────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

### 1.3 Aislamiento de Datos por Proyecto

Todas las tablas principales incluyen `proyecto_id` como clave de partición:

```sql
-- Ejemplo: clientes_proyectos
CREATE TABLE clientes_proyectos (
    id BIGSERIAL,
    id_cliente TEXT,
    proyecto_id BIGINT REFERENCES proyectos(id),  -- ← partición
    datos JSONB,
    UNIQUE(id_cliente, proyecto_id)                -- ← un cliente puede estar en varios proyectos
);

-- Consultas siempre filtradas por proyecto
SELECT * FROM pipeline WHERE proyecto_id = $1 AND estado = 'pendiente';
```

**Ventajas:**

- Un mismo cliente (DNI) puede existir en múltiples proyectos sin conflicto
- Cada proyecto tiene su propia cola de extracción, pipeline, y métricas
- Los dashboards filtran por proyecto automáticamente
- Las codificaciones de tipificación son configurables por proyecto

---

## 2. Stack Tecnológico Detallado

### 2.1 Frontend + API (Next.js 15)

| Componente    | Tecnología               | Versión | Propósito                    |
| ------------- | ------------------------ | ------- | ---------------------------- |
| Framework     | Next.js App Router       | 15.5.19 | SSR, API Routes, Middleware  |
| Lenguaje      | TypeScript               | 5.x     | Tipado estático              |
| Estilos       | Tailwind CSS             | 3.4     | Utility-first CSS            |
| Iconos        | Lucide React             | latest  | Iconografía consistente      |
| Gráficos      | Recharts                 | latest  | Dashboards y KPIs            |
| Estado Global | React Context + useState | nativo  | Sin dependencias externas    |
| Formularios   | React Hook Form + Zod    | latest  | Validación                   |
| HTTP Client   | fetch nativo             | —       | Sin axios ni librerías extra |
| DB Driver     | pg (Pool)                | latest  | Conexión PostgreSQL          |
| Auth          | NextAuth.js v5           | beta    | Credentials Provider + JWT   |

**Estructura del Proyecto Frontend:**

```
src/
├── app/
│   ├── (auth)/login/              # Página de login (pública)
│   ├── (dashboard)/               # 20 páginas protegidas por rol
│   │   ├── asesor/                # Dashboard personal del operador
│   │   │   └── page.tsx           #   Mis Leads con tabla + filtros
│   │   ├── supervisor/            # Panel de gestión de equipo
│   │   │   └── page.tsx           #   LivePanel + rendimiento + drill-down
│   │   ├── jefe/                  # Visión ejecutiva
│   │   │   └── page.tsx           #   Funnel + comparativa + forecast + scoring
│   │   ├── clientes/              # Tabla maestra de clientes
│   │   │   └── page.tsx           #   9 columnas, filtros, export CSV, expandir líneas
│   │   ├── power-dialer/          # Discador telefónico
│   │   │   └── page.tsx           #   Lista de leads + botones llamar + tipificar
│   │   ├── asignar-leads/         # Asignación masiva
│   │   │   └── page.tsx           #   Pool → seleccionar → repartir round-robin
│   │   ├── rendimiento/           # Dashboard de rendimiento unificado
│   │   │   └── page.tsx           #   Ranking + cinturones + tendencias + heatmap
│   │   ├── estadisticas/          # KPIs y métricas
│   │   │   └── page.tsx           #   Gráficos + tabla por asesor + export CSV
│   │   ├── auditoria/             # Timeline de actividad
│   │   │   └── page.tsx           #   Filtros fecha/tipo + búsqueda
│   │   ├── metas/                 # Ranking de operadores
│   │   │   └── page.tsx           #   Barras progreso + KPIs + filtro equipo
│   │   ├── alertas/               # Centro de notificaciones
│   │   │   └── page.tsx           #   Sin asignar, por vencer, máquinas offline
│   │   ├── calidad/               # Quality Assurance
│   │   │   └── page.tsx           #   Rúbrica 5 criterios + resumen por asesor
│   │   ├── backoffice/            # Tramitación post-venta
│   │   │   ├── page.tsx           #   Pendientes/Tramitados
│   │   │   └── tramitacion/       #   Verificación de documentos
│   │   ├── bots/       # Gestión técnica
│   │   │   └── page.tsx           #   Tabs: Proxies, Máquinas, Credenciales
│   │   ├── bots/                  # Control de workers
│   │   │   └── page.tsx           #   Iniciar/Detener + workers count + máquina
│   │   ├── usuarios/              # CRUD de usuarios
│   │   │   └── page.tsx           #   Tabla con crear/editar/eliminar
│   │   ├── vpbx/                  # Gestión VPBX
│   │   │   └── page.tsx           #   Extensiones + agentes en vivo
│   │   ├── config/                # Configuración del sistema
│   │   │   └── page.tsx           #   Parámetros operativos
│   │   ├── proyectos/             # Gestión multi-proyecto
│   │   │   └── page.tsx           #   Crear/editar proyectos + stats
│   │   └── wikiratioo/            # Base de conocimiento
│   │       └── page.tsx           #   Artículos y guías
│   └── api/                       # 53 endpoints REST
│       ├── clientes/              # CRUD clientes + reanalizar
│       ├── pipeline/              # 12 endpoints de pipeline
│       ├── vpbx/                  # Click2Call + agents + CDR + extensions
│       ├── webhooks/              # VPBX + WhatsApp entrantes
│       ├── internal/              # bot-sync (interno)
│       ├── bot/                   # next-dni, command, touch, credenciales
│       ├── dashboard/             # proyecto, salud-base, rendimiento, scoring, forecast, cinturones, notificaciones, reportes
│       ├── admin/                 # stats, credenciales
│       ├── whatsapp/              # send, plantillas
│       ├── compras/               # CRUD de compras/ventas
│       ├── tipificaciones-config/ # CRUD dinámico
│       ├── listas-negras/         # Reportes CSV
│       ├── qa/                    # Evaluaciones calidad
│       ├── usuarios/              # CRUD usuarios
│       ├── documentos/            # Upload + cola
│       └── sse/                   # Server-Sent Events
├── components/
│   ├── shared/
│   │   ├── Sidebar.tsx            # Menú lateral con badges y colapsables
│   │   ├── LivePanel.tsx          # Panel en vivo de asesores (VPBX real, sin hardcode)
│   │   ├── NotificationBadge.tsx  # Badge de notificaciones en sidebar
│   │   ├── OratiooLogo.tsx        # Logo SVG corporativo
│   │   └── WhatsAppChat.tsx       # Chat flotante de WhatsApp
│   └── clientes/
│       └── FichaCliente.tsx       # Modal 360° del cliente
├── lib/
│   ├── auth.ts                    # NextAuth configuración
│   ├── auth-roles.ts              # requireRole, requirePipelineOwnership
│   ├── db.ts                      # Pool PostgreSQL + helpers + transacciones
│   ├── vpbx.ts                    # Cliente VPBX (14 funciones)
│   ├── whatsapp.ts                # Cliente WhatsApp (sendText, sendTemplate, parseIncoming)
│   └── project-context.ts         # Contexto de proyecto activo
└── middleware.ts                   # RBAC por ruta + autenticación
```

### 2.2 Base de Datos (PostgreSQL 16)

| Componente | Detalle                                                                               |
| ---------- | ------------------------------------------------------------------------------------- |
| Motor      | PostgreSQL 16                                                                         |
| Desarrollo | localhost:5433                                                                        |
| Producción | VPS Hetzner con Plesk                                                               |
| Pool       | 20 conexiones máx, 30s statement timeout, 30s idle timeout                            |
| Schemas    | Único schema `public` con filtrado por `proyecto_id`                                  |
| Backups    | pg_dump diario + WAL archiving (producción)                                           |
| Índices    | 18 índices en tablas críticas (pipeline, historial, clientes_proyectos, scoring, etc.)|
| Triggers   | 4 triggers (auditoría pipeline, auditoría extracción, auto lista negra, updated_at)   |
| Funciones  | 8 funciones PL/pgSQL (scoring, forecast, cinturones, métricas, etc.)                  |
| Vistas     | 2 vistas (pipeline_activos, v_scoring_resumen)                                        |

### 2.3 Bots (Python 3.13 + Playwright)

| Componente     | Tecnología                                    | Detalle                                        |
| -------------- | --------------------------------------------- | ---------------------------------------------- |
| Lenguaje       | Python 3.13                                   |                                                |
| Automatización | Playwright (Chromium)                         | Headless en producción                         |
| Proxies        | 20 IPs residenciales España                   | Rotación 1:1 por worker                        |
| Conexión BD    | HTTP a Next.js API                            | Cero PostgreSQL directo desde el bot           |
| Coordinador    | coordinator_loop.py                           | Daemon 24/7, heartbeat 30s, comandos cada 5s   |
| Workers        | worker_loop.py                                | N workers independientes con su propio browser |
| Dependencias   | playwright, requests, python-dotenv, psycopg2 |                                                |

### 2.4 Comunicaciones


> **8 Junio 2026 � Hardening v2:** Auth en compras/maquinas/proyectos. Soft-delete en compras. Workers con limite de reinicio (5/h). proyecto_id dinamico en bot. Proyecto por defecto dinamico.
> **Junio 2026:** Scoring v2 implementado (migración 021). Evalúa 14 factores: CIMA, Renove, TV, permanencia con fecha, WhatsApp, estados de línea, contactable/no contactable desde pipeline. Bot extrae `permanencia_fecha` como fecha ISO.


| Componente      | Tecnología                | Estado        | Detalle                               |
| --------------- | ------------------------- | ------------- | ------------------------------------- |
| Centralita VoIP | VPBX (Siptize)            | En desarrollo | 15 endpoints REST + WebSockets        |
| Mensajería      | Meta Cloud API (WhatsApp) | En desarrollo | Librería completa, webhooks diseñados |
| Colas           | Redis                     | Planificado   | Para webhooks VPBX de alta velocidad  |
| Archivos        | VPBX (nativo)          | ✅ Integrado | Almacena grabaciones 1 año     |
| Email           | SMTP                      | Futuro        | Notificaciones y reportes             |

---

## 3. Flujo de Datos Completo

### 3.1 Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                     FUENTES DE DATOS                            │
│                                                                 │
│  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Orange Pangea│  │ Otras fuentes (Excel,│   │
│  │ (Portal web) │  │ API, carga manual)   │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                 │                      │              │
│         │ Playwright      │ Playwright           │ Upload       │
│         │ + Proxy ES      │ + Proxy ES           │ CSV/Excel    │
│         ▼                 ▼                      ▼              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   BOT PYTHON                             │   │
│  │                                                          │   │
│  │  coordinator_loop.py (daemon 24/7)                       │   │
│  │    │                                                     │   │
│  │    ├── worker_loop.py × N workers                        │   │
│  │    │      ├── login.py (autenticación en portales)       │   │
│  │    │      ├── browser_setup.py (proxy + geolocalización) │   │
│  │    │      └── extraer_datos_cliente()                    │   │
│  │    │                                                     │   │
│  │    └── Comandos: iniciar, detener, pausar, workers=N     │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │ HTTP (API-First)                      │
│                         │ POST /api/internal/bot-sync           │
│                         │ GET  /api/bot/next-dni                │
│                         │ GET  /api/bot/command                 │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                NEXT.JS API (47 endpoints)                │   │
│  │                                                          │   │
│  │  Clientes     Pipeline     VPBX        WhatsApp          │   │
│  │  Documentos   Dashboard    Admin       Webhooks          │   │
│  │  QA           Auditoría    Usuarios    Config            │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │ pg Pool (20 conexiones)               │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  POSTGRESQL 16                           │   │
│  │                                                          │   │
│  │  Core:     clientes, pipeline, historial, detecciones    │   │
│  │  VPBX:     cdr_vpbx                                      │   │
│  │  WhatsApp: whatsapp_mensajes, whatsapp_plantillas        │   │
│  │  Calidad:  tipificaciones_config, listas_negras, qa_*    │   │
│  │  Bot:      credenciales_bot, comandos_bot, maquinas      │   │
│  │  Negocio:  analisis_perdidos, proyectos                  │   │
│  │                                                          │   │
│  │  20 tablas | 7 funciones | 4 triggers | 12 índices       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────┐    ┌──────────────────────┐           │
│  │    VPBX (Siptize)    │    │   WhatsApp (Meta)    │           │
│  │                      │    │                      │           │
│  │  Webhooks → CRM      │    │  Webhooks → CRM      │           │
│  │  CRM → Click2Call    │    │  CRM → Send Message  │           │
│  │  CRM → CDR Sync      │    │  CRM → Templates     │           │
│  │  CRM → Agent Status  │    │                      │           │
│  └──────────────────────┘    └──────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Flujo de Extracción (Bot Python → PostgreSQL)

```
┌─────────────────────────────────────────────────────────────┐
│ Paso 1: Coordinator recibe comando "iniciar"                │
│   • Frontend → POST /api/bot/command {comando:"iniciar"}    │
│   • Coordinator → GET /api/bot/command?maquina=localhost    │
│   • Coordinator → spawn_workers(N)                          │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Paso 2: Worker se inicializa                                │
│   • load_dotenv() → ORANGE_USER, ORANGE_PASS, BOT_API_URL   │
│   • Crear browser Playwright con proxy español              │
│   • login_loop() → autenticar en Orange Pangea              │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Paso 3: Loop de procesamiento                               │
│   while True:                                               │
│     dni_data = GET /api/bot/next-dni                        │
│     if not dni_data: sleep(5s), continue                    │
│     touch_dni(id_cliente) → POST /api/bot/touch             │
│     datos = extraer_datos_cliente(page, dni)                │
│     POST /api/internal/bot-sync {id_cliente, datos}         │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Paso 4: Bot-Sync procesa datos                              │
│   • Recibe datos JSON del bot                               │
│   • Determina si es primera extracción o re-análisis        │
│     → Sin datos previos: version_extraccion = 1             │
│     → Con datos previos: version_extraccion = N+1           │
│   • UPSERT en clientes_proyectos.datos (con version)        │
│   • Actualiza clientes.nombre_razon_social                  │
│   • Solo si version >= 2: detectarCambios() → detecciones   │
│   • INSERT en historial (descripción contextual)            │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Base de Datos — Esquema Completo

### 4.1 Tabla `proyectos`

```sql
CREATE TABLE proyectos (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.2 Tabla `clientes`

```sql
CREATE TABLE clientes (
    id_cliente TEXT PRIMARY KEY,        -- "DNI_12345678A", "NIE_X...", "NIF_B..."
    tipo_documento TEXT NOT NULL,       -- DNI, NIE, NIF
    numero_documento TEXT NOT NULL,     -- 12345678A, X1234567L, B12345678
    nombre_razon_social TEXT,
    tipo_persona TEXT DEFAULT 'natural', -- natural, autonomo, empresa
    cnae TEXT,                          -- Clasificación Nacional de Actividades Económicas
    telefonos JSONB,                    -- Legacy: ["+34600111222", "+34911222333"]
    telefonos_v2 JSONB DEFAULT '[]',    -- Nuevo: [{"num","tipo","origen"}, ...]
    emails TEXT[],                      -- Array de correos electrónicos
    direccion JSONB,                    -- {calle, ciudad, cp, provincia}
    whatsapp_opt_in BOOLEAN DEFAULT false,
    whatsapp_numero TEXT,
    whatsapp_opt_in_fecha TIMESTAMPTZ,
    alertas_fidelizacion BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ              -- Soft delete (RGPD)
);

CREATE INDEX idx_clientes_documento ON clientes(numero_documento);
```

### 4.3 Tabla `clientes_proyectos`

```sql
CREATE TABLE clientes_proyectos (
    id BIGSERIAL PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente),
    proyecto_id BIGINT NOT NULL REFERENCES proyectos(id),
    datos JSONB NOT NULL DEFAULT '{}',
    ultima_extraccion TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(id_cliente, proyecto_id)
);

CREATE INDEX idx_cp_proyecto_estado ON clientes_proyectos(proyecto_id, (datos->>'estado'));
```

### 4.4 Tabla `pipeline`

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

CREATE INDEX idx_pipeline_asesor_estado ON pipeline(asesor_id, estado, deleted_at);
CREATE INDEX idx_pipeline_proyecto_estado ON pipeline(proyecto_id, deleted_at, estado);
CREATE UNIQUE INDEX idx_pipeline_unique_active ON pipeline(id_cliente, proyecto_id, asesor_id) WHERE deleted_at IS NULL;
```

### 4.5 Tabla `historial`

```sql
CREATE TABLE historial (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    proyecto_id BIGINT REFERENCES proyectos(id),
    asesor_id BIGINT REFERENCES usuarios(id),
    descripcion TEXT,
    datos JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_historial_cliente_tipo_fecha ON historial(id_cliente, tipo, created_at DESC);
```

### 4.6 Sistema de Detección de Cambios y Versionado

Cada vez que el bot extrae datos de un cliente, el sistema compara con la extracción anterior para detectar cambios reales. Para evitar falsos positivos en el primer análisis, se implementa un **contador de versiones** dentro del JSONB `clientes_proyectos.datos`.

**Campos de versionado en `datos`:**

```json
{
  "estado": "completado",
  "version_extraccion": 2,
  "primera_extraccion_at": "2026-06-08T10:00:00.000Z",
  "header": { ... },
  "lineas": [ ... ]
}
```

**Lógica de detección:**

| Escenario | `version_extraccion` | ¿Genera detecciones? | Frontend muestra |
|-----------|---------------------|---------------------|------------------|
| Primera extracción (sin datos previos) | 1 | No | "Análisis inicial — X líneas" |
| Cliente pre-cargado con estado pendiente (mínimo) | 1 | No | "Análisis inicial — X líneas" |
| Re-análisis (datos previos reales) | ≥ 2 | Sí | "Cambios detectados (N)" |
| Cliente legacy sin campo `version_extraccion` | Se infiere v≥1 si tiene lineas | Sí (si hay diff) | "Cambios detectados (N)" |

**Compatibilidad hacia atrás:** Clientes analizados antes de esta feature (sin `version_extraccion`) se detectan automáticamente: si su JSONB contiene `lineas` con datos reales, se tratan como versión ≥ 1. La siguiente extracción generará `version_extraccion = 2` y correrá la detección de cambios normalmente.

### 4.7 Tabla `detecciones`

```sql
CREATE TABLE detecciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente),
    proyecto_id BIGINT NOT NULL REFERENCES proyectos(id) DEFAULT 1,
    tipo TEXT NOT NULL,
    linea_numero TEXT,
    valor_anterior TEXT,
    valor_nuevo TEXT,
    datos_extra JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.8 Tabla `cdr_vpbx`

```sql
CREATE TABLE cdr_vpbx (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    call_id TEXT UNIQUE NOT NULL,
    id_cliente TEXT REFERENCES clientes(id_cliente),
    asesor_id BIGINT REFERENCES usuarios(id),
    created TIMESTAMPTZ NOT NULL,
    duration INT DEFAULT 0,
    billsec INT DEFAULT 0,
    hangup_cause TEXT,
    src TEXT,
    dst TEXT,
    recording BOOLEAN DEFAULT false,
    raw_data JSONB DEFAULT '{}',
    sincronizado TIMESTAMPTZ DEFAULT now()
);
```

### 4.9 Tabla `whatsapp_mensajes`

```sql
CREATE TABLE whatsapp_mensajes (
    id BIGSERIAL PRIMARY KEY,
    id_cliente TEXT REFERENCES clientes(id_cliente),
    proyecto_id BIGINT REFERENCES proyectos(id) DEFAULT 1,
    direccion TEXT NOT NULL CHECK (direccion IN ('entrante', 'saliente')),
    tipo TEXT NOT NULL,
    contenido TEXT,
    metadata JSONB DEFAULT '{}',
    whatsapp_message_id TEXT,
    leido BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.10 Tabla `whatsapp_plantillas`

```sql
CREATE TABLE whatsapp_plantillas (
    id BIGSERIAL PRIMARY KEY,
    proyecto_id BIGINT REFERENCES proyectos(id) DEFAULT 1,
    nombre TEXT NOT NULL,
    contenido TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.11 Tabla `tipificaciones_config`

```sql
CREATE TABLE tipificaciones_config (
    id SERIAL PRIMARY KEY,
    proyecto_id INT NOT NULL REFERENCES proyectos(id) DEFAULT 1,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('estado', 'sub_estado')),
    codigo VARCHAR(50) NOT NULL,
    etiqueta VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT '#6b7280',
    orden INT DEFAULT 0,
    afecta_calidad BOOLEAN DEFAULT false,
    visible_en_power_dialer BOOLEAN DEFAULT true,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(proyecto_id, tipo, codigo)
);
```

### 4.12 Tabla `listas_negras`

```sql
CREATE TABLE listas_negras (
    id SERIAL PRIMARY KEY,
    proyecto_id INT NOT NULL REFERENCES proyectos(id) DEFAULT 1,
    telefono VARCHAR(20) NOT NULL,
    id_cliente TEXT REFERENCES clientes(id_cliente),
    motivo VARCHAR(100) NOT NULL,
    origen VARCHAR(50) DEFAULT 'manual',
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(proyecto_id, telefono)
);
```

### 4.13 Tabla `qa_evaluaciones`

```sql
CREATE TABLE qa_evaluaciones (
    id SERIAL PRIMARY KEY,
    proyecto_id BIGINT REFERENCES proyectos(id) DEFAULT 1,
    pipeline_id BIGINT REFERENCES pipeline(id),
    evaluador_id BIGINT NOT NULL REFERENCES usuarios(id),
    asesor_id BIGINT NOT NULL REFERENCES usuarios(id),
    speech INT CHECK (speech BETWEEN 1 AND 5),
    objeciones INT CHECK (objeciones BETWEEN 1 AND 5),
    cierre INT CHECK (cierre BETWEEN 1 AND 5),
    compliance INT CHECK (compliance BETWEEN 1 AND 5),
    empatia INT CHECK (empatia BETWEEN 1 AND 5),
    puntaje_total INT GENERATED ALWAYS AS (speech + objeciones + cierre + compliance + empatia) STORED,
    comentarios TEXT,
    evaluado_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.14 Tablas del Bot

```sql
-- Credenciales para portales externos
CREATE TABLE credenciales_bot (
    id SERIAL PRIMARY KEY,
    usuario TEXT NOT NULL,
    password TEXT NOT NULL,
    activo BOOLEAN DEFAULT true,
    ultimo_error TEXT,
    ultimo_uso TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Cola de comandos frontend → coordinator
CREATE TABLE comandos_bot (
    id SERIAL PRIMARY KEY,
    maquina_destino TEXT NOT NULL,
    comando TEXT NOT NULL,
    parametros JSONB DEFAULT '{}',
    estado TEXT DEFAULT 'pendiente',
    ejecutado_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Registro de máquinas con coordinator
CREATE TABLE maquinas (
    id SERIAL PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL,
    ip TEXT,
    workers_max INT DEFAULT 20,
    workers_activos INT DEFAULT 0,
    workers_info JSONB DEFAULT '[]',
    estado TEXT DEFAULT 'offline',
    ultimo_heartbeat TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.15 Tablas de Negocio

```sql
-- Leads cerrados sin venta
CREATE TABLE analisis_perdidos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente),
    proyecto_id BIGINT NOT NULL DEFAULT 1,
    asesor_id BIGINT NOT NULL,
    estado_final TEXT NOT NULL,
    sub_estado TEXT,
    intentos_totales INTEGER DEFAULT 0,
    cima_al_cierre TEXT,
    renove_al_cierre BOOLEAN,
    lineas_al_cierre INTEGER,
    cerrado_at TIMESTAMPTZ DEFAULT now()
);

-- Configuración del sistema
CREATE TABLE configuracion (
    id SERIAL PRIMARY KEY,
    proyecto_id BIGINT REFERENCES proyectos(id) DEFAULT 1,
    clave TEXT NOT NULL,
    valor JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(proyecto_id, clave)
);
```

### 4.15 Tablas de Inteligencia Comercial (Fase 7)

```sql
-- Métricas diarias por asesor (snapshot)
CREATE TABLE metricas_diarias (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    proyecto_id BIGINT NOT NULL REFERENCES proyectos(id),
    asesor_id BIGINT REFERENCES usuarios(id),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    leads_asignados INT DEFAULT 0,
    leads_contactados INT DEFAULT 0,
    leads_interesados INT DEFAULT 0,
    leads_negociacion INT DEFAULT 0,
    ventas INT DEFAULT 0,
    no_interesa INT DEFAULT 0,
    no_contesta INT DEFAULT 0,
    total_llamadas INT DEFAULT 0,
    llamadas_contestadas INT DEFAULT 0,
    segundos_hablados INT DEFAULT 0,
    segundos_conectado INT DEFAULT 0,
    wrap_up_promedio_seg INT DEFAULT 0,
    hasta_llamar_promedio_seg INT DEFAULT 0,
    puntuacion_calidad NUMERIC(3,1),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(proyecto_id, asesor_id, fecha)
);

-- Cinturones (gamificación)
CREATE TABLE cinturones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre TEXT NOT NULL,
    color_hex TEXT NOT NULL,
    orden INT NOT NULL,
    ventas_min_mes INT NOT NULL,
    contactabilidad_min NUMERIC(5,2) DEFAULT 0,
    efectividad_min NUMERIC(5,2) DEFAULT 0,
    calidad_min NUMERIC(3,1) DEFAULT 0,
    icono TEXT DEFAULT '🏅',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Logros de cinturón por asesor y mes
CREATE TABLE logros_cinturon (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    asesor_id BIGINT NOT NULL REFERENCES usuarios(id),
    cinturon_id BIGINT NOT NULL REFERENCES cinturones(id),
    mes TEXT NOT NULL,
    ventas_mes INT NOT NULL,
    contactabilidad NUMERIC(5,2),
    efectividad NUMERIC(5,2),
    calidad_promedio NUMERIC(3,1),
    obtenido_at TIMESTAMPTZ DEFAULT now()
);

-- Notificaciones automáticas al supervisor
CREATE TABLE notificaciones_supervisor (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supervisor_id BIGINT NOT NULL REFERENCES usuarios(id),
    asesor_id BIGINT REFERENCES usuarios(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('bajo_rendimiento','sin_actividad','excede_no_interesa',
        'sin_ventas','recuperacion','cinturon_obtenido','caida_rendimiento')),
    titulo TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    datos JSONB DEFAULT '{}',
    leida BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Scoring de leads (A+ a E)
CREATE TABLE scoring_leads (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    proyecto_id BIGINT NOT NULL REFERENCES proyectos(id),
    nivel TEXT NOT NULL CHECK (nivel IN ('A+','A','B','C','D','E')),
    puntuacion INT NOT NULL DEFAULT 0,
    tiene_cima BOOLEAN DEFAULT false,
    tiene_renove BOOLEAN DEFAULT false,
    tipo_renove TEXT,
    num_lineas INT DEFAULT 0,
    antiguedad_meses INT,
    consumo_medio NUMERIC(12,2),
    tiene_permanencia BOOLEAN DEFAULT false,
    facturas_impagadas INT DEFAULT 0,
    evaluado_at TIMESTAMPTZ DEFAULT now(),
    version_scoring INT DEFAULT 1,
    UNIQUE(id_cliente, proyecto_id)
);

-- Compras/ventas registradas
CREATE TABLE compras (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    proyecto_id BIGINT NOT NULL REFERENCES proyectos(id),
    fecha_compra DATE NOT NULL DEFAULT CURRENT_DATE,
    tipo_producto TEXT,
    numero_linea TEXT,
    importe NUMERIC(10,2),
    comision_estimada NUMERIC(10,2),
    origen TEXT DEFAULT 'manual',
    sica_id TEXT,
    notas TEXT,
    asesor_id BIGINT REFERENCES usuarios(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Log de sincronización con SICA
CREATE TABLE sica_sync (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    proyecto_id BIGINT NOT NULL REFERENCES proyectos(id),
    direccion TEXT NOT NULL DEFAULT 'subida',
    estado TEXT DEFAULT 'pendiente',
    registros_procesados INT DEFAULT 0,
    registros_nuevos INT DEFAULT 0,
    registros_error INT DEFAULT 0,
    archivo_nombre TEXT,
    error_mensaje TEXT,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);
```

### 4.16 Funciones PL/pgSQL (11 funciones)

```sql
-- Toma atómica de DNI (evita duplicados entre workers)
CREATE FUNCTION tomar_siguiente_dni(p_proyecto_id BIGINT)
RETURNS TABLE (id_cp BIGINT, id_cliente_out TEXT);

-- Salud de base de datos
CREATE FUNCTION salud_base(p_proyecto_id BIGINT)
RETURNS JSONB;

-- Generar métricas diarias para todos los asesores
CREATE FUNCTION generar_metricas_diarias(p_proyecto_id BIGINT, p_fecha DATE DEFAULT CURRENT_DATE - 1)
RETURNS INT;

-- Obtener cinturón actual de un asesor (4 niveles: Blanco/Azul/Marrón/Faixa Preta)
CREATE FUNCTION cinturon_actual(p_asesor_id BIGINT, p_mes TEXT)
RETURNS TABLE (cinturon_nombre TEXT, cinturon_color TEXT, cinturon_icono TEXT, cinturon_orden INT,
    ventas_mes INT, contactabilidad NUMERIC, efectividad NUMERIC, calidad NUMERIC,
    prox_cinturon TEXT, prox_ventas_faltan INT);

-- Calcular scoring por datos de Orange (CIMA, Renove, consumo)
CREATE FUNCTION calcular_scoring_lead(p_id_cliente TEXT, p_proyecto_id BIGINT)
RETURNS TABLE (nivel TEXT, puntuacion INT, tiene_cima BOOLEAN, tiene_renove BOOLEAN,
    tipo_renove TEXT, num_lineas INT, antiguedad_meses INT, consumo_medio NUMERIC);

-- Calcular scoring Orange masivo
CREATE FUNCTION calcular_scoring_masivo(p_proyecto_id BIGINT)
RETURNS TABLE (nivel TEXT, total BIGINT);

-- Calcular scoring por historial de contacto + compras (criterios Yone)
CREATE FUNCTION calcular_scoring_contacto_masivo(p_proyecto_id BIGINT)
RETURNS TABLE (nivel TEXT, total BIGINT);

-- Forecast de ventas basado en pipeline (leads × contactabilidad × efectividad)
CREATE FUNCTION forecast_ventas(p_proyecto_id BIGINT, p_dias_historial INT DEFAULT 30, p_dias_forecast INT DEFAULT 7)
RETURNS TABLE (fecha DATE, tipo TEXT, ventas INT, intervalo_inf INT, intervalo_sup INT);

-- Tasa de reutilización de registros
CREATE FUNCTION tasa_reutilizacion(p_proyecto_id BIGINT, p_dias INT DEFAULT 90)
RETURNS TABLE (total_registros BIGINT, reanalizados BIGINT, tasa NUMERIC, promedio_dias_entre_extracciones NUMERIC);

-- Métricas de abandono de leads (Robinson, no contesta, no interesa, fallecidos)
CREATE FUNCTION metricas_abandono(p_proyecto_id BIGINT, p_dias INT DEFAULT 90)
RETURNS TABLE (motivo TEXT, total BIGINT);

-- Helpers de telefonos_v2
CREATE FUNCTION telefonos_agregar(...) RETURNS JSONB;
CREATE FUNCTION telefonos_marcar_contacto(...) RETURNS JSONB;
CREATE FUNCTION telefonos_nums(...) RETURNS TEXT[];
```

### 4.17 Tablas Adicionales (Fase 7 — Ajustes Yone)

```sql
-- Scoring por historial de contacto + compras
CREATE TABLE scoring_contactabilidad (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    proyecto_id BIGINT NOT NULL REFERENCES proyectos(id),
    nivel TEXT NOT NULL CHECK (nivel IN ('A+','A','B','C','D','E')),
    contactabilidad TEXT,
    num_intentos INT DEFAULT 0,
    num_contactos INT DEFAULT 0,
    num_compras INT DEFAULT 0,
    es_recurrente BOOLEAN DEFAULT false,
    es_decisor BOOLEAN DEFAULT true,
    puntuacion INT NOT NULL DEFAULT 0,
    evaluado_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(id_cliente, proyecto_id)
);
```

### 4.18 Vistas

```sql
-- Distribución de scoring por nivel
CREATE VIEW v_scoring_resumen AS
SELECT proyecto_id, nivel, COUNT(*) as total,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY proyecto_id), 1) as porcentaje
FROM scoring_leads GROUP BY proyecto_id, nivel;

-- Pipeline activos (sin soft delete)
CREATE VIEW pipeline_activos AS
SELECT * FROM pipeline WHERE deleted_at IS NULL;
```

---

## 5. Integración VPBX (Siptize) — Detalle Completo

### 5.1 Visión General

VPBX es la centralita VoIP en la nube que proporciona:

- Extensiones SIP por asesor
- Click2Call desde el CRM hacia cualquier número
- CDR (Call Detail Records) con registro completo de llamadas
- Grabación de llamadas en MP3
- Webhooks en tiempo real para eventos de llamada
- WebSocket App para streaming de audio bidireccional (IA conversacional)
- API REST completa con 15+ endpoints

### 5.2 Autenticación

Todas las peticiones a la API de VPBX requieren el header:

```
X-Api-Key: {api_key}
```

La API key se configura en el panel de administración de VPBX y se almacena en `.env`:

```
VPBX_API_KEY=sk_live_xxxxxxxxxxxx
VPBX_API_URL=https://vpbx.me/api
```

### 5.3 Endpoints Implementados (15 funciones)

#### Extensions — Listar con asignacion CRM

```
GET /api/vpbx/extensions
```

Fusiona extensiones de la VPBX (via `GET /extension`) con los usuarios del CRM (campo `extension_vpbx`). Cada extension incluye el operador asignado (id, nombre, email, rol, equipo). Roles: supervisor, jefe_area, desarrollador, it.

#### Click2Call — Iniciar llamada saliente

```
GET /originatecall/{extension}/{numero}?timeout=30&autoAnswer=false
```

**Flujo:**

1. Frontend (Power Dialer) → `POST /api/vpbx/originate {from: "101", to: "622534699"}`
2. API → VPBX: `GET /originatecall/101/622534699`
3. Suena el teléfono del asesor (extensión 101)
4. Asesor descuelga → VPBX marca al cliente (622534699)
5. Se establece la llamada

**Rate Limiting:** Máximo 1 llamada cada 3 segundos por extensión (protección anti-spam).

#### Click2Call Inverso — Llamar a número externo y conectar a destino interno

```
GET /c2cexternal/{numero_externo}/{destino_interno}
```

**Uso:** Sonar en un número externo (ej: móvil del asesor) y al descolgar, conectar a una cola, grupo o extensión interna.

#### Consultar CDR de una llamada

```
GET /cdr/{callId}
```

Retorna: callId, created (timestamp), duration, billsec, hangupCause, src, dst, recording, queueId, queueWaitTime, queueAgent.

#### Listar llamadas con filtros

```
POST /cdr
Body: {from: timestamp, to: timestamp, src: "2023", dst: "966...", start: 0, stop: 50}
```

#### Contar llamadas (paginación)

```
POST /cdrcount
Body: {src: "2023"} → {count: 1420}
```

#### Actualizar variables en CDR (vinculación CRM)

```
POST /cdr/{callId}/updatevars
Body: {var1: "id_cliente", var2: "pipeline_status", var3: "asesor_nombre"}
```

Permite escribir hasta 5 variables personalizadas (máx 255 chars c/u) en el CDR de VPBX. Así el panel de VPBX muestra a qué cliente y pipeline pertenece cada llamada.

#### Obtener ID real de CDR desde Click2Call

```
GET /cdrc2c/{callId}
```

El callId devuelto por originatecall es temporal. Este endpoint devuelve el UUID real del CDR.

#### Estado de Agentes en Vivo

```
GET /agent
→ [{extension: "100", name: "a100", status: "AVAILABLE", breakType: null}, ...]
```

Estados posibles: AVAILABLE, ON_BREAK, IN_CALL, RINGING, OFFLINE.

#### Historial de Cambios de Estado

```
POST /agent/status       → listar eventos de cambio
POST /agent/statuscount  → contar eventos (paginación)
Body: {start: timestamp, end: timestamp, statuses: ["ON_BREAK"], agents: ["201","202"], offset: 0, limit: 50}
```

#### Colas — Monitoreo en Vivo

```
GET /queue/{queueNumber}/waittime  → {waitTime: 136}
GET /queue/{queueNumber}/state     → [{uuid, cidNumber, state, score, servingAgent}]
```

#### Grabaciones

```
GET /recording/{callId} → archivo MP3 (404 si no existe)
```

#### Extensiones — Gestión

```
GET /extension                              → listar todas
GET /extension/{id}                         → datos de una
GET /extension/findbyusername/{username}    → buscar por username
POST /extension/{id}                        → actualizar outboundId
```

#### Voces TTS (Amazon Polly)

```
GET /voiceengine → [{gender, languageCode, voiceAndEngine}, ...]  (120+ voces)
```

### 5.4 Webhooks VPBX → CRM

VPBX envía notificaciones POST a la URL configurada en su panel:

```
POST {URL_CRM}/api/webhooks/vpbx
```

#### Evento RINGING (empieza a sonar)

```json
{
  "eventType": "RINGING",
  "variables": {
    "callId": "62397e2e-7cfc-4c64-ade1-0b833ee3f10a",
    "callerNumber": "915631789",
    "callerName": "Cliente 1",
    "calleeNumber": "115",
    "did": "965428888"
  }
}
```

#### Evento ANSWERED (descuelgue)

```json
{
  "eventType": "ANSWERED",
  "variables": {
    "callId": "...",
    "callerNumber": "915631789",
    "callerName": "Cliente 1",
    "calleeNumber": "115",
    "did": "965428888"
  }
}
```

#### Evento HANGUP (cuelgue)

```json
{
  "eventType": "HANGUP",
  "variables": {
    "callId": "...",
    "callerNumber": "915631789",
    "callerName": "Cliente 1",
    "calleeNumber": "115",
    "did": "965428888"
  }
}
```

**Procesamiento en el CRM:**

1. RINGING → INSERT en `cdr_vpbx` (ON CONFLICT DO NOTHING)
2. ANSWERED → Buscar cliente por `callerNumber` en `telefonos` + `telefonos_v2`. Si encuentra, vincular `id_cliente` y registrar en historial
3. HANGUP → Actualizar `raw_data` y marcar `sincronizado`

**Manejo de errores:** Siempre retorna HTTP 200 para evitar que VPBX reintente. Los errores se loguean con `console.error`.

### 5.5 LivePanel y Pagina VPBX — Estados de Agentes y Extensiones

El componente `LivePanel.tsx` en el Dashboard Supervisor:

1. Consulta `GET /api/vpbx/agents` cada 15 segundos
2. Cruza los estados de VPBX con los usuarios del CRM (por `extension_vpbx`)
3. Mapea estados VPBX → UI: AVAILABLE→🟢, IN_CALL/RINGING→🔵, ON_BREAK→🟡, OFFLINE→⬜
4. Si VPBX no está conectado (sin API key), usa simulación basada en actividad de pipeline

**Pagina de Gestion VPBX (`/vpbx`):**

Accesible desde Sidebar > Administracion para supervisor, jefe_area, desarrollador e it. Dos tabs:
- **Extensiones:** tabla con todas las extensiones de la VPBX + operador asignado del CRM. Permite asignar, cambiar o desasignar extensiones a operadores via `PATCH /api/usuarios`. Incluye buscador.
- **Agentes:** monitoreo en vivo del estado de cada agente con tarjetas resumen (Disponibles, En llamada, Pausa, Offline) y tabla detallada que cruza automaticamente con los operadores del CRM.

Si la VPBX no esta configurada (falta `VPBX_API_KEY`), la pagina muestra un mensaje informativo con instrucciones.

### 5.6 WebSocket App (Para Futuro Bot de Voz IA)

VPBX soporta WebSocket para streaming de audio bidireccional:

- **Connect:** info de llamada (callId, callerNumber, audioType PCMU/PCMA)
- **Audio:** chunks de 20ms en base64 (VPBX → App y App → VPBX)
- **DTMF:** dígitos pulsados por el llamante
- **Command:** HANGUP, BREAK (cortar buffer), TRANSFER (transferir a extensión/cola)

---

## 6. Integración WhatsApp (Meta Cloud API) — Detalle Completo

### 6.1 Visión General

WhatsApp Business API permite:

- Enviar mensajes de texto proactivos a clientes
- Usar plantillas pre-aprobadas por Meta (para primer contacto)
- Recibir mensajes entrantes y responder
- Integrar chat en el Power Dialer para comunicación en contexto

### 6.2 Arquitectura de Integración

```
┌────────────────────────────────────────────────────────────────┐
│                     WHATSAPP CLOUD API                         │
│                                                                │
│  Meta Business Account                                         │
│      │                                                         │
│      ├── Número de teléfono verificado                         │
│      ├── Webhook configurado → {URL_CRM}/api/webhooks/whatsapp │
│      └── Token de acceso permanente                            │
└────────────────────────┬───────────────────────────────────────┘
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
     ┌──────────┐ ┌──────────┐ ┌──────────┐
     │ Mensajes │ │ Mensajes │ │ Webhooks │
     │ Salientes│ │ Entrantes│ │ Entrantes│
     └────┬─────┘ └────┬─────┘ └────┬─────┘
          │            │            │
          ▼            ▼            ▼
     ┌─────────────────────────────────────────────────────────┐
     │                  NEXT.JS API                            │
     │                                                         │
     │  POST /api/whatsapp/send        → enviar mensaje        │
     │  GET  /api/whatsapp/plantillas  → listar plantillas     │
     │  POST /api/whatsapp/plantillas  → crear plantilla       │
     │  POST /api/webhooks/whatsapp    → recibir mensaje       │
     └─────────────────────────────────────────────────────────┘
```

### 6.3 Librería de WhatsApp (`src/lib/whatsapp.ts`)

```typescript
// Funciones implementadas:
sendText(to: string, text: string): Promise<void>
sendTemplate(to: string, templateName: string, params: string[]): Promise<void>
parseIncoming(payload: any): { from, text, timestamp }
verifyWebhook(mode: string, token: string, challenge: string): string | null
```

### 6.4 Flujo de Mensajes Salientes

```
Power Dialer → Botón WhatsApp
     │
     ▼
Seleccionar plantilla (solo plantillas, sin texto libre)
     │
     ▼
POST /api/whatsapp/send {to: "34600111222", template: "bienvenida", params: [...]}
     │
     ▼
Meta Cloud API → entrega al cliente
     │
     ▼
Guardar en whatsapp_mensajes (direccion: "saliente")
```

### 6.5 Flujo de Mensajes Entrantes

```
Cliente envía WhatsApp al número de la empresa
     │
     ▼
Meta → Webhook POST /api/webhooks/whatsapp
     │
     ▼
parseIncoming() → extraer from, text, timestamp
     │
     ▼
Buscar cliente por teléfono en CRM
     │
     ▼
Guardar en whatsapp_mensajes (direccion: "entrante")
     │
     ▼
Notificar al asesor asignado (futuro: SSE/notificación)
```

### 6.6 Plantillas de WhatsApp

El sistema soporta plantillas configurables por proyecto:

| Plantilla   | Propósito                           | Variables                 |
| ----------- | ----------------------------------- | ------------------------- |
| Bienvenida  | Primer contacto post-venta          | {{nombre}}, {{asesor}}    |
| Info Renove | Notificar oportunidad de renovación | {{nombre}}, {{producto}}  |
| Seguimiento | Recordatorio post-llamada           | {{nombre}}, {{fecha}}     |
| Oferta      | Promoción especial                  | {{nombre}}, {{descuento}} |

**Restricción:** Solo se pueden enviar plantillas (no texto libre) para cumplir con políticas de Meta y evitar spam.

### 6.7 Opt-In RGPD

Antes de enviar WhatsApp, el sistema verifica:

- `clientes.whatsapp_opt_in = true`
- `clientes.whatsapp_numero` no es null
- `clientes.whatsapp_opt_in_fecha` registrada

El opt-in se gestiona desde la ficha del cliente y se registra en historial.

### 6.8 Integración con Renove Automático

```
Bot detecta Renove en línea
     │
     ▼
Backend verifica opt-in del cliente
     │
     ▼
Si opt-in = true → enviar plantilla "Info Renove"
     │
     ▼
Registrar envío en historial
```

---

## 7. API REST — Catálogo Completo (57 Endpoints)

### 7.1 Clientes

| Método | Ruta                       | Auth     | Body/Params                                        | Respuesta                               |
| ------ | -------------------------- | -------- | -------------------------------------------------- | --------------------------------------- |
| GET    | `/api/clientes`            | Session  | `?proyecto_id=1`                                   | Array de 500 clientes con datos del bot |
| GET    | `/api/clientes/[id]`       | Session  | Path: id_cliente                                   | Cliente + detecciones + proyectos       |
| PATCH  | `/api/clientes/[id]`       | Session  | `{tipo_persona, whatsapp_numero, whatsapp_opt_in}` | `{success: true}`                       |
| POST   | `/api/clientes/reanalizar` | jefe/sup | `{id_cliente, proyecto_id}`                        | Re-analiza con el bot                   |

### 7.2 Pipeline

| Método | Ruta                          | Auth         | Descripción                                                                            |
| ------ | ----------------------------- | ------------ | -------------------------------------------------------------------------------------- |
| GET    | `/api/pipeline`               | jefe/sup/dev | Leads sin asignar con filtros (cima, renove, fecha)                                    |
| POST   | `/api/pipeline`               | jefe/sup/dev | Asignar leads. Body: `{leads:[], asesores:[]}` → round-robin                           |
| PATCH  | `/api/pipeline`               | Ownership    | Actualizar estado. Body: `{id, estado, notas}`                                         |
| DELETE | `/api/pipeline`               | Session      | Liberar lead. Body: `{id_cliente}`                                                     |
| GET    | `/api/pipeline/mine`          | Session      | Mis leads asignados. `?user_id=X` solo sup/jefe                                        |
| POST   | `/api/pipeline/intento`       | Ownership    | Registrar intento. Body: `{id_cliente, numero, resultado}`                             |
| POST   | `/api/pipeline/tipificar`     | Ownership    | Tipificar post-llamada. Body: `{id, estado, sub_estado, callback_at, fin_permanencia}` |
| GET    | `/api/pipeline/notifications` | Session      | Contadores. `?user_id=X&rol=asesor` → `{sinAsignar, totalPendientes, ...}`             |
| GET    | `/api/pipeline/agenda`        | Session      | Agenda de llamadas programadas                                                         |
| GET    | `/api/pipeline/liberados`     | Session      | Leads liberados por inactividad                                                        |
| POST   | `/api/pipeline/release-stale` | Internal     | CRON: liberar y cerrar leads. Body: `{dias: 3}`                                        |
| GET    | `/api/pipeline/estadisticas`  | Session      | KPIs: contactabilidad, conversión, tiempos                                             |

### 7.3 VPBX

| Método | Ruta                          | Auth            | Descripción                                          |
| ------ | ----------------------------- | --------------- | ---------------------------------------------------- |
| POST   | `/api/vpbx/originate`         | Session         | Click2Call. Body: `{from, to, dni}`. Rate limit 3s   |
| GET    | `/api/vpbx/agents`            | Session         | Estados en vivo de agentes VPBX                      |
| GET    | `/api/vpbx/extensions`        | sup/jefe/dev/it | Extensiones VPBX + usuarios asignados del CRM        |
| POST   | `/api/vpbx/cdr/[callId]/vars` | Session         | Escribir var1-var5 en CDR. Body: `{var1, var2, ...}` |
| POST   | `/api/webhooks/vpbx`          | Público         | Webhook de eventos (RINGING, ANSWERED, HANGUP)       |

### 7.4 Bot (Interno)

| Método | Ruta                    | Auth            | Descripción                                                 |
| ------ | ----------------------- | --------------- | ----------------------------------------------------------- |
| GET    | `/api/bot/next-dni`     | x-bot-api-key   | Siguiente DNI pendiente con FOR UPDATE SKIP LOCKED          |
| POST   | `/api/bot/touch`        | x-bot-api-key   | Mantener vivo DNI en progreso. Body: `{id_cliente}`         |
| POST   | `/api/bot/reset-stale`  | x-bot-api-key   | Rescatar DNIs atascados. Body: `{minutos: 30}`              |
| GET    | `/api/bot/command`      | x-bot-api-key   | Coordinator consulta comandos pendientes                    |
| POST   | `/api/bot/command`      | jefe/it/dev/sup | Frontend envía comando. Body: `{comando, workers, maquina}` |
| GET    | `/api/bot/credenciales` | x-bot-api-key   | Pool de credenciales activas para workers                   |

### 7.5 WhatsApp

| Método | Ruta                       | Auth         | Descripción                                             |
| ------ | -------------------------- | ------------ | ------------------------------------------------------- |
| POST   | `/api/whatsapp/send`       | Session      | Enviar mensaje. Body: `{to, template, params}`          |
| GET    | `/api/whatsapp/plantillas` | Session      | Listar plantillas del proyecto                          |
| POST   | `/api/whatsapp/plantillas` | sup/jefe/dev | Crear plantilla. Body: `{nombre, contenido, variables}` |
| POST   | `/api/webhooks/whatsapp`   | Público      | Webhook entrante de Meta                                |

### 7.6 Dashboard y Admin

| Método | Ruta                                    | Auth        | Descripción                                                                         |
| ------ | --------------------------------------- | ----------- | ----------------------------------------------------------------------------------- |
| GET    | `/api/dashboard/proyecto`               | Session     | Métricas: ventas, contactados, conversion                                           |
| GET    | `/api/dashboard/salud-base`             | Session     | Ratio de calidad: total, limpios, porcentaje                                        |
| GET    | `/api/dashboard/rendimiento`            | Session     | KPIs unificados: ranking, cinturones, tendencias, heatmap, ocupación                |
| GET    | `/api/dashboard/scoring`                | Session     | Scoring Orange: distribución A+ a E + leads                                         |
| POST   | `/api/dashboard/scoring`                | jefe/dev    | Recalcular scoring Orange masivo                                                    |
| GET    | `/api/dashboard/scoring-contactabilidad`| Session     | Scoring Yone: historial de contacto + compras                                       |
| POST   | `/api/dashboard/scoring-contactabilidad`| jefe/dev    | Recalcular scoring contacto masivo                                                  |
| GET    | `/api/dashboard/forecast`               | Session     | Forecast pipeline: leads x contactab x efectiv, 7d, intervalos                      |
| GET    | `/api/dashboard/cinturones`             | Session     | Cinturones 4 niveles (Blanco/Azul/Marrón/Faixa Preta) + historial                   |
| POST   | `/api/dashboard/cinturones`             | jefe/dev    | Otorgar cinturones del mes y notificar                                              |
| GET    | `/api/dashboard/notificaciones`         | Session     | Notificaciones supervisor (7 tipos con umbrales Yone)                               |
| POST   | `/api/dashboard/notificaciones`         | Internal    | Generar notificaciones (caida_conversion >20%, caida_contactabilidad >15%)          |
| PATCH  | `/api/dashboard/notificaciones`         | Session     | Marcar como leída                                                                   |
| GET    | `/api/dashboard/reportes`               | Session     | Reporte HTML imprimible. 4 tipos: completo, rendimiento, ventas, scoring            |
| GET    | `/api/dashboard/abandono`               | Session     | Métricas abandono: Robinson, no contesta, no interesa, fallecidos                   |
| GET    | `/api/dashboard/reutilizacion`          | Session     | Tasa reutilización: cada cuánto se reanalizan los registros                         |
| GET    | `/api/admin/stats`                      | it/dev/jefe | Métricas del sistema                                                                |
| GET    | `/api/admin/credenciales`               | jefe/dev    | Listar credenciales Pangea                                                          |
| POST   | `/api/admin/credenciales`               | jefe/dev    | Agregar credencial                                                                  |
| PATCH  | `/api/admin/credenciales/[id]`          | jefe/dev    | Editar credencial                                                                   |
| DELETE | `/api/admin/credenciales/[id]`          | jefe/dev    | Eliminar credencial                                                                 |

### 7.7 Calidad, Compras y Reportes

| Método | Ruta                            | Auth          | Descripción                                                                                         |
| ------ | ------------------------------- | ------------- | --------------------------------------------------------------------------------------------------- |
| GET    | `/api/tipificaciones-config`    | Session       | Listar codificaciones. `?tipo=sub_estado&proyecto_id=1`                                             |
| POST   | `/api/tipificaciones-config`    | sup/jefe/dev  | Crear codificación. Body: `{tipo, codigo, etiqueta, color, afecta_calidad}`                         |
| PATCH  | `/api/tipificaciones-config`    | sup/jefe/dev  | Editar/activar. Body: `{id, activo, etiqueta, color}`                                               |
| GET    | `/api/listas-negras`            | sup/jefe/dev  | Listar con filtros. `?motivo=robinson&proyecto_id=1`                                                |
| GET    | `/api/listas-negras?format=csv` | sup/jefe/dev  | Descargar CSV                                                                                       |
| GET    | `/api/qa`                       | auditor/+/dev | Listar evaluaciones. `?asesor_id=X&limit=50`                                                        |
| POST   | `/api/qa`                       | auditor/dev   | Crear evaluación. Body: `{pipeline_id, asesor_id, speech, objeciones, cierre, compliance, empatia}` |
| GET    | `/api/auditoria`                | sup/jefe/dev  | Timeline de actividad. `?fecha=2026-06-01&tipo=llamada`                                             |
| GET    | `/api/compras`                  | Session       | Listar compras. `?proyecto_id=1&desde=...&hasta=...&asesor_id=X`                                    |
| POST   | `/api/compras`                  | Session       | Registrar compra. Body: `{id_cliente, proyecto_id, tipo_producto, importe, asesor_id}`              |
| DELETE | `/api/compras`                  | jefe/dev      | Eliminar compra. `?id=X`                                                                           |

### 7.8 Usuarios y Perfil

| Método | Ruta                   | Auth     | Descripción                                                   |
| ------ | ---------------------- | -------- | ------------------------------------------------------------- |
| GET    | `/api/usuarios`        | Session  | Listar usuarios. `?rol=asesor&equipo=Peru`                    |
| POST   | `/api/usuarios`        | jefe/dev | Crear usuario. Body: `{email, nombre, password, rol, equipo}` |
| PATCH  | `/api/usuarios`        | jefe/dev | Editar usuario. Body: `{id, nombre, rol, equipo, activo}`     |
| POST   | `/api/perfil/password` | Session  | Cambiar contraseña. Body: `{current, new}`                    |

### 7.9 Documentos

| Método | Ruta                     | Auth     | Descripción                            |
| ------ | ------------------------ | -------- | -------------------------------------- |
| GET    | `/api/documentos/cola`   | Session  | DNIs en cola de procesamiento          |
| POST   | `/api/documentos/upload` | jefe/dev | Subir archivo con DNIs. Multipart form |

---

## 8. Seguridad

### 8.1 Autenticación

- NextAuth.js v5 con Credentials Provider
- Contraseñas hasheadas con bcrypt (10 rondas)
- Sesiones JWT stateless firmadas con NEXTAUTH_SECRET
- Expiración: 8 horas
- Validación de complejidad: 8+ caracteres, 1 mayúscula, 1 número

### 8.2 Autorización (RBAC)

- Middleware intercepta todas las rutas y verifica rol contra mapa de permisos
- `requireRole(...roles)` en endpoints sensibles → lanza 401/403
- `requirePipelineOwnership(id)` → asesor solo modifica sus leads
- `requireAuth()` → verifica sesión sin validar rol específico
- Endpoints del bot protegidos por header `x-bot-api-key`

### 8.3 Matriz de Permisos por Endpoint

| Endpoint                     | asesor | supervisor | jefe_area | back_office | auditor | it  | dev |
| ---------------------------- | ------ | ---------- | --------- | ----------- | ------- | --- | --- |
| GET /api/clientes            | ❌     | ✅         | ✅        | ❌          | ❌      | ✅  | ✅  |
| POST /api/pipeline (asignar) | ❌     | ✅         | ✅        | ❌          | ❌      | ❌  | ✅  |
| POST /api/pipeline/tipificar | ✅\*   | ✅         | ✅        | ❌          | ❌      | ❌  | ✅  |
| POST /api/bot/command        | ❌     | ✅         | ✅        | ❌          | ❌      | ✅  | ✅  |
| GET /api/admin/stats         | ❌     | ❌         | ✅        | ❌          | ❌      | ✅  | ✅  |
| POST /api/usuarios           | ❌     | ❌         | ✅        | ❌          | ❌      | ❌  | ✅  |
| GET /api/qa                  | ❌     | ✅         | ✅        | ❌          | ✅      | ✅  | ✅  |
| POST /api/qa                 | ❌     | ❌         | ❌        | ❌          | ✅      | ❌  | ✅  |

\*Solo sus propios leads (requirePipelineOwnership)

### 8.4 Protecciones

- **SQL injection:** 100% queries parametrizadas ($1, $2) — ningún endpoint usa string interpolation
- **Race conditions:** bot-sync envuelto en transacción con `SELECT ... FOR UPDATE` (evita que dos workers pisen el mismo cliente)
- **Endpoints del bot:** `/api/bot/*` protegidos con header `x-bot-api-key` + verificación en ruta

- **compras, maquinas, proyectos:** endpoints de escritura protegidos con 
equireRole() (antes p�blicos)
- **compras:** soft-delete (deleted_at) en vez de DELETE f�sico
- **release-stale:** batch UPDATE con ANY(::int[]) en vez de loop de queries individuales
- **coordinator:** workers con l�mite de 5 reinicios por hora (evita loops infinitos)
- **proyecto_id din�mico:** bot endpoints usan (SELECT id FROM proyectos WHERE nombre = 'orange') en vez de = 1 hardcodeado
- CSRF: NextAuth maneja automáticamente
- Rate limiting VPBX: 3s entre llamadas por extensión
- Webhooks: siempre 200 para evitar reintentos (VPBX y WhatsApp)
- RGPD: soft-delete + anonimización

---

## 9. Métricas del Proyecto

| Indicador            | Valor |
| -------------------- | ----- |
| Rutas Next.js        | 81    |
| Endpoints API        | 59    |
| Páginas frontend     | 21    |
| Tablas PostgreSQL    | 30    |
| Funciones PostgreSQL | 11    |
| Vistas               | 2     |
| Triggers             | 4     |
| Índices              | 20    |
| Migraciones          | 20    |
| Roles de usuario     | 7     |
| Proxies configurados | 20    |

### Historial de Versiones

| Versión | Fecha      | Cambios principales |
| ------- | ---------- | ------------------- |
| v1.0    | 2026-05-22 | Fundación: BD, auth, bot básico |
| v2.0    | 2026-06-02 | Reestructuración submaster, VPBX, WhatsApp |
| v3.0    | 2026-06-03 | Cableado bot-coordinator, clientes, rescate DNIs |
| v4.0    | 2026-06-04 | Dashboards, auditoría, QA, Wikiratioo, dark mode |
| v5.0    | 2026-06-06 | Inteligencia comercial: scoring, forecast pipeline, cinturones, métricas, reportes |
| v5.1    | 2026-06-06 | Scoring contactabilidad (Yone), cinturones 4 niveles, abandono/reutilización, umbrales notificación |
| v5.2    | 2026-06-10 | Pagina VPBX: gestion de extensiones + agentes. API extensions. Campo extension_vpbx en PATCH usuarios. Sidebar + middleware VPBX |
| v5.3    | 2026-06-10 | Redis (rate limiting, webhook queue, cache). Sistema de pausas (BD + Power Dialer + LivePanel). Paginacion unificada. Sidebar v2 (acordeon, badges, jerarquia). Multi-proyecto: config dinamica, campos de lead por proyecto, logo, CRUD proyectos. Asignar Leads v3 (chips por jerarquia). Proyectos hardcodeados eliminados. Pipeline multi-proyecto |
