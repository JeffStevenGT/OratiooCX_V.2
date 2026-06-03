# ORATIOO CX — Base de Datos (v3.0)

> Stack: PostgreSQL local (puerto 5433) → futuro VPS
> Migraciones: `supabase/001_migracion_inicial.sql` + `002_maquinas.sql`
> Actualizado: 03/06/2026

---

## 🗄️ Tablas

### `clientes` — Core del sistema
- `id_cliente TEXT PK` — `"DNI_12345678A"`, `"NIE_X1234567L"`, `"NIF_B12345678"`
- `tipo_documento` — DNI | NIE | NIF
- `numero_documento` — Solo dígitos + letra
- `nombre_razon_social` — Nombre visible
- `tipo_persona` — natural | autonomo | empresa
- `cnae`, `telefonos JSONB`, `emails JSONB`, `direccion JSONB`

### `proyectos` — Catálogo
- `orange` (id=1) — Orange Pangea
- `mainjobs` (id=2) — Mainjobs Cursos
- `impresoras` (id=3) — Impresoras y Equipos

### `clientes_proyectos` — Datos del bot por proyecto
- `id_cliente + proyecto_id` — Unique
- `datos JSONB` — Toda la data extraída (header, lineas, cima_global)
- `ultima_extraccion TIMESTAMPTZ`
- Índices: `cima_global`, `lineas` (GIN), `estado`, `ultima_extraccion`

### `historial` — Timeline único
- Tipos: llamada, extraccion, tipificacion, curso, compra, webhook_vpbx
- Triggers: `trigger_auditoria_pipeline`, `trigger_auditoria_extraccion`

### `pipeline` — Estados comerciales
- Estados: pendiente → contactado → interesado → negociacion → venta → tramitado → activado
- Salidas: no_interesa, no_contesta
- Soft delete (`deleted_at`)
- Vista: `pipeline_activos`

### `usuarios` — Auth + roles
- Roles: asesor, supervisor, jefe_area, back_office, it, desarrollador
- `equipo`, `supervisor_id`, `extension_vpbx`

### `cdr_vpbx` — Registro de llamadas
- `call_id UNIQUE`, `duration`, `billsec`, `hangup_cause`, `src`, `dst`, `recording`

### `comandos_bot` — Control remoto
- `maquina_destino` — Filtra comandos por máquina
- `comando` — iniciar, detener, pausar, reanudar
- `parametros JSONB` — { workers: 5 }
- Estados: pendiente → en_curso → completado/fallo

### `maquinas` — Catálogo de VPS (NUEVO v3.0)
- `nombre UNIQUE` — Identificador del coordinator
- `workers_max`, `workers_activos`, `ultimo_heartbeat`, `estado`
- Heartbeat vía `PATCH /api/maquinas` cada 30s

---

## 🔐 Funciones PostgreSQL

- `tomar_siguiente_dni(proyecto_id)` — FOR UPDATE SKIP LOCKED, atómico
- `log_pipeline_changes()` — Trigger de auditoría
- `log_extraccion_cliente()` — Trigger de extracción

---

## 📐 Índices críticos

```sql
-- JSONB en clientes_proyectos
idx_cp_datos_gin         -- GIN sobre todo datos
idx_cp_cima_global       -- B-Tree sobre datos->>'cima_global'
idx_cp_lineas_gin        -- GIN sobre datos->'lineas'
idx_cp_estado            -- B-Tree sobre datos->>'estado'
idx_cp_ultima_extraccion -- Orden por fecha

-- Pipeline
idx_pipeline_asesor
idx_pipeline_estado
idx_pipeline_callback    -- Parcial (WHERE callback_at IS NOT NULL)
```

---

## 🔮 Pendiente: Campos RGPD

```sql
ALTER TABLE clientes ADD COLUMN whatsapp_opt_in BOOLEAN DEFAULT false;
ALTER TABLE clientes ADD COLUMN whatsapp_numero TEXT;
ALTER TABLE clientes ADD COLUMN whatsapp_opt_in_fecha TIMESTAMPTZ;
```
