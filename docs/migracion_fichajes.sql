-- Migración: Tabla fichajes — Fichaje electrónico (normativa España RD-ley 8/2019)
-- Fecha: 2026-06-12

CREATE TABLE IF NOT EXISTS fichajes (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    metodo TEXT DEFAULT 'manual',
    -- metodo: 'manual', 'auto_login', 'supervisor'
    ip TEXT,
    notas TEXT,
    corregido_por BIGINT REFERENCES usuarios(id),
    correcion_motivo TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fichajes_usuario_fecha ON fichajes(usuario_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_fichajes_fecha ON fichajes(timestamp DESC);
