-- Oratioo CX — Seed: Usuarios de prueba
-- Branch: submaster
-- Password para todos: "oratioo2026" (hash bcrypt)

-- Limpiar usuarios existentes (opcional)
-- DELETE FROM usuarios WHERE email LIKE '%@oratioo.local';

-- CEO
INSERT INTO usuarios (email, nombre, password_hash, rol, equipo, activo)
VALUES ('ceo@oratioo.local', 'Carlos CEO', '$2a$10$WSUZrBIIgM2IZ4DjNMXxkOo2dBdnrFLRyuHqY.o/iFVov3vGzbaqe', 'desarrollador', NULL, true)
ON CONFLICT (email) DO NOTHING;

-- Jefes de Área
INSERT INTO usuarios (email, nombre, password_hash, rol, equipo, activo)
VALUES
  ('jefe.peru@oratioo.local', 'Miguel Jefe Perú', '$2a$10$WSUZrBIIgM2IZ4DjNMXxkOo2dBdnrFLRyuHqY.o/iFVov3vGzbaqe', 'jefe_area', 'Perú', true),
  ('jefe.espana@oratioo.local', 'Antonio Jefe España', '$2a$10$WSUZrBIIgM2IZ4DjNMXxkOo2dBdnrFLRyuHqY.o/iFVov3vGzbaqe', 'jefe_area', 'España', true)
ON CONFLICT (email) DO NOTHING;

-- Supervisores (reportan a sus jefes de área)
INSERT INTO usuarios (email, nombre, password_hash, rol, equipo, supervisor_id, activo)
VALUES
  ('sup.peru@oratioo.local', 'Lucía Sup Perú', '$2a$10$WSUZrBIIgM2IZ4DjNMXxkOo2dBdnrFLRyuHqY.o/iFVov3vGzbaqe', 'supervisor', 'Perú',
    (SELECT id FROM usuarios WHERE email = 'jefe.peru@oratioo.local'), true),
  ('sup.espana@oratioo.local', 'Pablo Sup España', '$2a$10$WSUZrBIIgM2IZ4DjNMXxkOo2dBdnrFLRyuHqY.o/iFVov3vGzbaqe', 'supervisor', 'España',
    (SELECT id FROM usuarios WHERE email = 'jefe.espana@oratioo.local'), true)
ON CONFLICT (email) DO NOTHING;

-- Asesores Perú (reportan a Lucía)
INSERT INTO usuarios (email, nombre, password_hash, rol, equipo, supervisor_id, activo)
VALUES
  ('asesor1.peru@oratioo.local', 'Ana Asesora Perú', '$2a$10$WSUZrBIIgM2IZ4DjNMXxkOo2dBdnrFLRyuHqY.o/iFVov3vGzbaqe', 'asesor', 'Perú',
    (SELECT id FROM usuarios WHERE email = 'sup.peru@oratioo.local'), true),
  ('asesor2.peru@oratioo.local', 'Luis Asesor Perú', '$2a$10$WSUZrBIIgM2IZ4DjNMXxkOo2dBdnrFLRyuHqY.o/iFVov3vGzbaqe', 'asesor', 'Perú',
    (SELECT id FROM usuarios WHERE email = 'sup.peru@oratioo.local'), true),
  ('asesor3.peru@oratioo.local', 'Carmen Asesora Perú', '$2a$10$WSUZrBIIgM2IZ4DjNMXxkOo2dBdnrFLRyuHqY.o/iFVov3vGzbaqe', 'asesor', 'Perú',
    (SELECT id FROM usuarios WHERE email = 'sup.peru@oratioo.local'), true)
ON CONFLICT (email) DO NOTHING;

-- Asesores España (reportan a Pablo)
INSERT INTO usuarios (email, nombre, password_hash, rol, equipo, supervisor_id, activo)
VALUES
  ('asesor1.espana@oratioo.local', 'David Asesor España', '$2a$10$WSUZrBIIgM2IZ4DjNMXxkOo2dBdnrFLRyuHqY.o/iFVov3vGzbaqe', 'asesor', 'España',
    (SELECT id FROM usuarios WHERE email = 'sup.espana@oratioo.local'), true),
  ('asesor2.espana@oratioo.local', 'Elena Asesora España', '$2a$10$WSUZrBIIgM2IZ4DjNMXxkOo2dBdnrFLRyuHqY.o/iFVov3vGzbaqe', 'asesor', 'España',
    (SELECT id FROM usuarios WHERE email = 'sup.espana@oratioo.local'), true),
  ('asesor3.espana@oratioo.local', 'Javier Asesor España', '$2a$10$WSUZrBIIgM2IZ4DjNMXxkOo2dBdnrFLRyuHqY.o/iFVov3vGzbaqe', 'asesor', 'España',
    (SELECT id FROM usuarios WHERE email = 'sup.espana@oratioo.local'), true)
ON CONFLICT (email) DO NOTHING;

-- Back Office
INSERT INTO usuarios (email, nombre, password_hash, rol, equipo, activo)
VALUES ('backoffice@oratioo.local', 'Sofía BackOffice', '$2a$10$WSUZrBIIgM2IZ4DjNMXxkOo2dBdnrFLRyuHqY.o/iFVov3vGzbaqe', 'back_office', 'Perú', true)
ON CONFLICT (email) DO NOTHING;

-- IT
INSERT INTO usuarios (email, nombre, password_hash, rol, equipo, activo)
VALUES ('it@oratioo.local', 'Roberto IT', '$2a$10$WSUZrBIIgM2IZ4DjNMXxkOo2dBdnrFLRyuHqY.o/iFVov3vGzbaqe', 'it', NULL, true)
ON CONFLICT (email) DO NOTHING;
