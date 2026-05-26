-- ═══════════════════════════════════════════════════════════════
-- ORATIOO CX - Migracion de usuarios y roles (FULL)
-- ═══════════════════════════════════════════════════════════════
-- EJECUTAR EN: Supabase Dashboard > SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Crear tabla usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    nombre TEXT DEFAULT '',
    email TEXT DEFAULT '',
    rol TEXT NOT NULL DEFAULT 'asesor',
    equipo TEXT DEFAULT 'Peru',
    grupo TEXT DEFAULT '',
    supervisor_id BIGINT REFERENCES usuarios(id),
    activo BOOLEAN DEFAULT true,
    ultima_conexion TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. RLS: permitir todo desde el frontend (anon key)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso publico usuarios" ON usuarios;
CREATE POLICY "Acceso publico usuarios" ON usuarios
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 3. Insertar datos semilla
-- Staff (admin, jefe, it, back)
INSERT INTO usuarios (usuario, password, nombre, email, rol, equipo, grupo, supervisor_id, activo) VALUES
    ('admin', 'admin', 'Alonso Rivera', 'alonso.rivera@oratioo.com', 'desarrollador', 'Peru', '', null, true);

INSERT INTO usuarios (usuario, password, nombre, email, rol, equipo, grupo, supervisor_id, activo) VALUES
    ('jefe', 'jefe', 'Daniela Paz', 'daniela.paz@oratioo.com', 'jefe_area', 'Peru', '', null, true);

INSERT INTO usuarios (usuario, password, nombre, email, rol, equipo, grupo, supervisor_id, activo) VALUES
    ('carlos', 'carlos', 'Carlos Mendoza', 'carlos.mendoza@oratioo.com', 'it', 'Peru', '', null, true),
    ('renato', 'renato', 'Renato Paredes', 'renato.paredes@oratioo.com', 'it', 'Peru', '', null, true),
    ('david', 'david', 'David Huaman', 'david.huaman@oratioo.com', 'it', 'Peru', '', null, true);

INSERT INTO usuarios (usuario, password, nombre, email, rol, equipo, grupo, supervisor_id, activo) VALUES
    ('maria', 'maria', 'Maria Torres', 'maria.torres@oratioo.com', 'back_office', 'Peru', '', null, true),
    ('andrea', 'andrea', 'Andrea Flores', 'andrea.flores@oratioo.com', 'back_office', 'Peru', '', null, true),
    ('laura', 'laura', 'Laura Quintana', 'laura.quintana@oratioo.com', 'back_office', 'Espana', '', null, true);

-- Supervisores
INSERT INTO usuarios (usuario, password, nombre, email, rol, equipo, grupo, supervisor_id, activo) VALUES
    ('supesp', 'supesp', 'Javier Moreno', 'javier.moreno@oratioo.com', 'supervisor', 'Espana', '', null, true),
    ('suppe', 'suppe', 'Carmen Vega', 'carmen.vega@oratioo.com', 'supervisor', 'Peru', '', null, true);

-- Asesores (usando subquery para obtener los IDs correctos de supervisores)
INSERT INTO usuarios (usuario, password, nombre, email, rol, equipo, grupo, supervisor_id, activo)
SELECT 'lucia', 'lucia', 'Lucia Ramirez', 'lucia.ramirez@oratioo.com', 'asesor', 'Espana', 'Team Alpha', id, true
FROM usuarios WHERE usuario = 'supesp';

INSERT INTO usuarios (usuario, password, nombre, email, rol, equipo, grupo, supervisor_id, activo)
SELECT 'pedro', 'pedro', 'Pedro Sanchez', 'pedro.sanchez@oratioo.com', 'asesor', 'Espana', 'Team Alpha', id, true
FROM usuarios WHERE usuario = 'supesp';

INSERT INTO usuarios (usuario, password, nombre, email, rol, equipo, grupo, supervisor_id, activo)
SELECT 'fernanda', 'fernanda', 'Fernanda Leon', 'fernanda.leon@oratioo.com', 'asesor', 'Espana', 'Team Alpha', id, true
FROM usuarios WHERE usuario = 'supesp';

INSERT INTO usuarios (usuario, password, nombre, email, rol, equipo, grupo, supervisor_id, activo)
SELECT 'alejandro', 'alejandro', 'Alejandro Gomez', 'alejandro.gomez@oratioo.com', 'asesor', 'Espana', 'Team Beta', id, true
FROM usuarios WHERE usuario = 'supesp';

INSERT INTO usuarios (usuario, password, nombre, email, rol, equipo, grupo, supervisor_id, activo)
SELECT 'valeria', 'valeria', 'Valeria Navarro', 'valeria.navarro@oratioo.com', 'asesor', 'Espana', 'Team Beta', id, true
FROM usuarios WHERE usuario = 'supesp';

INSERT INTO usuarios (usuario, password, nombre, email, rol, equipo, grupo, supervisor_id, activo)
SELECT 'gabriel', 'gabriel', 'Gabriel Torres', 'gabriel.torres@oratioo.com', 'asesor', 'Espana', 'Team Beta', id, true
FROM usuarios WHERE usuario = 'supesp';

INSERT INTO usuarios (usuario, password, nombre, email, rol, equipo, grupo, supervisor_id, activo)
SELECT 'sofia', 'sofia', 'Sofia Castillo', 'sofia.castillo@oratioo.com', 'asesor', 'Peru', 'Team Lima', id, true
FROM usuarios WHERE usuario = 'suppe';

INSERT INTO usuarios (usuario, password, nombre, email, rol, equipo, grupo, supervisor_id, activo)
SELECT 'diego', 'diego', 'Diego Vargas', 'diego.vargas@oratioo.com', 'asesor', 'Peru', 'Team Lima', id, true
FROM usuarios WHERE usuario = 'suppe';

INSERT INTO usuarios (usuario, password, nombre, email, rol, equipo, grupo, supervisor_id, activo)
SELECT 'camila', 'camila', 'Camila Rojas', 'camila.rojas@oratioo.com', 'asesor', 'Peru', 'Team Lima', id, true
FROM usuarios WHERE usuario = 'suppe';

INSERT INTO usuarios (usuario, password, nombre, email, rol, equipo, grupo, supervisor_id, activo)
SELECT 'pablo', 'pablo', 'Pablo Guerrero', 'pablo.guerrero@oratioo.com', 'asesor', 'Peru', 'Team Lima', id, true
FROM usuarios WHERE usuario = 'suppe';

-- 4. Verificacion
SELECT id, usuario, rol, equipo, grupo, supervisor_id FROM usuarios ORDER BY id;
