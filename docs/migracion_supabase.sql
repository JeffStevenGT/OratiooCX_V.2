-- ═══════════════════════════════════════════════════════════════
-- ORATIOO CX - Migración completa de Supabase
-- ═══════════════════════════════════════════════════════════════
-- Ejecutar en el SQL Editor de Supabase

-- ── 1. TABLA PRINCIPAL: lineas ───────────────────────────────────

CREATE TABLE IF NOT EXISTS lineas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dni TEXT NOT NULL,
    nombre TEXT DEFAULT 'N/A',
    direccion TEXT DEFAULT 'N/A',
    linea TEXT DEFAULT 'N/A',
    seg_fijo TEXT DEFAULT 'N/A',
    seg_movil TEXT DEFAULT 'N/A',
    paquete TEXT DEFAULT 'N/A',
    estado TEXT DEFAULT 'pendiente',
    semana TEXT,
    procesado_por TEXT,
    atributos_dinamicos JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lineas_dni ON lineas (dni);
CREATE INDEX IF NOT EXISTS idx_lineas_estado ON lineas (estado);
CREATE INDEX IF NOT EXISTS idx_lineas_atributos ON lineas USING GIN (atributos_dinamicos);

-- RLS
ALTER TABLE lineas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso anonimo lectura" ON lineas;
CREATE POLICY "Acceso anonimo lectura" ON lineas
    FOR SELECT USING (true);
DROP POLICY IF EXISTS "Acceso anonimo escritura" ON lineas;
CREATE POLICY "Acceso anonimo escritura" ON lineas
    FOR UPDATE
    USING (true)
    WITH CHECK (true);
DROP POLICY IF EXISTS "Acceso service_role" ON lineas;
CREATE POLICY "Acceso service_role" ON lineas
    FOR ALL USING (true);


-- ── 2. TABLA: maquinas (registro de PCs que ejecutan bots) ──────

CREATE TABLE IF NOT EXISTS maquinas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    ip TEXT DEFAULT 'N/A',
    workers_activos INT DEFAULT 0,
    workers_info JSONB DEFAULT '[]'::jsonb,
    proxies_asignados JSONB DEFAULT '[]'::jsonb,
    ultimo_heartbeat TIMESTAMPTZ DEFAULT now(),
    estado TEXT DEFAULT 'desconectado',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE maquinas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso publico maquinas" ON maquinas;
CREATE POLICY "Acceso publico maquinas" ON maquinas
    FOR ALL USING (true);


-- ── 3. TABLA: config_bots (configuración remota) ────────────────

CREATE TABLE IF NOT EXISTS config_bots (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    clave TEXT NOT NULL UNIQUE,
    valor TEXT NOT NULL,
    descripcion TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Valores por defecto
INSERT INTO config_bots (clave, valor, descripcion) VALUES
    ('max_workers_por_maquina', '3', 'Máximo workers por máquina'),
    ('pausa_entre_dnis_ms', '2000-4000', 'Rango de pausa entre DNIs (ms)'),
    ('horario_inicio', '06:00', 'Hora de inicio de ejecución'),
    ('horario_fin', '22:00', 'Hora de fin de ejecución'),
    ('reintentos_por_dni', '3', 'Número de reintentos por DNI'),
    ('activo', 'true', 'Sistema activo o pausado')
ON CONFLICT (clave) DO NOTHING;

ALTER TABLE config_bots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso publico config" ON config_bots;
CREATE POLICY "Acceso publico config" ON config_bots
    FOR ALL USING (true);


-- ── 4. TABLA: logs_bot (log centralizado) ──────────────────────

CREATE TABLE IF NOT EXISTS logs_bot (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    worker_id INT DEFAULT 0,
    maquina TEXT DEFAULT '',
    nivel TEXT DEFAULT 'INFO',
    mensaje TEXT DEFAULT '',
    dni TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_created ON logs_bot (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_maquina ON logs_bot (maquina);

ALTER TABLE logs_bot ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso publico logs" ON logs_bot;
CREATE POLICY "Acceso publico logs" ON logs_bot
    FOR ALL USING (true);


-- ── 5. TABLA: documentos (registro de cargas semanales) ─────────

CREATE TABLE IF NOT EXISTS documentos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_archivo TEXT NOT NULL,
    semana TEXT NOT NULL,
    total_dnis INT DEFAULT 0,
    procesados INT DEFAULT 0,
    pendientes INT DEFAULT 0,
    errores INT DEFAULT 0,
    no_encontrados INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso publico documentos" ON documentos;
CREATE POLICY "Acceso publico documentos" ON documentos
    FOR ALL USING (true);


-- ═══════════════════════════════════════════════════════════════
-- FUNCIONES ÚTILES
-- ═══════════════════════════════════════════════════════════════

-- Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lineas_updated ON lineas;
CREATE TRIGGER trg_lineas_updated
    BEFORE UPDATE ON lineas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_documentos_updated ON documentos;
CREATE TRIGGER trg_documentos_updated
    BEFORE UPDATE ON documentos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();


-- 6. TABLA: lead_pipeline (estados CRM por lead)

CREATE TABLE IF NOT EXISTS lead_pipeline (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    linea_id BIGINT,
    asesor_id INT,
    estado TEXT DEFAULT 'pendiente',
    notas TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_pipeline_linea ON lead_pipeline (linea_id);

ALTER TABLE lead_pipeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso publico lead_pipeline" ON lead_pipeline;
CREATE POLICY "Acceso publico lead_pipeline" ON lead_pipeline
    FOR ALL USING (true);


-- Contar clientes CIMA
CREATE OR REPLACE FUNCTION contar_cima()
RETURNS INT AS $$
DECLARE
    total INT;
BEGIN
    SELECT COUNT(*) INTO total
    FROM lineas
    WHERE atributos_dinamicos->>'cima' = 'SI'
      AND atributos_dinamicos->>'estado' != 'no_cliente';
    RETURN total;
END;
$$ LANGUAGE plpgsql;


-- Contar clientes con Renove Mixto
CREATE OR REPLACE FUNCTION contar_renove_mixto()
RETURNS INT AS $$
DECLARE
    total INT;
BEGIN
    SELECT COUNT(*) INTO total
    FROM lineas
    WHERE atributos_dinamicos->>'estado' = 'completado'
      AND (
          atributos_dinamicos->>'renove_mixto_variante' IS NOT NULL
          AND atributos_dinamicos->>'renove_mixto_variante' != 'N/A'
      );
    RETURN total;
END;
$$ LANGUAGE plpgsql;
