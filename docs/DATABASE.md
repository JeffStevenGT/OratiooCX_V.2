# DATABASE.md — Esquema de Base de Datos

## Motor

**PostgreSQL 14+** con soporte JSONB para datos semiestructurados del bot.

Conexión vía pool en `src/lib/db.ts`:

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // conexiones simultáneas
  idleTimeoutMillis: 30000,   // cierra inactivas tras 30s
  statement_timeout: 30000,   // mata queries >30s
});
```

---

## Tablas principales

### `clientes`

Datos maestros de clientes extraídos por el bot.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id_cliente` | `TEXT PK` | Identificador compuesto: `DNI_12345678A`, `NIE_X1234567B`, `NIF_C12345678` |
| `tipo_documento` | `TEXT` | `dni`, `nie`, `nif` |
| `numero_documento` | `TEXT` | Número limpio sin letra de prefijo |
| `nombre_razon_social` | `TEXT` | Nombre del cliente (extraído de Pangea o cargado manualmente) |
| `tipo_persona` | `TEXT` | `natural`, `autonomo`, `empresa` |
| `whatsapp_opt_in` | `BOOLEAN` | Consentimiento WhatsApp |
| `whatsapp_numero` | `TEXT` | Número para WhatsApp |
| `alertas_fidelizacion` | `BOOLEAN` | Alertas de fidelización activas |
| `created_at` | `TIMESTAMPTZ` | Fecha de creación |
| `updated_at` | `TIMESTAMPTZ` | Última actualización |
| `deleted_at` | `TIMESTAMPTZ` | Soft delete (RGPD) |

---

### `clientes_proyectos`

Datos del bot por proyecto. **Tabla más consultada** (14+ endpoints).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `SERIAL PK` | Clave primaria |
| `id_cliente` | `TEXT FK` | Referencia a `clientes.id_cliente` |
| `proyecto_id` | `INTEGER FK` | Referencia a `proyectos.id` |
| `datos` | `JSONB` | **Payload completo del bot**: header, lineas, estado, version_extraccion, cima_global |
| `ultima_extraccion` | `TIMESTAMPTZ` | Fecha de última extracción |
| `created_at` | `TIMESTAMPTZ` | Fecha de creación |
| `updated_at` | `TIMESTAMPTZ` | Última actualización (usado por `touch` y rescate) |

**Estructura del JSONB `datos`:**

```json
{
  "estado": "completado",
  "header": {
    "nombre": "Juan Pérez",
    "dni": "12345678A",
    "paquete": "Love Sin Límites",
    "direccion": "Calle Mayor 1, Madrid"
  },
  "lineas": [
    {
      "numero": "612345678",
      "producto": "Móvil",
      "etiquetas": ["CIMA", "Renove"],
      "estado": {"hotline": false, "suspendida": false, "impago": false},
      "tiene_renove": true,
      "variante_renove": "Renove mixto al mejor precio",
      "tiene_tv": false,
      "es_cima": true,
      "permanencia": "Vence 12/2026",
      "consumo": "Alto",
      "venta_plazos": "No activa",
      "campanas_extra": ["Navidad 2025"]
    }
  ],
  "cima_global": true,
  "version_extraccion": 1,
  "primera_extraccion_at": "2026-06-15T10:30:00Z"
}
```

**Índices:**
- `idx_cp_proyecto_estado` — `(proyecto_id, (datos->>'estado'))`
- `idx_cp_proyecto_cliente` — `(proyecto_id, id_cliente)`
- `idx_cp_datos_gin` — GIN sobre `datos` (jsonb_path_ops)
- `idx_cp_ultima_extraccion` — `(proyecto_id, ultima_extraccion DESC)`

---

### `pipeline`

Asignaciones de leads a asesores.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `SERIAL PK` | Clave primaria |
| `id_cliente` | `TEXT FK` | Referencia a `clientes.id_cliente` |
| `proyecto_id` | `INTEGER FK` | Proyecto |
| `asesor_id` | `INTEGER FK` | Asesor asignado |
| `estado` | `TEXT` | `pendiente`, `contactado`, `interesado`, `negociacion`, `venta`, `no_interesa`, `no_contesta` |
| `notas` | `TEXT` | Notas del asesor |
| `ultimo_cambio` | `TIMESTAMPTZ` | Último cambio de estado |
| `created_at` | `TIMESTAMPTZ` | Fecha de asignación |
| `deleted_at` | `TIMESTAMPTZ` | Soft delete (liberación) |

**Índices parciales (WHERE deleted_at IS NULL):**
- `idx_pl_proyecto_activo_estado` — `(proyecto_id, estado)`
- `idx_pl_asesor_proyecto` — `(asesor_id, proyecto_id, estado)`
- `idx_pl_cliente_proyecto` — `(id_cliente, proyecto_id)`
- `idx_pl_created_proyecto` — `(proyecto_id, created_at)`

---

### `usuarios`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `SERIAL PK` | Clave primaria |
| `email` | `TEXT UNIQUE` | Email de login |
| `nombre` | `TEXT` | Nombre completo |
| `password_hash` | `TEXT` | Hash bcrypt (10 rondas) |
| `rol` | `TEXT` | `jefe_area`, `supervisor`, `asesor`, `back_office`, `it`, `auditor_calidad`, `desarrollador` |
| `equipo` | `TEXT` | `España`, `Perú`, `Administración` |
| `supervisor_id` | `INTEGER FK` | Supervisor a cargo |
| `extension_vpbx` | `TEXT` | Extensión VoIP |
| `fecha_nacimiento` | `DATE` | Para anuncios de cumpleaños |
| `activo` | `BOOLEAN` | Soft delete |
| `ultima_conexion` | `TIMESTAMPTZ` | Último login |
| `created_at` | `TIMESTAMPTZ` | Fecha de creación |
| `updated_at` | `TIMESTAMPTZ` | Última actualización |

---

### `historial`

Registro de auditoría: asignaciones, extracciones, llamadas, tipificaciones.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `SERIAL PK` | Clave primaria |
| `id_cliente` | `TEXT` | Cliente |
| `proyecto_id` | `INTEGER` | Proyecto |
| `tipo` | `TEXT` | `asignacion`, `reasignacion`, `extraccion`, `llamada`, `tipificacion`, `rgpd_olvido` |
| `asesor_id` | `INTEGER` | Asesor involucrado |
| `descripcion` | `TEXT` | Descripción legible |
| `datos` | `JSONB` | Metadatos (resultado llamada, versión extracción, etc.) |
| `created_at` | `TIMESTAMPTZ` | Fecha del evento |

---

### `detecciones`

Cambios detectados entre análisis consecutivos del bot.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `SERIAL PK` | Clave primaria |
| `id_cliente` | `TEXT` | Cliente |
| `proyecto_id` | `INTEGER` | Proyecto |
| `tipo` | `TEXT` | `renove_nuevo`, `renove_cambio`, `cima_nuevo`, `cima_perdido`, `permanencia_vencida`, `consumo_cambio`, `estado_cambio`, `tv_nuevo`, `linea_nueva`, `linea_eliminada`, `cliente_recuperado`, `cliente_perdido` |
| `linea_numero` | `TEXT` | Número de línea afectada |
| `valor_anterior` | `TEXT` | Valor antes del cambio |
| `valor_nuevo` | `TEXT` | Valor después del cambio |
| `datos_extra` | `JSONB` | Metadatos adicionales |
| `created_at` | `TIMESTAMPTZ` | Fecha de detección |

---

### `proyectos`

Configuración multi-proyecto.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `SERIAL PK` | Clave primaria |
| `nombre` | `TEXT UNIQUE` | Slug interno (`orange`, `energia`) |
| `nombre_visible` | `TEXT` | Nombre para el frontend |
| `activo` | `BOOLEAN` | Proyecto activo |
| `config` | `JSONB` | Configuración: campos_lead, metas, cooldown, logo_url |
| `created_at` | `TIMESTAMPTZ` | Fecha de creación |

---

### Tablas auxiliares

| Tabla | Descripción |
|-------|-------------|
| `pausas` | Registro de pausas de asesores (inicio, fin, duracion_segundos, tipo) |
| `cdr_vpbx` | Registros de llamadas VoIP (origen, destino, billsec, grabación) |
| `anuncios` | Comunicados internos por proyecto (tipo, roles_visibles) |
| `anuncios_leidos` | Tracking de anuncios leídos por usuario |
| `metas` | Metas individuales por asesor (valor_objetivo, mes, anyo) |
| `qa_evaluaciones` | Evaluaciones de calidad (puntaje, auditor_id) |
| `fichajes` | Registro horario (entrada, salida, tipo) |
| `configuracion` | Parámetros globales (key-value) |
| `proxies` | Lista de proxies para el bot |
| `listas_negras` | DNIs excluidos |

---

## Migraciones

Ejecutar en orden numérico:

```bash
psql $DATABASE_URL -f migrations/001_cumpleanos_anuncios.sql
psql $DATABASE_URL -f migrations/002_indices_rendimiento.sql
```

Todas las migraciones usan `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` — son idempotentes.
