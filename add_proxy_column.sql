-- Agregar columna proxy_asignado a la tabla perfiles
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS proxy_asignado TEXT DEFAULT '';
