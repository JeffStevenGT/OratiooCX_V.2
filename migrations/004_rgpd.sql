-- Oratioo CX — Migración: Campos RGPD (WhatsApp)
-- Branch: submaster

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS whatsapp_numero TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS whatsapp_opt_in_fecha TIMESTAMPTZ;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS alertas_fidelizacion BOOLEAN DEFAULT false;
