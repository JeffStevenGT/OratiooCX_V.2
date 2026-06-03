-- Oratioo CX — Migración: Detección de Cambios
-- Branch: submaster

CREATE TABLE IF NOT EXISTS detecciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente),
    proyecto_id BIGINT NOT NULL DEFAULT 1,
    tipo TEXT NOT NULL,
        CHECK (tipo IN (
            'linea_nueva', 'linea_eliminada',
            'renove_nuevo', 'renove_cambio',
            'permanencia_vencida', 'permanencia_cambio',
            'consumo_cambio',
            'estado_cambio',
            'cima_nuevo', 'cima_perdido',
            'tv_nuevo', 'tv_perdido',
            'cliente_recuperado', 'cliente_perdido',
            'paquete_cambio'
        )),
    linea_numero TEXT,                   -- NULL si es cambio global (cliente_perdido, etc)
    valor_anterior TEXT,
    valor_nuevo TEXT,
    datos_extra JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_detecciones_cliente ON detecciones (id_cliente, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_detecciones_tipo ON detecciones (tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_detecciones_linea ON detecciones (linea_numero);
