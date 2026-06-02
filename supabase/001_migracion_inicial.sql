-- Oratioo CX — Migración Inicial
-- Branch: submaster | Stack: PostgreSQL

-- ═══════════════════════════════════════════
-- 1. TABLA CORE: CLIENTES
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS clientes (
    id_cliente TEXT PRIMARY KEY,        -- "DNI_12345678A" | "NIE_X1234567L" | "NIF_B12345678"
    tipo_documento TEXT NOT NULL,       -- DNI | NIE | NIF
    numero_documento TEXT NOT NULL,
    nombre_razon_social TEXT,
    tipo_persona TEXT,                  -- natural | autonomo | empresa
    cnae TEXT,                          -- Código actividad económica
    telefonos JSONB DEFAULT '[]',
    emails JSONB DEFAULT '[]',
    direccion JSONB DEFAULT '{}',
    datos_extra JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clientes_tipo_doc ON clientes (tipo_documento, numero_documento);
CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes USING GIN (to_tsvector('spanish', coalesce(nombre_razon_social, '')));
CREATE INDEX IF NOT EXISTS idx_clientes_telefonos ON clientes USING GIN (telefonos);

-- ═══════════════════════════════════════════
-- 2. PROYECTOS
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS proyectos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,         -- "orange" | "mainjobs"
    nombre_visible TEXT NOT NULL,
    activo BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO proyectos (nombre, nombre_visible) VALUES
    ('orange', 'Orange Pangea'),
    ('mainjobs', 'Mainjobs Cursos'),
    ('impresoras', 'Impresoras y Equipos')
ON CONFLICT (nombre) DO NOTHING;

-- ═══════════════════════════════════════════
-- 3. CLIENTES POR PROYECTO (JSONB)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS clientes_proyectos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    proyecto_id BIGINT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    datos JSONB DEFAULT '{}',
    ultima_extraccion TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(id_cliente, proyecto_id)
);

-- Índices especializados para JSONB
CREATE INDEX IF NOT EXISTS idx_cp_cliente ON clientes_proyectos (id_cliente);
CREATE INDEX IF NOT EXISTS idx_cp_proyecto ON clientes_proyectos (proyecto_id);
CREATE INDEX IF NOT EXISTS idx_cp_datos_gin ON clientes_proyectos USING GIN (datos);

-- 🚀 Índices B-Tree sobre claves JSONB críticas (evitan escaneos secuenciales)
CREATE INDEX IF NOT EXISTS idx_cp_cima_global ON clientes_proyectos ((datos->>'cima_global'));
CREATE INDEX IF NOT EXISTS idx_cp_lineas_gin ON clientes_proyectos USING GIN ((datos->'lineas'));
CREATE INDEX IF NOT EXISTS idx_cp_ultima_extraccion ON clientes_proyectos (ultima_extraccion DESC);
CREATE INDEX IF NOT EXISTS idx_cp_estado ON clientes_proyectos ((datos->'estado'));

-- ═══════════════════════════════════════════
-- 4. HISTORIAL (Timeline único)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS historial (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    tipo TEXT NOT NULL,                  -- "llamada" | "extraccion" | "tipificacion" | "curso" | "compra" | "webhook_vpbx"
    proyecto_id BIGINT REFERENCES proyectos(id),
    asesor_id BIGINT,
    descripcion TEXT,
    datos JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historial_cliente ON historial (id_cliente);
CREATE INDEX IF NOT EXISTS idx_historial_fecha ON historial (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_historial_tipo ON historial (tipo);
CREATE INDEX IF NOT EXISTS idx_historial_proyecto ON historial (proyecto_id, created_at DESC);

-- ═══════════════════════════════════════════
-- 5. PIPELINE (Estado comercial)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pipeline (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    proyecto_id BIGINT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    asesor_id BIGINT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente',
        CHECK (estado IN ('pendiente','contactado','interesado','negociacion',
                          'venta','tramitado','activado','no_interesa','no_contesta')),
    notas TEXT,
    documentos JSONB DEFAULT '[]',
    callback_at TIMESTAMPTZ,
    ultimo_cambio TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,              -- Soft delete
    UNIQUE(id_cliente, proyecto_id, asesor_id, deleted_at)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_asesor ON pipeline (asesor_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_estado ON pipeline (estado);
CREATE INDEX IF NOT EXISTS idx_pipeline_callback ON pipeline (callback_at) WHERE callback_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_cliente ON pipeline (id_cliente, proyecto_id) WHERE deleted_at IS NULL;

-- ═══════════════════════════════════════════
-- 6. USUARIOS
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS usuarios (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'asesor',
        CHECK (rol IN ('asesor','supervisor','jefe_area','back_office','it','desarrollador')),
    equipo TEXT,                         -- "España" | "Perú"
    supervisor_id BIGINT REFERENCES usuarios(id),
    extension_vpbx TEXT,                 -- Extensión SIP en VPBX
    activo BOOLEAN DEFAULT true,
    ultima_conexion TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios (rol) WHERE activo = true;

-- ═══════════════════════════════════════════
-- 7. CDR (Registro de llamadas VPBX)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS cdr_vpbx (
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

CREATE INDEX IF NOT EXISTS idx_cdr_asesor ON cdr_vpbx (asesor_id, created DESC);
CREATE INDEX IF NOT EXISTS idx_cdr_cliente ON cdr_vpbx (id_cliente);
CREATE INDEX IF NOT EXISTS idx_cdr_dst ON cdr_vpbx (dst);

-- ═══════════════════════════════════════════
-- 8. COMANDOS BOT (Control remoto)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS comandos_bot (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    maquina_destino TEXT NOT NULL,
    comando TEXT NOT NULL,               -- "iniciar" | "detener" | "pausar" | "reanudar" | "reset_queue"
    parametros JSONB DEFAULT '{}',
    estado TEXT DEFAULT 'pendiente',
        CHECK (estado IN ('pendiente','en_curso','completado','fallo')),
    created_at TIMESTAMPTZ DEFAULT now(),
    ejecutado_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════════
-- 9. DISCARD (Soft delete — vista limpia)
-- ═══════════════════════════════════════════
CREATE OR REPLACE VIEW pipeline_activos AS
    SELECT * FROM pipeline WHERE deleted_at IS NULL;

-- ═══════════════════════════════════════════
-- 🛡️ AUDITORÍA INMUTABLE — Trigger PostgreSQL
--    Zero-trust: la BD registra cambios aunque el backend falle
-- ═══════════════════════════════════════════

-- 9A. Función para auditar cambios en pipeline
CREATE OR REPLACE FUNCTION log_pipeline_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.estado IS DISTINCT FROM NEW.estado THEN
        INSERT INTO historial (id_cliente, tipo, proyecto_id, asesor_id, descripcion, datos)
        VALUES (
            NEW.id_cliente,
            'tipificacion',
            NEW.proyecto_id,
            NEW.asesor_id,
            'Cambio de estado: ' || OLD.estado || ' -> ' || NEW.estado,
            jsonb_build_object(
                'estado_anterior', OLD.estado,
                'estado_nuevo', NEW.estado,
                'notas', NEW.notas
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9B. Asignar trigger a pipeline
DROP TRIGGER IF EXISTS trigger_auditoria_pipeline ON pipeline;
CREATE TRIGGER trigger_auditoria_pipeline
    AFTER UPDATE ON pipeline
    FOR EACH ROW
    EXECUTE FUNCTION log_pipeline_changes();

-- 9C. Función para auditar inserciones en clientes_proyectos
CREATE OR REPLACE FUNCTION log_extraccion_cliente()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO historial (id_cliente, tipo, proyecto_id, descripcion, datos)
    VALUES (
        NEW.id_cliente,
        'extraccion',
        NEW.proyecto_id,
        'Bot extrajo datos del cliente',
        jsonb_build_object(
            'id_cp', NEW.id,
            'timestamp', NEW.ultima_extraccion
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9D. Asignar trigger a clientes_proyectos
DROP TRIGGER IF EXISTS trigger_auditoria_extraccion ON clientes_proyectos;
CREATE TRIGGER trigger_auditoria_extraccion
    AFTER INSERT ON clientes_proyectos
    FOR EACH ROW
    EXECUTE FUNCTION log_extraccion_cliente();

-- ═══════════════════════════════════════════
-- 🔐 FUNCIÓN: Toma de DNI atómico (evita duplicados entre workers)
-- ═══════════════════════════════════════════
CREATE OR REPLACE FUNCTION tomar_siguiente_dni(p_proyecto_id BIGINT)
RETURNS TABLE (id_cp BIGINT, id_cliente_out TEXT) AS $$
BEGIN
    RETURN QUERY
    WITH tomado AS (
        SELECT cp.id, cp.id_cliente
        FROM clientes_proyectos cp
        WHERE cp.proyecto_id = p_proyecto_id
          AND cp.datos->>'estado' = 'pendiente'
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    UPDATE clientes_proyectos cp
    SET datos = jsonb_set(cp.datos, '{estado}', '"en_progreso"'),
        updated_at = now()
    FROM tomado
    WHERE cp.id = tomado.id
    RETURNING cp.id, cp.id_cliente;
END;
$$ LANGUAGE plpgsql;
