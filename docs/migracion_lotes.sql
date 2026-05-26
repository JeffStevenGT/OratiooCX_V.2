-- Migracion de lotes y asignaciones
CREATE TABLE IF NOT EXISTS lotes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre TEXT NOT NULL,
    supervisor_id INT,
    creado_por INT,
    total_dnis INT DEFAULT 0,
    asignados INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS lote_dnis (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lote_id INT NOT NULL,
    dni TEXT NOT NULL,
    asesor_id INT,
    estado TEXT DEFAULT 'pendiente',
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lote_dnis ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_access_lotes ON lotes FOR ALL USING (true);
CREATE POLICY public_access_lote_dnis ON lote_dnis FOR ALL USING (true);
