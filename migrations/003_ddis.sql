-- 003_ddis.sql — Catálogo de DDIs (números de salida) por provincia
-- Idempotente. Ejecutar: psql $DATABASE_URL -f migrations/003_ddis.sql
-- El motor de llamada elige un DDI 'activo' según la provincia del cliente.
-- estado: activo | spam | no_alta | pausado   (valores libres, según panel Orange)
-- tipo_llamada: manual | progresivo_cp | progresivo_base  (informativo)

CREATE TABLE IF NOT EXISTS ddis (
  id              SERIAL PRIMARY KEY,
  provincia       TEXT        NOT NULL,                -- nombre legible, ej "Madrid"
  codigo_prov     TEXT,                                -- 2 dígitos del CP, ej "28"
  prefijos        TEXT[]      NOT NULL DEFAULT '{}',   -- prefijos de fijo, ej {'91','81'}
  ddi             TEXT        NOT NULL UNIQUE,          -- número que ve el cliente
  outbound_id     TEXT,                                -- id del número en VPBX (lo usa updateExtension)
  campana         TEXT,
  tipo_llamada    TEXT,                                -- informativo (manual/progresivo_cp/progresivo_base)
  estado          TEXT        NOT NULL DEFAULT 'activo',
  proyecto_id     INTEGER,                             -- NULL = aplica a todos los proyectos
  fecha_alta      DATE,
  fecha_ultimo_uso DATE,                               -- dato inicial; en adelante se calcula de cdr_vpbx
  fecha_estado    DATE,
  comentarios     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Selección del motor: "dame un DDI activo de esta provincia"
CREATE INDEX IF NOT EXISTS idx_ddis_provincia_estado ON ddis (codigo_prov, estado);
-- Mapeo fijo→provincia por prefijo
CREATE INDEX IF NOT EXISTS idx_ddis_prefijos ON ddis USING GIN (prefijos);
-- Filtro por estado para la pantalla de gestión
CREATE INDEX IF NOT EXISTS idx_ddis_estado ON ddis (estado);
