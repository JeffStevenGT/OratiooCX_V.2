# Oratioo CX — Esquema del Backend

> **Versión:** 5.3 | **Fecha:** 12 Junio 2026
> **Stack Backend:** Next.js 15 API Routes + PostgreSQL 16 + Python 3.13 Bot

---

## 1. Arquitectura Backend

### 1.1 Capas del Backend

```
┌─────────────────────────────────────────────────────────────────┐
│                    CAPA 1: API GATEWAY                           │
│  Next.js API Routes (59 endpoints)                              │
│  ├── Autenticación: NextAuth.js v5 + JWT                        │
│  ├── Autorización: Middleware RBAC + requireRole()               │
│  └── Rate Limiting: Redis (o memoria)                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                    CAPA 2: LÓGICA DE NEGOCIO                     │
│  src/lib/                                                       │
│  ├── db.ts              → Pool PostgreSQL + transacciones       │
│  ├── auth.ts            → Config NextAuth                       │
│  ├── auth-roles.ts      → RBAC + ownership                      │
│  ├── vpbx.ts            → Cliente VPBX (14 funciones)           │
│  ├── whatsapp.ts        → Cliente Meta Cloud API                │
│  ├── redis.ts           → Rate limit, queue, cache              │
│  └── project-context.tsx → Contexto multi-proyecto              │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                    CAPA 3: BASE DE DATOS                         │
│  PostgreSQL 16                                                   │
│  ├── 30 tablas                                                  │
│  ├── 11 funciones PL/pgSQL                                      │
│  ├── 4 triggers                                                 │
│  ├── 2 vistas                                                   │
│  └── 20+ índices                                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                    CAPA 4: SERVICIOS EXTERNOS                    │
│  ├── VPBX (Siptize) — VoIP, Click2Call, CDR, grabaciones       │
│  ├── Meta Cloud API — WhatsApp Business                         │
│  ├── Redis (Upstash) — Cache, colas, rate limiting              │
│  └── Bot Python (PC local) — Extracción de datos               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Base de Datos — Esquema Completo

### 2.1 Diagrama Entidad-Relación (Simplificado)

```
┌──────────┐       ┌─────────────────────┐       ┌──────────┐
│ PROYECTOS│──1:N──│ CLIENTES_PROYECTOS   │──N:1──│ CLIENTES │
│          │       │ (datos JSONB)        │       │          │
└──────────┘       └──────────┬──────────┘       └──────────┘
                              │
                    ┌─────────┼─────────┐
                    │         │         │
                    ▼         ▼         ▼
              ┌─────────┐ ┌────────┐ ┌──────────┐
              │PIPELINE │ │HISTORIAL│ │DETECCIONES│
              └────┬────┘ └────────┘ └──────────┘
                   │
         ┌─────────┼──────────┐
         ▼         ▼          ▼
    ┌────────┐ ┌────────┐ ┌──────────┐
    │ CDR    │ │PAUSAS  │ │COMPRAS   │
    │ VPBX   │ │        │ │          │
    └────────┘ └────────┘ └──────────┘

┌──────────┐
│ USUARIOS │──1:N── PIPELINE, QA, PAUSAS, COMPRAS, CDR
└──────────┘

┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│ SCORING     │     │ SCORING      │     │ METRICAS         │
│ LEADS       │     │ CONTACTO     │     │ DIARIAS          │
└─────────────┘     └──────────────┘     └──────────────────┘
```

### 2.2 Todas las Tablas (30)

```sql
-- ============================================================
-- CORE: Clientes y Proyectos (3)
-- ============================================================

CREATE TABLE clientes (/* entidad única por DNI */);
CREATE TABLE proyectos (/* multi-proyecto con config JSONB */);
CREATE TABLE clientes_proyectos (/* datos por cliente+proyecto */);

-- ============================================================
-- COMERCIAL: Pipeline y Ventas (3)
-- ============================================================

CREATE TABLE pipeline (/* estado comercial, asignación, rondas */);
CREATE TABLE historial (/* timeline de eventos */);
CREATE TABLE compras (/* ventas registradas */);

-- ============================================================
-- BOT: Extracción y Control (3)
-- ============================================================

CREATE TABLE maquinas (/* workers distribuidos + heartbeat */);
CREATE TABLE comandos_bot (/* cola comandos frontend→coordinator */);
CREATE TABLE credenciales_bot (/* credenciales Pangea */);

-- ============================================================
-- TELEFONÍA: VPBX (1)
-- ============================================================

CREATE TABLE cdr_vpbx (/* registro de llamadas */);

-- ============================================================
-- MENSAJERÍA: WhatsApp (2)
-- ============================================================

CREATE TABLE whatsapp_mensajes (/* historial entrante/saliente */);
CREATE TABLE whatsapp_plantillas (/* plantillas por proyecto */);

-- ============================================================
-- CALIDAD: QA y Tipificación (3)
-- ============================================================

CREATE TABLE tipificaciones_config (/* estados/sub-estados dinámicos */);
CREATE TABLE listas_negras (/* teléfonos bloqueados */);
CREATE TABLE qa_evaluaciones (/* rúbrica 5 criterios */);

-- ============================================================
-- INTELIGENCIA: Scoring y Forecast (6)
-- ============================================================

CREATE TABLE scoring_leads (/* scoring Orange A+ a E */);
CREATE TABLE scoring_contactabilidad (/* scoring Yone */);
CREATE TABLE metricas_diarias (/* snapshot diario por asesor */);
CREATE TABLE cinturones (/* niveles gamificación */);
CREATE TABLE logros_cinturon (/* historial cinturones */);
CREATE TABLE notificaciones_supervisor (/* alertas automáticas */);

-- ============================================================
-- ADMIN: Sistema (6)
-- ============================================================

CREATE TABLE usuarios (/* auth + roles + extension_vpbx */);
CREATE TABLE configuracion (/* clave-valor dinámico */);
CREATE TABLE detecciones (/* cambios entre extracciones */);
CREATE TABLE analisis_perdidos (/* leads cerrados sin venta */);
CREATE TABLE pausas (/* tracking de pausas */);
CREATE TABLE fichajes (/* fichaje electrónico — España RD-ley 8/2019 */);
```

### 2.3 Esquema SQL Detallado

#### Tablas Core

```sql
-- PROYECTOS — Configuración multi-proyecto
CREATE TABLE proyectos (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    -- config incluye: logo_url, campos_lead[], metas{diaria,semanal,mensual},
    --                 cooldown_minutos, max_rondas, dias_liberacion
    created_at TIMESTAMPTZ DEFAULT now()
);

-- CLIENTES — Entidad única por documento
CREATE TABLE clientes (
    id_cliente TEXT PRIMARY KEY,          -- "DNI_75238036E"
    tipo_documento TEXT NOT NULL,         -- DNI, NIE, NIF
    numero_documento TEXT NOT NULL,       -- 75238036E
    nombre_razon_social TEXT,
    tipo_persona TEXT DEFAULT 'natural',  -- natural, autonomo, empresa
    cnae TEXT,
    telefonos JSONB,                      -- Legacy array ["+34622..."]
    telefonos_v2 JSONB DEFAULT '[]',      -- [{"num","tipo","origen"}]
    emails TEXT[],
    direccion JSONB,                      -- {calle, ciudad, cp, provincia}
    whatsapp_opt_in BOOLEAN DEFAULT false,
    whatsapp_numero TEXT,
    whatsapp_opt_in_fecha TIMESTAMPTZ,
    alertas_fidelizacion BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_clientes_documento ON clientes(numero_documento);
CREATE INDEX idx_clientes_deleted ON clientes(deleted_at) WHERE deleted_at IS NULL;

-- CLIENTES_PROYECTOS — Datos por cliente+proyecto (UPSERT)
CREATE TABLE clientes_proyectos (
    id BIGSERIAL PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente),
    proyecto_id BIGINT NOT NULL REFERENCES proyectos(id),
    datos JSONB NOT NULL DEFAULT '{}',
    -- datos contiene: estado, version_extraccion, header{...}, lineas[...]
    ultima_extraccion TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(id_cliente, proyecto_id)
);

CREATE INDEX idx_cp_proyecto_estado ON clientes_proyectos(proyecto_id, (datos->>'estado'));
CREATE INDEX idx_cp_extraccion ON clientes_proyectos(proyecto_id, ultima_extraccion);
```

#### Tablas Comerciales

```sql
-- PIPELINE — Estado comercial del lead
CREATE TABLE pipeline (
    id BIGSERIAL PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente),
    proyecto_id BIGINT NOT NULL REFERENCES proyectos(id) DEFAULT 1,
    asesor_id BIGINT NOT NULL REFERENCES usuarios(id),
    estado TEXT NOT NULL DEFAULT 'pendiente',
    -- estados: pendiente, contactado, interesado, negociacion, venta,
    --          no_interesa, no_contesta, activado
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
CREATE INDEX idx_pipeline_callback ON pipeline(callback_at) WHERE callback_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_pipeline_cliente ON pipeline(id_cliente, deleted_at);
CREATE UNIQUE INDEX idx_pipeline_unique_active ON pipeline(id_cliente, proyecto_id, asesor_id) WHERE deleted_at IS NULL;

-- HISTORIAL — Timeline de eventos
CREATE TABLE historial (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    -- tipos: extraccion, asignacion, liberacion, tipificacion, llamada,
    --        tramitacion, deteccion, whatsapp_enviado, whatsapp_recibido
    proyecto_id BIGINT REFERENCES proyectos(id),
    asesor_id BIGINT REFERENCES usuarios(id),
    descripcion TEXT,
    datos JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_historial_cliente_tipo ON historial(id_cliente, tipo, created_at DESC);
CREATE INDEX idx_historial_proyecto ON historial(proyecto_id, created_at DESC);

-- COMPRAS — Ventas registradas
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
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_compras_proyecto ON compras(proyecto_id, deleted_at);
CREATE INDEX idx_compras_asesor ON compras(asesor_id, deleted_at);
```

#### Tablas del Bot

```sql
-- MAQUINAS — Workers distribuidos
CREATE TABLE maquinas (
    id SERIAL PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL,
    ip TEXT,
    workers_max INT DEFAULT 20,
    workers_activos INT DEFAULT 0,
    workers_info JSONB DEFAULT '[]',
    estado TEXT DEFAULT 'offline',
    -- estado: online, offline
    ultimo_heartbeat TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- COMANDOS_BOT — Cola comandos frontend→coordinator
CREATE TABLE comandos_bot (
    id SERIAL PRIMARY KEY,
    maquina_destino TEXT NOT NULL,
    comando TEXT NOT NULL,
    -- comandos: iniciar, detener, pausar
    parametros JSONB DEFAULT '{}',
    -- parametros: {workers: 5}
    estado TEXT DEFAULT 'pendiente',
    -- estado: pendiente, ejecutado, error
    ejecutado_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_comandos_pendientes ON comandos_bot(maquina_destino, estado) WHERE estado = 'pendiente';

-- CREDENCIALES_BOT — Pool credenciales Pangea
CREATE TABLE credenciales_bot (
    id SERIAL PRIMARY KEY,
    usuario TEXT NOT NULL,
    password TEXT NOT NULL,
    activo BOOLEAN DEFAULT true,
    ultimo_error TEXT,
    ultimo_uso TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Tablas VPBX, WhatsApp, Calidad

```sql
-- CDR_VPBX — Registro de llamadas
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

CREATE INDEX idx_cdr_cliente ON cdr_vpbx(id_cliente);
CREATE INDEX idx_cdr_asesor ON cdr_vpbx(asesor_id, created DESC);

-- WHATSAPP_MENSAJES — Historial
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

-- WHATSAPP_PLANTILLAS — Configurables por proyecto
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

-- TIPIFICACIONES_CONFIG — Estados y sub-estados dinámicos
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

-- LISTAS_NEGRAS — Teléfonos bloqueados
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

-- QA_EVALUACIONES — Rúbrica 5 criterios
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
    puntaje_total INT GENERATED ALWAYS AS (
        speech + objeciones + cierre + compliance + empatia
    ) STORED,
    comentarios TEXT,
    evaluado_at TIMESTAMPTZ DEFAULT now()
);
```

#### Tablas de Inteligencia

```sql
-- SCORING_LEADS — Scoring Orange (datos del bot)
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

-- SCORING_CONTACTABILIDAD — Scoring Yone (historial)
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

-- METRICAS_DIARIAS — Snapshot diario
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

-- CINTURONES — Niveles gamificación
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

-- LOGROS_CINTURON — Historial por asesor/mes
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

-- NOTIFICACIONES_SUPERVISOR — Alertas automáticas
CREATE TABLE notificaciones_supervisor (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    supervisor_id BIGINT NOT NULL REFERENCES usuarios(id),
    asesor_id BIGINT REFERENCES usuarios(id),
    tipo TEXT NOT NULL CHECK (tipo IN (
        'bajo_rendimiento','sin_actividad','excede_no_interesa',
        'sin_ventas','recuperacion','cinturon_obtenido','caida_rendimiento'
    )),
    titulo TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    datos JSONB DEFAULT '{}',
    leida BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Tablas Admin

```sql
-- USUARIOS — Auth + roles
CREATE TABLE usuarios (
    id BIGSERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'asesor',
    -- roles: asesor, supervisor, jefe_area, back_office, auditor_calidad, it, desarrollador
    equipo TEXT,
    activo BOOLEAN DEFAULT true,
    supervisor_id BIGINT REFERENCES usuarios(id),
    extension_vpbx TEXT,
    ultima_conexion TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- CONFIGURACION — Clave-valor dinámico
CREATE TABLE configuracion (
    id SERIAL PRIMARY KEY,
    proyecto_id BIGINT REFERENCES proyectos(id) DEFAULT 1,
    clave TEXT NOT NULL,
    valor JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(proyecto_id, clave)
);

-- DETECCIONES — Cambios entre extracciones
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

-- ANALISIS_PERDIDOS — Leads cerrados sin venta
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

-- PAUSAS — Tracking de pausas
CREATE TABLE pausas (
    id BIGSERIAL PRIMARY KEY,
    asesor_id BIGINT NOT NULL REFERENCES usuarios(id),
    proyecto_id BIGINT REFERENCES proyectos(id) DEFAULT 1,
    tipo TEXT NOT NULL,
    -- tipos: baño, almuerzo, descanso, reunión, capacitación, otro
    inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
    fin TIMESTAMPTZ,
    duracion_seg INT,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pausas_asesor ON pausas(asesor_id, inicio DESC);
CREATE INDEX idx_pausas_activas ON pausas(asesor_id) WHERE fin IS NULL;
```

### 2.4 Funciones PL/pgSQL (11 funciones)

```sql
-- 1. Toma atómica de DNI (evita duplicados entre workers)
CREATE OR REPLACE FUNCTION tomar_siguiente_dni(p_proyecto_id BIGINT)
RETURNS TABLE (id_cp BIGINT, id_cliente_out TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT cp.id, cp.id_cliente
  FROM clientes_proyectos cp
  WHERE cp.proyecto_id = p_proyecto_id
    AND cp.datos->>'estado' = 'pendiente'
    AND NOT EXISTS (
      SELECT 1 FROM pipeline p
      WHERE p.id_cliente = cp.id_cliente
        AND p.deleted_at IS NULL
    )
  ORDER BY cp.created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql;

-- 2. Salud de base (ratio registros limpios)
CREATE OR REPLACE FUNCTION salud_base(p_proyecto_id BIGINT)
RETURNS JSONB AS $$
DECLARE
  total BIGINT;
  limpios BIGINT;
BEGIN
  SELECT COUNT(*) INTO total FROM clientes_proyectos WHERE proyecto_id = p_proyecto_id;
  SELECT COUNT(*) INTO limpios FROM clientes_proyectos
  WHERE proyecto_id = p_proyecto_id AND datos->>'estado' = 'completado';
  RETURN jsonb_build_object(
    'total', total,
    'limpios', limpios,
    'porcentaje', ROUND((limpios::NUMERIC / NULLIF(total,0) * 100)::NUMERIC, 1)
  );
END;
$$ LANGUAGE plpgsql;

-- 3. Calcular scoring lead (14 factores Orange)
CREATE OR REPLACE FUNCTION calcular_scoring_lead(p_id_cliente TEXT, p_proyecto_id BIGINT)
RETURNS TABLE (nivel TEXT, puntuacion INT, ...) AS $$ ... $$ LANGUAGE plpgsql;

-- 4. Scoring masivo
CREATE OR REPLACE FUNCTION calcular_scoring_masivo(p_proyecto_id BIGINT)
RETURNS TABLE (nivel TEXT, total BIGINT) AS $$ ... $$ LANGUAGE plpgsql;

-- 5. Scoring contacto masivo (Yone)
CREATE OR REPLACE FUNCTION calcular_scoring_contacto_masivo(p_proyecto_id BIGINT)
RETURNS TABLE (nivel TEXT, total BIGINT) AS $$ ... $$ LANGUAGE plpgsql;

-- 6. Forecast ventas
CREATE OR REPLACE FUNCTION forecast_ventas(
  p_proyecto_id BIGINT, p_dias_historial INT DEFAULT 30, p_dias_forecast INT DEFAULT 7
) RETURNS TABLE (
  fecha DATE, tipo TEXT, ventas INT, intervalo_inf INT, intervalo_sup INT
) AS $$ ... $$ LANGUAGE plpgsql;

-- 7. Cinturón actual
CREATE OR REPLACE FUNCTION cinturon_actual(p_asesor_id BIGINT, p_mes TEXT)
RETURNS TABLE (cinturon_nombre TEXT, ...) AS $$ ... $$ LANGUAGE plpgsql;

-- 8. Generar métricas diarias
CREATE OR REPLACE FUNCTION generar_metricas_diarias(
  p_proyecto_id BIGINT, p_fecha DATE DEFAULT CURRENT_DATE - 1
) RETURNS INT AS $$ ... $$ LANGUAGE plpgsql;

-- 9. Tasa reutilización
CREATE OR REPLACE FUNCTION tasa_reutilizacion(p_proyecto_id BIGINT, p_dias INT DEFAULT 90)
RETURNS TABLE (...) AS $$ ... $$ LANGUAGE plpgsql;

-- 10. Métricas abandono
CREATE OR REPLACE FUNCTION metricas_abandono(p_proyecto_id BIGINT, p_dias INT DEFAULT 90)
RETURNS TABLE (motivo TEXT, total BIGINT) AS $$ ... $$ LANGUAGE plpgsql;

-- 11-13. Helpers telefonos_v2
CREATE OR REPLACE FUNCTION telefonos_agregar(...) RETURNS JSONB AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION telefonos_marcar_contacto(...) RETURNS JSONB AS $$ ... $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION telefonos_nums(...) RETURNS TEXT[] AS $$ ... $$ LANGUAGE plpgsql;
```

### 2.5 Vistas

```sql
-- Pipeline activos (sin soft-delete)
CREATE VIEW pipeline_activos AS
SELECT * FROM pipeline WHERE deleted_at IS NULL;

-- Distribución scoring
CREATE VIEW v_scoring_resumen AS
SELECT proyecto_id, nivel, COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY proyecto_id), 1) as porcentaje
FROM scoring_leads
GROUP BY proyecto_id, nivel;
```

### 2.6 Triggers

```sql
-- 1. Auditoría pipeline: registrar cambios en historial
CREATE OR REPLACE FUNCTION trg_auditoria_pipeline_fn() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO historial (id_cliente, tipo, proyecto_id, asesor_id, descripcion, datos)
  VALUES (NEW.id_cliente, 'pipeline_cambio', NEW.proyecto_id, NEW.asesor_id,
    'Cambio de estado: ' || COALESCE(OLD.estado,'nuevo') || ' → ' || NEW.estado,
    jsonb_build_object('estado_anterior', OLD.estado, 'estado_nuevo', NEW.estado));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auditoria_pipeline
  AFTER INSERT OR UPDATE OF estado ON pipeline
  FOR EACH ROW EXECUTE FUNCTION trg_auditoria_pipeline_fn();

-- 2. Auditoría extracción
CREATE TRIGGER trg_auditoria_extraccion
  AFTER INSERT OR UPDATE ON clientes_proyectos
  FOR EACH ROW EXECUTE FUNCTION trg_extraccion_fn();

-- 3. Auto lista negra
CREATE TRIGGER trg_auto_lista_negra
  AFTER UPDATE OF sub_estado ON pipeline
  FOR EACH ROW WHEN (NEW.sub_estado IS NOT NULL)
  EXECUTE FUNCTION trg_lista_negra_fn();

-- 4. Updated_at automático
CREATE TRIGGER trg_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
```

---

## 3. API REST — Flujo de Datos

### 3.1 Flujo de Asignación de Leads

```
Frontend (Asignar Leads)
    │
    ▼ POST /api/pipeline
    │ Body: { leads: [{id_cliente, proyecto_id}], asesores: [{id, cantidad}] }
    │
    ▼
API recibe, verifica requireRole('jefe_area','supervisor','desarrollador')
    │
    ▼ TRANSACCIÓN SQL
    │ BEGIN
    │   FOR each (lead, asesor) in round-robin:
    │     INSERT INTO pipeline (id_cliente, proyecto_id, asesor_id, estado)
    │     VALUES ($1, $2, $3, 'pendiente')
    │     ON CONFLICT (id_cliente, proyecto_id, asesor_id) WHERE deleted_at IS NULL
    │     DO NOTHING;
    │
    │   INSERT INTO historial (id_cliente, tipo, proyecto_id, asesor_id, descripcion)
    │   VALUES ($1, 'asignacion', $2, $3, 'Asignado al asesor');
    │ COMMIT
    │
    ▼ Response: { asignados: 50, errores: 0 }
```

### 3.2 Flujo de Click2Call

```
Frontend (Power Dialer)
    │
    ▼ POST /api/vpbx/originate
    │ Body: { from: "101", to: "622534699", dni: "75238036E" }
    │
    ▼
API verifica requireAuth() + rate limit (3s Redis / memoria)
    │
    ▼
GET https://vpbx.me/api/originatecall/101/622534699
    │ Headers: X-Api-Key: ${VPBX_API_KEY}
    │
    ▼
VPBX → suena teléfono extensión 101 → asesor descuelga
VPBX → marca 622534699
    │
    ▼ Webhook RINGING
POST /api/webhooks/vpbx { callId, callerNumber, calleeNumber }
    │
    ▼
INSERT INTO cdr_vpbx (call_id, src, dst, created) VALUES (...)
    │
    ▼
Response: { callId: "uuid-xxx", status: "ringing" }
```

### 3.3 Flujo del Bot (Extracción)

```
Bot Python (worker_loop.py)
    │
    ▼ GET /api/bot/next-dni
    │ Headers: x-bot-api-key
    │
    ▼
API → SELECT tomar_siguiente_dni(proyecto_id)
    │ FOR UPDATE SKIP LOCKED → evita duplicados entre workers
    │
    ▼ Response: { id_cliente: "DNI_75238036E" }
    │
    ▼ (Bot extrae datos de Orange Pangea...)
    │
    ▼ POST /api/internal/bot-sync
    │ Headers: x-bot-api-key
    │ Body: { id_cliente, proyecto_id, datos: { header, lineas } }
    │
    ▼ TRANSACCIÓN SQL
    │ BEGIN
    │   -- Obtener datos anteriores para comparar
    │   SELECT datos FROM clientes_proyectos
    │   WHERE id_cliente = $1 AND proyecto_id = $2 FOR UPDATE;
    │
    │   -- Determinar version_extraccion
    │   version = old.datos?.version_extraccion ? old + 1 : 1;
    │
    │   -- UPSERT nuevos datos
    │   INSERT INTO clientes_proyectos (id_cliente, proyecto_id, datos)
    │   VALUES ($1, $2, $3)
    │   ON CONFLICT (id_cliente, proyecto_id) DO UPDATE SET
    │     datos = EXCLUDED.datos,
    │     ultima_extraccion = now(),
    │     updated_at = now();
    │
    │   -- Si version >= 2: detectar cambios
    │   IF version >= 2 THEN
    │     INSERT INTO detecciones (...) SELECT cambios;
    │   END IF;
    │
    │   -- Registrar en historial
    │   INSERT INTO historial (id_cliente, tipo, proyecto_id, descripcion, datos)
    │   VALUES ($1, 'extraccion', $2, 'Extracción v' || version, ...);
    │ COMMIT
    │
    ▼ Response: { ok: true, version: 2, cambios: 3 }
```

---

## 4. Pool de Conexiones (db.ts)

```typescript
// src/lib/db.ts
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                // máximo 20 conexiones concurrentes
  idleTimeoutMillis: 30000, // cerrar tras 30s inactiva
  statement_timeout: 30000, // timeout queries: 30s
});

export default pool;

// Helper para queries tipadas
export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
  return pool.query(text, params);
}

// Helper para transacciones
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
```

---

## 5. Redis — Cache y Colas (redis.ts)

```typescript
// src/lib/redis.ts
import { Redis } from '@upstash/redis';

// Si no hay REDIS_URL, usar fallback en memoria
const useRedis = !!(process.env.REDIS_URL && process.env.REDIS_TOKEN);

const redis = useRedis
  ? new Redis({ url: process.env.REDIS_URL!, token: process.env.REDIS_TOKEN! })
  : null;

// Cache en memoria (fallback)
const memCache = new Map<string, { value: any; expiry: number }>();

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (redis) return redis.get<T>(key);
  const entry = memCache.get(key);
  if (!entry || Date.now() > entry.expiry) { memCache.delete(key); return null; }
  return entry.value as T;
}

export async function cacheSet(key: string, value: any, ttlSeconds: number = 60): Promise<void> {
  if (redis) { await redis.set(key, value, { ex: ttlSeconds }); return; }
  memCache.set(key, { value, expiry: Date.now() + ttlSeconds * 1000 });
}

export async function cacheDel(key: string): Promise<void> {
  if (redis) { await redis.del(key); return; }
  memCache.delete(key);
}

// Rate limiting
export async function rateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
  if (redis) {
    const current = await redis.incr(key);
    if (current === 1) await redis.expire(key, windowSeconds);
    return current <= maxRequests;
  }
  // Fallback en memoria (no persiste entre deploys pero funciona)
  const now = Date.now();
  const entry = memCache.get(key);
  if (!entry || now > entry.expiry) { memCache.set(key, { value: 1, expiry: now + windowSeconds * 1000 }); return true; }
  if (entry.value >= maxRequests) return false;
  entry.value++;
  return true;
}
```

---

## 6. Cliente VPBX (vpbx.ts)

```typescript
// src/lib/vpbx.ts — 14 funciones
const VPBX_URL = process.env.VPBX_API_URL;
const VPBX_KEY = process.env.VPBX_API_KEY;

const headers = { 'X-Api-Key': VPBX_KEY!, 'Content-Type': 'application/json' };

export async function originateCall(from: string, to: string, timeout = 30) {
  // GET /originatecall/{from}/{to}?timeout={timeout}
}

export async function getCDR(callId: string) {
  // GET /cdr/{callId}
}

export async function listCDRs(filters: CDRFilters) {
  // POST /cdr con body de filtros
}

export async function updateCDRVars(callId: string, vars: Record<string, string>) {
  // POST /cdr/{callId}/updatevars
}

export async function getAgents() {
  // GET /agent
}

export async function getExtensions() {
  // GET /extension
}

export async function getExtensionById(id: string) {
  // GET /extension/{id}
}

export async function updateExtension(id: string, data: any) {
  // POST /extension/{id}
}

export async function getRecording(callId: string) {
  // GET /recording/{callId}
}

export async function getAgentStatusHistory(filters: any) {
  // POST /agent/status
}

export async function getQueueWaitTime(queueNumber: string) {
  // GET /queue/{queueNumber}/waittime
}

export async function getQueueState(queueNumber: string) {
  // GET /queue/{queueNumber}/state
}

export async function getTTSVoices() {
  // GET /voiceengine
}

export async function originateExternal(externalNumber: string, internalDest: string) {
  // GET /c2cexternal/{externalNumber}/{internalDest}
}
```

---

## 7. Cliente WhatsApp (whatsapp.ts)

```typescript
// src/lib/whatsapp.ts
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WHATSAPP_API = 'https://graph.facebook.com/v21.0';

export async function sendText(to: string, text: string): Promise<void> {
  // POST /v21.0/{phone_id}/messages
  // Body: { messaging_product: "whatsapp", to, type: "text", text: { body: text } }
}

export async function sendTemplate(to: string, templateName: string, params: string[]): Promise<void> {
  // POST /v21.0/{phone_id}/messages
  // Body: { messaging_product: "whatsapp", to, type: "template",
  //         template: { name: templateName, language: { code: "es" },
  //         components: [{ type: "body", parameters: params.map(p => ({ type: "text", text: p })) }] }}
}

export function parseIncoming(payload: any): { from: string; text: string; timestamp: number } | null {
  // Extraer from, text, timestamp del webhook de Meta
}

export function verifyWebhook(mode: string, token: string, challenge: string): string | null {
  // Verificar webhook de Meta (GET)
}
```

---

## 8. Middleware de Autenticación

```
┌─────────────────────────────────────────────────────────────────┐
│  src/middleware.ts                                               │
│                                                                 │
│  1. ¿Es ruta pública? (/login, /api/auth, /api/webhooks,        │
│     /api/bot, /api/internal, /_next, archivos estáticos)        │
│     → SÍ: next(), continuar                                     │
│                                                                 │
│  2. Verificar token JWT (getToken)                              │
│     → NO: redirect /login?callbackUrl={pathname}                │
│                                                                 │
│  3. Verificar rol contra roleRoutes[pathname]                   │
│     → NO: redirect /inicio                                      │
│                                                                 │
│  4. Continuar                                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Resumen de Endpoints por Dominio

| Dominio | Endpoints | Roles con acceso |
|---------|-----------|------------------|
| Auth | 2 | Público |
| Bot | 6 | x-bot-api-key / jefe,it,dev,sup |
| Clientes | 4 | Session (varía) |
| Pipeline | 12 | varía (ownership, jefe, sup, dev) |
| Pausas | 3 | Session |
| VPBX | 5 | Session / sup,jefe,dev,it |
| WhatsApp | 3 | Session / sup,jefe,dev |
| Webhooks | 2 | Público |
| Dashboard | 9 | Session (varía) |
| Admin | 3 | it,dev,jefe |
| Usuarios/Perfil | 4 | jefe,dev / Session |
| Calidad/QA | 4 | auditor,sup,jefe,dev |
| Proyectos | 2 | jefe,dev |
| Configuración | 2 | it,dev |
| Otros | 5 | varía |

**Total: 62 endpoints**

---

## 10. Cumplimiento Normativo — Fichaje Electrónico

### 10.1 Arquitectura de Fichaje

```sql
CREATE TABLE fichajes (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    metodo TEXT DEFAULT 'manual',
    ip TEXT,
    notas TEXT,
    modalidad TEXT DEFAULT 'presencial' CHECK (modalidad IN ('presencial', 'remoto')),
    corregido_por BIGINT REFERENCES usuarios(id),
    correcion_motivo TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_fichajes_usuario_fecha ON fichajes(usuario_id, timestamp DESC);
CREATE INDEX idx_fichajes_fecha ON fichajes(timestamp DESC);
```

### 10.2 Endpoints de Fichaje

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/fichajes` | requireAuth | Registrar entrada/salida con modalidad y target_user_id (supervisor) |
| GET | `/api/fichajes?mes=&hoy=&hoy_fin=&desde=&hasta=&exportar=` | requireAuth | Historial personal o equipo (timezone-safe con rangos) |
| GET | `/api/fichajes/equipo?fecha=&fecha_fin=` | requireRole(sup,jefe,dev,bo,it) | Vista equipo con cruce de pausas |

### 10.3 Flujo de Datos del Fichaje

```
Frontend → calcula inicio/fin del día en hora local del navegador
    │
    ▼ POST /api/fichajes { tipo, timestamp, modalidad }
    │
API → requireAuth() → verifica activo en JWT
    │ → INSERT INTO fichajes (... modalidad ...)
    │ → RETURNING id, tipo, timestamp, modalidad
    │
    ▼ Response: { id, tipo, timestamp, modalidad }

Si API no responde:
    │ → localStorage.setItem('fichajes_pendientes', [...])
    │ → Al reconectar: sincronizarPendientes() envía en lote
```

### 10.4 Matriz de Cumplimiento

| Norma | Requisito | Estado |
|-------|-----------|:---:|
| RD-ley 8/2019 | Registro diario inicio/fin | ✅ |
| RD-ley 8/2019 | Pausas registradas (cruce con tabla pausas) | ✅ |
| RD-ley 8/2019 | Conservación 4 años (sin DELETE) | ✅ |
| RD-ley 8/2019 | Acceso del trabajador (/fichaje) | ✅ |
| RD-ley 8/2019 | Inspección (CSV con formato español) | ✅ |
| RD-ley 8/2019 | Registro manual supervisor (target_user_id + motivo) | ✅ |
| Ley 10/2021 | Modalidad presencial/remoto | ✅ |
| RD-ley 2/2024 | Triple verificación activo (login + JWT + API) | ✅ |
| Implícito | Zona horaria local (rangos TIMESTAMPTZ) | ✅ |
| Implícito | Offline resiliente (localStorage sync) | ✅ |
