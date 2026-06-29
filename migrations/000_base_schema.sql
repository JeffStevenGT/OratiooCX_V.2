-- ============================================================
-- Migración 000: Esquema Base — OratiooCX_V.2
-- ============================================================
-- Todas las tablas usan IF NOT EXISTS (idempotente).

-- ── Proyectos ──
CREATE TABLE IF NOT EXISTS proyectos (
    id SERIAL PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL,
    nombre_visible TEXT NOT NULL DEFAULT '',
    activo BOOLEAN NOT NULL DEFAULT true,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Usuarios (extendido vs viejo) ──
-- Primero guardamos los datos viejos si existen, luego recreamos
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuarios' AND column_name='password_hash') THEN
        -- Ya tiene estructura V.2, no hacer nada
        RETURN;
    END IF;
END $$;

-- Agregar columnas que faltan a la tabla usuarios vieja
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nombre TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol TEXT DEFAULT 'asesor';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS equipo TEXT DEFAULT 'España';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS supervisor_id INTEGER;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS extension_vpbx TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultima_conexion TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ── Clientes ──
CREATE TABLE IF NOT EXISTS clientes (
    id_cliente TEXT PRIMARY KEY,
    tipo_documento TEXT,
    numero_documento TEXT,
    nombre_razon_social TEXT,
    tipo_persona TEXT,
    whatsapp_opt_in BOOLEAN DEFAULT false,
    whatsapp_numero TEXT,
    alertas_fidelizacion BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- ── Clientes-Proyectos (tabla principal del bot) ──
CREATE TABLE IF NOT EXISTS clientes_proyectos (
    id SERIAL PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    datos JSONB NOT NULL DEFAULT '{}',
    ultima_extraccion TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(id_cliente, proyecto_id)
);

-- ── Pipeline (asignaciones de leads) ──
CREATE TABLE IF NOT EXISTS pipeline (
    id SERIAL PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    asesor_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    notas TEXT,
    ultimo_cambio TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- ── Historial ──
CREATE TABLE IF NOT EXISTS historial (
    id SERIAL PRIMARY KEY,
    id_cliente TEXT,
    proyecto_id INTEGER,
    tipo TEXT NOT NULL,
    asesor_id INTEGER,
    descripcion TEXT,
    datos JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Detecciones (cambios entre análisis) ──
CREATE TABLE IF NOT EXISTS detecciones (
    id SERIAL PRIMARY KEY,
    id_cliente TEXT,
    proyecto_id INTEGER,
    tipo TEXT NOT NULL,
    linea_numero TEXT,
    valor_anterior TEXT,
    valor_nuevo TEXT,
    datos_extra JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Pausas ──
CREATE TABLE IF NOT EXISTS pausas (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    proyecto_id INTEGER REFERENCES proyectos(id) ON DELETE CASCADE,
    inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
    fin TIMESTAMPTZ,
    duracion_segundos INTEGER,
    tipo TEXT DEFAULT 'manual',
    nota TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── CDR VPBX ──
CREATE TABLE IF NOT EXISTS cdr_vpbx (
    id SERIAL PRIMARY KEY,
    call_id TEXT UNIQUE,
    origen TEXT,
    destino TEXT,
    duracion INTEGER,
    billsec INTEGER,
    estado TEXT,
    grabacion_url TEXT,
    ddi TEXT,
    user_id INTEGER,
    proyecto_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Metas ──
CREATE TABLE IF NOT EXISTS metas (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    proyecto_id INTEGER REFERENCES proyectos(id) ON DELETE CASCADE,
    mes INTEGER NOT NULL,
    anyo INTEGER NOT NULL,
    valor_objetivo NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── QA Evaluaciones ──
CREATE TABLE IF NOT EXISTS qa_evaluaciones (
    id SERIAL PRIMARY KEY,
    id_cliente TEXT,
    proyecto_id INTEGER,
    auditor_id INTEGER REFERENCES usuarios(id),
    asesor_id INTEGER REFERENCES usuarios(id),
    puntaje NUMERIC DEFAULT 0,
    comentarios TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Fichajes ──
CREATE TABLE IF NOT EXISTS fichajes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL DEFAULT 'entrada',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Configuración global ──
CREATE TABLE IF NOT EXISTS configuracion (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Proxies ──
CREATE TABLE IF NOT EXISTS proxies (
    id SERIAL PRIMARY KEY,
    ip TEXT NOT NULL,
    puerto INTEGER NOT NULL,
    usuario TEXT,
    password TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Listas negras ──
CREATE TABLE IF NOT EXISTS listas_negras (
    id SERIAL PRIMARY KEY,
    dni TEXT NOT NULL,
    proyecto_id INTEGER REFERENCES proyectos(id) ON DELETE CASCADE,
    motivo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(dni, proyecto_id)
);

-- ── Comandos bot ──
CREATE TABLE IF NOT EXISTS comandos_bot (
    id SERIAL PRIMARY KEY,
    maquina_destino TEXT NOT NULL DEFAULT '*',
    comando TEXT NOT NULL,
    parametros JSONB DEFAULT '{}',
    estado TEXT DEFAULT 'pendiente',
    ejecutado_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Máquinas (heartbeat bots) ──
CREATE TABLE IF NOT EXISTS maquinas (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    workers_activos INTEGER DEFAULT 0,
    workers_info JSONB DEFAULT '[]',
    ultimo_heartbeat TIMESTAMPTZ,
    estado TEXT DEFAULT 'activo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Credenciales Pangea ──
CREATE TABLE IF NOT EXISTS credenciales_pangea (
    id SERIAL PRIMARY KEY,
    usuario TEXT NOT NULL,
    password TEXT NOT NULL,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── WhatsApp Webhooks ──
CREATE TABLE IF NOT EXISTS whatsapp_webhooks (
    id SERIAL PRIMARY KEY,
    payload JSONB NOT NULL,
    procesado BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Anuncios (creado en 001, pero por si acaso) ──
CREATE TABLE IF NOT EXISTS anuncios (
    id SERIAL PRIMARY KEY,
    proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    mensaje TEXT NOT NULL DEFAULT '',
    tipo TEXT NOT NULL DEFAULT 'general',
    roles_visibles TEXT[] NOT NULL DEFAULT ARRAY['asesor','supervisor','jefe_area','back_office','auditor_calidad','it','desarrollador'],
    creado_por INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Anuncios leídos ──
CREATE TABLE IF NOT EXISTS anuncios_leidos (
    anuncio_id INTEGER NOT NULL REFERENCES anuncios(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    leido_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (anuncio_id, user_id)
);

-- ── DDI (creado en 003, pero por si acaso) ──
CREATE TABLE IF NOT EXISTS ddis (
    id SERIAL PRIMARY KEY,
    provincia TEXT NOT NULL,
    codigo_prov TEXT,
    prefijos TEXT[] DEFAULT '{}',
    ddi TEXT NOT NULL,
    outbound_id TEXT,
    estado TEXT DEFAULT 'activo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Datos iniciales
-- ============================================================

-- Proyecto por defecto: orange
INSERT INTO proyectos (nombre, nombre_visible, config) 
VALUES ('orange', 'Orange', '{"campos_lead": ["nombre","telefono","dni"]}')
ON CONFLICT (nombre) DO NOTHING;

-- Usuario admin por defecto (password: admin123)
INSERT INTO usuarios (email, nombre, password_hash, rol, activo)
VALUES ('admin@oratioo.com', 'Administrador', '$2b$10$8K1p/a0dL1LXMIgoEDFrwOfMQkf9XhL5K5HIJGZxrjCFhSUa7RzWq', 'desarrollador', true)
ON CONFLICT DO NOTHING;

-- Insertar credenciales Pangea si no existen
INSERT INTO credenciales_pangea (usuario, password)
VALUES ('DIticnex', 'Manzana.2026')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Índices
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_cp_proyecto_estado ON clientes_proyectos(proyecto_id, (datos->>'estado'));
CREATE INDEX IF NOT EXISTS idx_cp_proyecto_cliente ON clientes_proyectos(proyecto_id, id_cliente);
CREATE INDEX IF NOT EXISTS idx_cp_ultima_extraccion ON clientes_proyectos(proyecto_id, ultima_extraccion DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_pl_proyecto_activo_estado ON pipeline(proyecto_id, estado) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pl_asesor_proyecto ON pipeline(asesor_id, proyecto_id, estado) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pl_cliente_proyecto ON pipeline(id_cliente, proyecto_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_historial_cliente ON historial(id_cliente, proyecto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_detecciones_cliente ON detecciones(id_cliente, proyecto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pausas_user ON pausas(user_id, inicio DESC);
CREATE INDEX IF NOT EXISTS idx_comandos_pendientes ON comandos_bot(estado, maquina_destino) WHERE estado = 'pendiente';
CREATE INDEX IF NOT EXISTS idx_maquinas_nombre ON maquinas(nombre);
