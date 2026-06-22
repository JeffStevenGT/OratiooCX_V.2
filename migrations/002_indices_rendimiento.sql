-- Migración: Índices de Rendimiento para OratiooCX_V.2
-- ======================================================
-- Ejecutar contra la BD de producción. Todos los índices
-- usan IF NOT EXISTS para ser idempotentes.
--
-- Columnas objetivo: las más filtradas en WHERE, JOIN y ORDER BY
-- según auditoría de 59 endpoints API (Jun 2026).

-- ===========================================
-- clientes_proyectos (tabla más caliente: 14+ endpoints)
-- ===========================================

-- Búsqueda por proyecto + estado (next-dni, pipeline GET, reset-stale)
CREATE INDEX IF NOT EXISTS idx_cp_proyecto_estado
  ON clientes_proyectos (proyecto_id, (datos->>'estado'));

-- JOIN con clientes por id_cliente dentro de un proyecto
CREATE INDEX IF NOT EXISTS idx_cp_proyecto_cliente
  ON clientes_proyectos (proyecto_id, id_cliente);

-- JSONB GIN: acelera consultas con ->, ->>, @>, ? sobre datos
CREATE INDEX IF NOT EXISTS idx_cp_datos_gin
  ON clientes_proyectos USING GIN (datos jsonb_path_ops);

-- Ordenación por fecha de extracción (clients list, pipeline pool)
CREATE INDEX IF NOT EXISTS idx_cp_ultima_extraccion
  ON clientes_proyectos (proyecto_id, ultima_extraccion DESC NULLS LAST);

-- ===========================================
-- pipeline (asignaciones de leads)
-- ===========================================

-- Filtro principal: proyecto + soft-delete + estado
CREATE INDEX IF NOT EXISTS idx_pl_proyecto_activo_estado
  ON pipeline (proyecto_id, deleted_at, estado)
  WHERE deleted_at IS NULL;

-- Vista de jefe/supervisor: mis leads asignados
CREATE INDEX IF NOT EXISTS idx_pl_asesor_proyecto
  ON pipeline (asesor_id, proyecto_id, estado)
  WHERE deleted_at IS NULL;

-- JOIN con clientes_proyectos por id_cliente
CREATE INDEX IF NOT EXISTS idx_pl_cliente_proyecto
  ON pipeline (id_cliente, proyecto_id)
  WHERE deleted_at IS NULL;

-- Estadísticas por fecha de creación
CREATE INDEX IF NOT EXISTS idx_pl_created_proyecto
  ON pipeline (proyecto_id, created_at)
  WHERE deleted_at IS NULL;

-- ===========================================
-- historial (detecciones, intentos, tipificaciones)
-- ===========================================

-- JOIN LATERAL en estadísticas: buscar primer evento por cliente
CREATE INDEX IF NOT EXISTS idx_hist_cliente_proyecto_tipo
  ON historial (id_cliente, proyecto_id, tipo, created_at);

-- Agregación de llamadas por proyecto + tipo + fecha
CREATE INDEX IF NOT EXISTS idx_hist_proyecto_tipo_fecha
  ON historial (proyecto_id, tipo, created_at);

-- Búsqueda por id_cliente con orden (ficha cliente)
CREATE INDEX IF NOT EXISTS idx_hist_cliente_fecha
  ON historial (id_cliente, created_at DESC);

-- ===========================================
-- usuarios (listados, equipos, dashboards)
-- ===========================================

-- Filtro principal: usuarios activos por equipo
CREATE INDEX IF NOT EXISTS idx_usuarios_activo_equipo
  ON usuarios (activo, equipo);

-- JOIN en estadísticas: filtrar solo asesores
CREATE INDEX IF NOT EXISTS idx_usuarios_rol
  ON usuarios (rol);

-- Búsqueda por supervisor (jerarquía)
CREATE INDEX IF NOT EXISTS idx_usuarios_supervisor
  ON usuarios (supervisor_id)
  WHERE activo = true;

-- ===========================================
-- pausas (tiempos operativos)
-- ===========================================

-- Cálculo de tiempo en pausa por usuario + fecha
CREATE INDEX IF NOT EXISTS idx_pausas_usuario_inicio
  ON pausas (usuario_id, inicio)
  WHERE fin IS NOT NULL;

-- ===========================================
-- cdr_vpbx (registros de llamadas)
-- ===========================================

-- Tiempo en llamada por asesor + fecha
CREATE INDEX IF NOT EXISTS idx_cdr_asesor_fecha
  ON cdr_vpbx (asesor_id, created);

-- ===========================================
-- detecciones (cambios detectados entre análisis)
-- ===========================================

-- JOIN con clientes para historial de cambios
CREATE INDEX IF NOT EXISTS idx_det_cliente_proyecto
  ON detecciones (id_cliente, proyecto_id, created_at DESC);

-- ===========================================
-- anuncios (tabla de comunicados internos)
-- ===========================================

-- (ya existen idx_anuncios_proyecto y idx_anuncios_tipo de 001_)
-- Añadir índice para proyectos activos ordenados por fecha
CREATE INDEX IF NOT EXISTS idx_anuncios_activo_fecha
  ON anuncios (activo, created_at DESC)
  WHERE activo = true;
