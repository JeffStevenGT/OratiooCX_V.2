-- ═══════════════════════════════════════════════════════════════
-- ORATIOO CX - Tabla de metas/objetivos
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS metas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL,       -- a quién se le asigna la meta
    creado_por BIGINT NOT NULL,       -- quién la creó (supervisor/jefe/ceo)
    tipo TEXT NOT NULL DEFAULT 'ventas',  -- ventas, contactados
    cantidad INT NOT NULL DEFAULT 0,
    periodo TEXT NOT NULL DEFAULT 'mensual',
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE metas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso publico metas" ON metas;
CREATE POLICY "Acceso publico metas" ON metas
    FOR ALL
    USING (true)
    WITH CHECK (true);
