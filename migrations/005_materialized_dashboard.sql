-- 005_materialized_dashboard.sql
-- Materialized view for dashboard KPIs (refreshes every 5 min)
-- Eliminates 8 live queries from /api/pipeline/estadisticas

-- 1. Materialized view: daily pipeline stats per project
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_pipeline_stats AS
SELECT
  pl.proyecto_id,
  pl.created_at::date as dia,
  EXTRACT(HOUR FROM pl.created_at)::int as hora,
  pl.asesor_id,
  COUNT(*)::int as total_asignados,
  COUNT(*) FILTER (WHERE pl.estado = 'pendiente')::int as pendientes,
  COUNT(*) FILTER (WHERE pl.estado = 'contactado')::int as contactados,
  COUNT(*) FILTER (WHERE pl.estado IN ('interesado','negociacion'))::int as interesados,
  COUNT(*) FILTER (WHERE pl.estado = 'venta')::int as ventas,
  COUNT(*) FILTER (WHERE pl.estado = 'no_interesa')::int as no_interesa,
  COUNT(*) FILTER (WHERE pl.estado = 'no_contesta')::int as no_contesta
FROM pipeline pl
WHERE pl.deleted_at IS NULL
GROUP BY pl.proyecto_id, dia, hora, pl.asesor_id;

-- 2. Index for fast date range + project lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_pipeline_stats
  ON mv_pipeline_stats (proyecto_id, dia, hora, asesor_id);

CREATE INDEX IF NOT EXISTS idx_mv_pipeline_stats_dia
  ON mv_pipeline_stats (proyecto_id, dia);

-- 3. Refresh function (called by cron or API)
CREATE OR REPLACE FUNCTION refresh_dashboard_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pipeline_stats;
END;
$$ LANGUAGE plpgsql;

-- 4. Initial refresh
REFRESH MATERIALIZED VIEW mv_pipeline_stats;
