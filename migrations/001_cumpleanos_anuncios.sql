-- Migración: Cumpleaños + Anuncios
-- Ejecutar contra la BD de desarrollo

-- 1. Añadir fecha_nacimiento a usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fecha_nacimiento date;

-- 2. Tabla de anuncios
CREATE TABLE IF NOT EXISTS anuncios (
    id SERIAL PRIMARY KEY,
    proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    mensaje TEXT NOT NULL DEFAULT '',
    tipo TEXT NOT NULL DEFAULT 'general' CHECK (tipo IN ('general', 'record_ventas', 'festividad', 'cambio_condiciones', 'cumpleanos')),
    roles_visibles TEXT[] NOT NULL DEFAULT ARRAY['asesor','supervisor','jefe_area','back_office','auditor_calidad','it','desarrollador'],
    creado_por INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anuncios_proyecto ON anuncios(proyecto_id, activo);
CREATE INDEX IF NOT EXISTS idx_anuncios_tipo ON anuncios(tipo);

-- 3. Tabla de anuncios leídos
CREATE TABLE IF NOT EXISTS anuncios_leidos (
    anuncio_id INTEGER NOT NULL REFERENCES anuncios(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    leido_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (anuncio_id, user_id)
);
