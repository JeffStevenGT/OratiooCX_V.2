-- Oratioo CX — Migración: Máquinas
-- Branch: submaster

-- ═══════════════════════════════════════════
-- 10. MÁQUINAS (Workers distribuidos)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS maquinas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,           -- "vps-espana-1" | "laptop-jeff"
    ip TEXT,                               -- IP de la máquina
    workers_max INT DEFAULT 5,            -- Workers máximos simultáneos
    workers_activos INT DEFAULT 0,        -- Workers corriendo ahora (heartbeat)
    ultimo_heartbeat TIMESTAMPTZ,         -- Última vez que reportó
    estado TEXT DEFAULT 'offline',         -- online | offline | degraded
        CHECK (estado IN ('online','offline','degraded')),
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insertar máquina local por defecto
INSERT INTO maquinas (nombre, ip, workers_max, estado, notas)
VALUES ('localhost', '127.0.0.1', 10, 'offline', 'Máquina local de desarrollo')
ON CONFLICT (nombre) DO NOTHING;
