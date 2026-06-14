# Oratioo CX — Plan de Implementación

> **Versión:** 5.3 | **Fecha:** 12 Junio 2026
> **Estado:** 80% completado | **Horas invertidas:** ~370h de ~463h estimadas

---

## 1. Resumen Ejecutivo

Oratioo CX se construyó en 8 fases a lo largo de 16 semanas, desde el 19 de Mayo de 2026. El proyecto siguió una metodología ágil con entregas incrementales: cada fase agregaba una capa de funcionalidad sin romper lo existente.

```
Fase 1: Fundación        ████████████████████  100%  Semanas 1-2
Fase 2: Bot Extracción   ████████████████████  100%  Semanas 3-4
Fase 3: CRM Core         ████████████████████  100%  Semanas 5-7
Fase 4: VPBX y Discador  ████████████████████  100%  Semanas 8-9
Fase 5: Dashboards       ████████████████████  100%  Semana 10
Fase 6: Inteligencia     ████████████████████  100%  Semanas 11-12
Fase 7: Ajustes Yone     ████████████████████  100%  Semanas 13-14
Fase 8: Hardening v5.3   ██████████████░░░░░░   75%  Semanas 15-16 ← ACTUAL
```

---

## 2. Fase 1 — Fundación (Semanas 1-2)

**Objetivo:** Infraestructura base y autenticación.

### Semana 1: Setup y Base de Datos ✅

| Tarea | Estado | Horas |
|-------|--------|-------|
| Configurar Next.js 15 + TypeScript + Tailwind | ✅ | 4h |
| Instalar PostgreSQL 16 local (puerto 5433) | ✅ | 2h |
| Crear BD `oratioo_cx` | ✅ | 0.5h |
| Migración 001: tablas core (clientes, pipeline, historial, usuarios, proyectos) | ✅ | 6h |
| Seed de 18 usuarios con 7 roles y 3 proyectos | ✅ | 2h |
| Pool de conexiones pg (max 20, 30s timeout) | ✅ | 1h |
| **Total Semana 1** | | **15.5h** |

### Semana 2: Autenticación y Navegación ✅

| Tarea | Estado | Horas |
|-------|--------|-------|
| NextAuth.js v5 con Credentials Provider + JWT | ✅ | 6h |
| bcrypt hashing (10 rondas) + validación complejidad | ✅ | 2h |
| Página de login con diseño glass-morphism | ✅ | 4h |
| Middleware RBAC con mapa de rutas por rol | ✅ | 5h |
| Sidebar con iconos Lucide, menú adaptable por rol | ✅ | 6h |
| Página de inicio con bienvenida según rol | ✅ | 3h |
| **Total Semana 2** | | **26h** |
| **Total Fase 1** | | **41.5h** |

---

## 3. Fase 2 — Bot de Extracción (Semanas 3-4)

**Objetivo:** Automatizar la extracción de datos desde Orange Pangea.

### Semana 3: Bot Python Base ✅

| Tarea | Estado | Horas |
|-------|--------|-------|
| Configurar Playwright + Chromium headless | ✅ | 4h |
| Carga de 20 proxies españoles desde proxies.txt | ✅ | 2h |
| Script login.py: cookies, formulario, credenciales | ✅ | 8h |
| Navegación: seleccionar marca Orange, acto comercial | ✅ | 4h |
| Extracción básica: nombre, paquete, línea principal | ✅ | 6h |
| Guardar resultado via POST a API Next.js | ✅ | 3h |
| **Total Semana 3** | | **27h** |

### Semana 4: Bot Avanzado ✅

| Tarea | Estado | Horas |
|-------|--------|-------|
| Extracción por líneas (iterar .client-tariff-flex) | ✅ | 8h |
| Detección CIMA (badge en heading) | ✅ | 3h |
| Detección Renove (click en pestaña, leer tarjeta) | ✅ | 6h |
| 6 tipos de Renove con códigos de color | ✅ | 4h |
| Watchdog 40s por DNI | ✅ | 3h |
| Coordinator daemon (coordinator_loop.py) | ✅ | 10h |
| Worker loop continuo (worker_loop.py) | ✅ | 8h |
| API bot-sync (POST /api/internal/bot-sync) | ✅ | 6h |
| Sistema de rescate de DNIs atascados | ✅ | 4h |
| **Total Semana 4** | | **52h** |
| **Total Fase 2** | | **79h** |

---

## 4. Fase 3 — CRM Core (Semanas 5-7)

**Objetivo:** Pipeline comercial, dashboards y gestión de datos.

### Semana 5: Páginas de Datos ✅

| Tarea | Estado | Horas |
|-------|--------|-------|
| Página Clientes: tabla 9 columnas, filtros, export CSV | ✅ | 10h |
| Ficha cliente modal 360° con tabs (Datos, Pipeline, Llamadas) | ✅ | 8h |
| Página Documentos: upload, cola de procesamiento | ✅ | 6h |
| Deduplicación al subir lotes (CSV/Excel) | ✅ | 4h |
| Página Proyectos: CRUD multi-proyecto | ✅ | 6h |
| **Total Semana 5** | | **34h** |

### Semana 6: Pipeline Comercial ✅

| Tarea | Estado | Horas |
|-------|--------|-------|
| Estados pipeline: pendiente → contactado → interesado → negociación → venta | ✅ | 6h |
| Asignar leads: pool, selección múltiple, round-robin | ✅ | 8h |
| API pipeline completa (CRUD + filtros) | ✅ | 8h |
| Dashboard Asesor: Mis Leads con tabla y filtros CIMA/Renove | ✅ | 6h |
| Pipeline v2: intentos, sub-estados, cooldown 48h | ✅ | 6h |
| Tipificación: modal con estados + sub-estados dinámicos | ✅ | 8h |
| **Total Semana 6** | | **42h** |

### Semana 7: Dashboards de Gestión ✅

| Tarea | Estado | Horas |
|-------|--------|-------|
| Dashboard Supervisor: LivePanel, drill-down, reasignación | ✅ | 12h |
| Dashboard Jefe: funnel pipeline, comparativa equipos | ✅ | 8h |
| Estadísticas: KPIs, gráficos Recharts, export CSV | ✅ | 8h |
| Auditoría: timeline con filtros por fecha/tipo | ✅ | 6h |
| Metas: ranking con barras de progreso | ✅ | 6h |
| Alertas: centro de notificaciones (sin asignar, por vencer, máquinas offline) | ✅ | 6h |
| **Total Semana 7** | | **46h** |
| **Total Fase 3** | | **122h** |

---

## 5. Fase 4 — VPBX y Discador (Semanas 8-9)

**Objetivo:** Integrar telefonía VoIP y construir el Power Dialer.

### Semana 8: Integración VPBX ✅

| Tarea | Estado | Horas |
|-------|--------|-------|
| Análisis API VPBX (doc.vpbx.me/api) | ✅ | 4h |
| Librería vpbx.ts: 14 funciones | ✅ | 8h |
| Endpoint originate: POST /api/vpbx/originate | ✅ | 6h |
| Webhooks VPBX: RINGING, ANSWERED, HANGUP → cdr_vpbx | ✅ | 8h |
| CDR Sync con filtros y paginación | ✅ | 4h |
| Variables CDR: POST /api/vpbx/cdr/[id]/vars | ✅ | 3h |
| LivePanel con estados reales de VPBX | ✅ | 8h |
| **Total Semana 8** | | **41h** |

### Semana 9: Power Dialer y Extensiones ✅

| Tarea | Estado | Horas |
|-------|--------|-------|
| Power Dialer UI completa: tarjeta lead + líneas + botones llamar | ✅ | 12h |
| Click2Call con feedback visual en tiempo real | ✅ | 6h |
| Modal de resultado post-llamada (4 opciones) | ✅ | 4h |
| Modal de tipificación con estados/sub-estados dinámicos | ✅ | 6h |
| Navegación Anterior/Siguiente entre leads | ✅ | 3h |
| Gestión de extensiones: API + UI | ✅ | 6h |
| Página VPBX: tabs Extensiones + Agentes | ✅ | 6h |
| Campo extension_vpbx en usuarios | ✅ | 2h |
| Sidebar + middleware VPBX | ✅ | 2h |
| **Total Semana 9** | | **47h** |
| **Total Fase 4** | | **88h** |

---

## 6. Fase 5 — Dashboards y Reportes (Semana 10)

**Objetivo:** Completar todos los dashboards y herramientas de monitoreo.

### Semana 10: Dashboards Completos ✅

| Tarea | Estado | Horas |
|-------|--------|-------|
| Dashboard Back Office: pendientes/tramitados + activación | ✅ | 6h |
| Dashboard Admin: métricas del sistema | ✅ | 4h |
| Dashboard QA: rúbrica 5 criterios + resumen | ✅ | 8h |
| Configuración dinámica clave-valor | ✅ | 4h |
| Listas negras con export CSV | ✅ | 4h |
| Tipificaciones configurables por proyecto | ✅ | 6h |
| **Total Fase 5** | | **32h** |

---

## 7. Fase 6 — Inteligencia Comercial (Semanas 11-12)

**Objetivo:** Scoring automático de leads, forecast y gamificación.

### Semana 11: Scoring y Forecast ✅

| Tarea | Estado | Horas |
|-------|--------|-------|
| Scoring Orange: 14 factores (CIMA, Renove, TV, permanencia, etc.) | ✅ | 10h |
| Página Inteligencia: UI scoring + gráficos distribución | ✅ | 6h |
| Función PL/pgSQL: calcular_scoring_lead() | ✅ | 4h |
| Función PL/pgSQL: calcular_scoring_masivo() | ✅ | 3h |
| Forecast ventas: leads × contactab × efectiv con intervalos | ✅ | 8h |
| UI Forecast: gráfico con intervalo de confianza | ✅ | 4h |
| **Total Semana 11** | | **35h** |

### Semana 12: Cinturones y Notificaciones ✅

| Tarea | Estado | Horas |
|-------|--------|-------|
| Sistema de cinturones: 4 niveles (Blanco/Azul/Marrón/Faixa Preta) | ✅ | 6h |
| Función PL/pgSQL: cinturon_actual() | ✅ | 3h |
| Métricas diarias: snapshot automático por asesor | ✅ | 5h |
| Notificaciones supervisor: 7 tipos con umbrales | ✅ | 6h |
| Scoring contacto (Yone): historial + compras | ✅ | 6h |
| Página Rendimiento: ranking, cinturones, tendencias, heatmap | ✅ | 8h |
| **Total Semana 12** | | **34h** |
| **Total Fase 6** | | **69h** |

---

## 8. Fase 7 — Ajustes Yone (Semanas 13-14)

**Objetivo:** Ajustes finos basados en feedback de los stakeholders (criterios Yone).

### Semana 13: Ajustes Scoring y Métricas ✅

| Tarea | Estado | Horas |
|-------|--------|-------|
| Ajustar umbrales scoring según criterios Yone | ✅ | 4h |
| Métricas de abandono (Robinson, no contesta, no interesa, fallecidos) | ✅ | 4h |
| Tasa de reutilización de registros | ✅ | 3h |
| Reportes HTML imprimibles (4 tipos) | ✅ | 6h |
| Umbrales de notificación ajustados (caída >15-20%) | ✅ | 3h |
| **Total Semana 13** | | **20h** |

### Semana 14: Integración Final ✅

| Tarea | Estado | Horas |
|-------|--------|-------|
| WhatsApp: integración Meta Cloud API + plantillas | ✅ | 8h |
| Webhook WhatsApp entrante | ✅ | 4h |
| Chat WhatsApp en Power Dialer | ✅ | 4h |
| Renove automático (WhatsApp si opt-in) | ✅ | 3h |
| **Total Semana 14** | | **19h** |
| **Total Fase 7** | | **39h** |

---

## 9. Fase 8 — Hardening v5.3 (Semanas 15-16) ← EN PROGRESO

**Objetivo:** Estabilización, rendimiento, seguridad y UX.

### Semana 15 ✅

| Tarea | Estado | Horas |
|-------|--------|-------|
| Eliminar dependencia Supabase (migración total a PostgreSQL local) | ✅ | 8h |
| Auth en endpoints que estaban sin proteger (compras, máquinas, proyectos) | ✅ | 6h |
| Soft-delete en compras (en vez de DELETE físico) | ✅ | 2h |
| Workers con límite de reinicio (máx 5/hora) | ✅ | 3h |
| proyecto_id dinámico en bot (no hardcodeado = 1) | ✅ | 3h |
| Redis: rate limiting Click2Call, webhook queue, cache | ✅ | 6h |
| Fallback automático sin Redis (memoria) | ✅ | 3h |
| **Total Semana 15** | | **31h** |

### Semana 16 ← ACTUAL

| Tarea | Estado | Horas |
|-------|--------|-------|
| Sistema de pausas: BD + API + Power Dialer full-screen + LivePanel colores | ✅ | 10h |
| Sidebar v2: acordeón real + badges rojos + jerarquía visual | ✅ | 8h |
| Reorganización sidebar: secciones redistribuidas | ✅ | 4h |
| Multi-proyecto: campos lead dinámicos, logo, CRUD proyectos | ✅ | 8h |
| Pipeline multi-proyecto: filtro por proyecto_id en todas las APIs | ✅ | 6h |
| Asignar Leads v3: chips por jerarquía (CEO→Jefe→Sup→Asesor) | ✅ | 8h |
| Paginación unificada (Paginator component) | ✅ | 4h |
| Configuración de proyectos via overlay en /inicio | ✅ | 4h |
| **Fichaje electrónico (RD-ley 8/2019): BD + 3 API + página + sidebar + offline** | ✅ | **21h** |
| Cumplimiento normativo: modalidad presencial/remoto (Ley 10/2021), edge case desactivación | ✅ | 3h |
| Documentación completa (PRD, TRD, Flujo App, UX/UI, Backend, Plan) | ✅ | 8h |
| Actualizar CLAUDE.md con todos los cambios | ✅ | 2h |
| **Total Semana 16** | | **83h** |
| **Total Fase 8** | | **114h** |

---

## 9. Fase 9 — Planillas y Contratos (Planificado)

**Objetivo:** Gestionar contratos laborales y generar planillas desde los fichajes.
**Base existente:** usuarios, fichajes, pausas, documentos, historial, RBAC.
**Prioridad:** P1 (siguiente fase después del deploy)

### Arquitectura preparada

```
fichajes (entrada/salida) ─┐
pausas (descansos)        ─┤
                          ├──→ Cálculo automático → planillas.horas_trabajadas
usuarios.jornada_semanal  ─┘

contratos ───→ alta / renovación / modificación / baja
planillas ───→ generación mensual desde fichajes acumulados
```

### Tareas estimadas

| # | Tarea | Horas |
|---|-------|-------|
| 1 | Migración: tablas `empleados`, `contratos`, `planillas` | 3h |
| 2 | API contratos: CRUD + upload de PDF firmado | 6h |
| 3 | API planillas: generación automática desde fichajes + pausas | 5h |
| 4 | Página Contratos: tabla + subir/bajar PDF + estados (activo/finalizado) | 6h |
| 5 | Página Planillas: vista empleado (sus nóminas) + vista supervisor (todas) | 6h |
| 6 | Página Empleados: extensión de usuarios con datos laborales (SS, categoría, IBAN) | 6h |
| 7 | Export PDF/CSV de planillas para contabilidad | 4h |
| 8 | Sidebar + middleware + breadcrumb | 2h |
| 9 | Documentación y pruebas | 2h |
| **Total** | | **40h** |

### Qué cubre

| Funcionalidad | Descripción |
|---------------|-------------|
| Contratos | Alta, renovación, modificación y baja con PDF almacenado |
| Planillas | Cálculo automático de horas desde fichajes + pausas; salario base, horas extra, bonificaciones, deducciones, bruto/neto |
| Empleados | Datos laborales: tipo de contrato, seguridad social, categoría, salario, IBAN |
| Export | Nómina mensual en CSV/PDF lista para contabilidad o inspección |

### Qué NO cubre (fases futuras)

| Funcionalidad | Nota |
|---------------|------|
| Firma digital de contratos | Requiere integración con proveedor externo (~20h adicionales) |
| Envío automático a Seguridad Social | No hay API directa; se exporta e ingresa manualmente |
| Cálculo de IRPF | Depende de la situación fiscal de cada empleado; se ingresa manualmente |
| Integración con software de nóminas externo | Se puede añadir como conector específico |

---

## 10. Pendientes y Backlog

### 10.1 Bugs Conocidos

| ID | Bug | Severidad | Estado |
|----|-----|-----------|--------|
| — | No hay bugs conocidos activos | — | ✅ |

### 10.2 Mejoras Pendientes (P2-P3)

| ID | Mejora | Prioridad | Estimación |
|----|--------|-----------|------------|
| FEAT-01 | Export Excel avanzado (varios formatos) | P2 | 4h |
| FEAT-02 | Chat interno entre roles | P2 | 8h |
| FEAT-03 | WebSocket App VPBX (bot de voz IA) | P2 | 20h |
| FEAT-04 | Email/SMTP para notificaciones y reportes | P3 | 6h |
| FEAT-05 | Integración SICA (sincronización de ventas) | P3 | 12h |
| FEAT-06 | Modo oscuro en gráficos Recharts (mejora) | P3 | 3h |
| FEAT-07 | Tests automatizados (Jest + Playwright) | P3 | 16h |
| FEAT-08 | CI/CD pipeline (GitHub Actions) | P3 | 8h |
| FEAT-09 | Monitoreo y alertas del sistema (CPU, RAM, errores) | P3 | 8h |
| FEAT-10 | Dashboard de KPIs en tiempo real (WebSocket) | P3 | 12h |

### 10.3 Proyectos Futuros

| Proyecto | Descripción | Estimación | Prioridad |
|----------|-------------|------------|-----------|
| **Planillas y Contratos** | Gestión de contratos laborales + generación de planillas desde fichajes | 40h | P1 |
| **Repsol** | Venta de luz y gas (proyecto futuro) | 60h | P2 |

---

## 11. Métricas del Proyecto

### 11.1 Código

| Métrica | Cantidad |
|---------|----------|
| Archivos TypeScript/TSX | ~90 |
| Líneas de código frontend | ~25,000 |
| Líneas de código API | ~8,000 |
| Archivos Python (bot) | 9 |
| Líneas de código Python | ~3,500 |
| Archivos SQL (migraciones) | 20+ |
| **Total líneas estimadas** | **~40,000** |

### 11.2 Base de Datos

| Métrica | Cantidad |
|---------|----------|
| Tablas | 30 |
| Funciones PL/pgSQL | 11 |
| Vistas | 2 |
| Triggers | 4 |
| Índices | 20+ |
| Migraciones | 20+ |

### 11.3 API

| Métrica | Cantidad |
|---------|----------|
| Endpoints totales | 59 |
| Endpoints públicos | 5 |
| Endpoints protegidos por API key | 6 |
| Endpoints protegidos por RBAC | 48 |

### 11.4 Frontend

| Métrica | Cantidad |
|---------|----------|
| Páginas (routes) | 81 |
| Páginas de dashboard | 21 |
| Componentes compartidos | 16 |
| Roles de usuario | 7 |

### 11.5 Tiempo

| Métrica | Cantidad |
|---------|----------|
| Semanas totales | 16 |
| Horas estimadas totales | 463h |
| Horas invertidas (real) | ~370h |
| Horas restantes | ~93h (Fase 8) |
| **Completado** | **~80%** |

---

## 12. Hitos (Milestones)

| # | Hito | Fecha | Estado |
|---|------|-------|--------|
| M1 | Primer login funcional | 22 May 2026 | ✅ |
| M2 | Bot extrae primer DNI completo | 29 May 2026 | ✅ |
| M3 | Primer lead asignado y tipificado | 5 Jun 2026 | ✅ |
| M4 | Primera llamada Click2Call desde CRM | 8 Jun 2026 | ✅ |
| M5 | Dashboard supervisor con LivePanel | 9 Jun 2026 | ✅ |
| M6 | Scoring + Forecast funcional | 10 Jun 2026 | ✅ |
| M7 | Multi-proyecto + Sidebar v2 | 10 Jun 2026 | ✅ |
| M8 | Documentación completa | 12 Jun 2026 | 🔄 |
| M9 | Deploy a producción (Hetzner + Plesk) | — | ⏳ Pendiente |
| M10 | Go-live con equipo real | — | ⏳ Pendiente |

---

## 13. Despliegue a Producción (Plan)

### 13.1 Checklist Pre-Deploy

- [ ] Migraciones ejecutadas en BD de producción
- [ ] Variables de entorno configuradas en VPS
- [ ] SSL configurado (Let's Encrypt)
- [ ] Nginx reverse proxy configurado
- [ ] Backup automático configurado (pg_dump diario)
- [ ] Monitoreo configurado (Plesk healthchecks)
- [ ] Bot API key configurada en máquinas de producción
- [ ] Proxies españoles cargados en BD
- [ ] Credenciales Pangea cargadas en BD
- [ ] Usuarios reales creados
- [ ] Proyecto Orange configurado
- [ ] VPBX API key configurada
- [ ] WhatsApp token configurado (si aplica)

### 13.2 Comandos de Deploy

```bash
# En VPS Hetzner (Plesk auto-deploy desde Git):
git push origin submaster

# Plesk automáticamente:
# 1. git pull
# 2. npm install
# 3. next build
# 4. next start (puerto 3000)
# 5. Nginx reverse proxy :80/:443 → :3000
```

### 13.3 Rollback

```bash
git revert <commit>
git push origin submaster
# Plesk redespliega automáticamente
```

---

## 14. Lecciones Aprendidas

1. **API-first paga dividendos** — El bot nunca toca la BD directamente, solo via API. Esto evitó problemas de concurrencia y permitió cambiar la BD sin tocar el bot.

2. **FOR UPDATE SKIP LOCKED es oro** — La toma atómica de DNIs evita que dos workers procesen el mismo lead simultáneamente.

3. **JSONB es el amigo flexible** — Los datos del bot cambian por proyecto. JSONB en `clientes_proyectos.datos` permite evolucionar sin migraciones.

4. **El sidebar merece diseño** — La v1 era un menú plano. La v2 con acordeón, jerarquía visual y badges rojos transformó la experiencia.

5. **No hardcodear proyecto_id** — Pasamos de `WHERE proyecto_id = 1` a `WHERE proyecto_id = $1` en toda la codebase. Dolió, pero era necesario.

6. **Redis como opt-in** — El fallback a memoria permite que el sistema funcione sin Redis. Ideal para desarrollo y para reducir dependencias.

7. **El bot en PC local funciona** — Separar bot y CRM fue la decisión correcta. Cada uno escala independientemente.

8. **Documentar sobre la marcha** — CLAUDE.md se mantuvo actualizado durante todo el desarrollo. Ahora es la fuente de verdad del proyecto.

---

## 15. Próximos Pasos (Después de Fase 8)

1. **Deploy a producción** — VPS Hetzner CPX41 + Plesk
2. **Pruebas con usuarios reales** — 8 asesores + 3 supervisores
3. **Ajustes post-go-live** — Feedback real del equipo
4. **Mainjobs** — Siguiente proyecto a activar
5. **Monitorización** — Configurar alertas de uptime y errores
6. **Iteración continua** — Mejoras basadas en datos reales de uso

---

## 16. Cumplimiento Normativo del Fichaje Electrónico

### 16.1 Marco Legal Aplicable

| Norma | Fecha | Objeto |
|-------|-------|--------|
| RD-ley 8/2019 (art. 34.9 ET) | 12/03/2019 | Registro diario obligatorio de jornada |
| Ley 10/2021 | 09/07/2021 | Trabajo a distancia: registro de modalidad presencial/remoto |
| RD-ley 2/2024 | 2024 | Refuerzo de sanciones: hasta €7,500 por empleado sin registro |

### 16.2 Verificación de Cumplimiento

| # | Requisito | Norma | Evidencia en el sistema |
|---|-----------|-------|-------------------------|
| 1 | Registro diario inicio/fin | RD-ley 8/2019 | `fichajes.tipo` + `fichajes.timestamp` |
| 2 | Horario concreto | RD-ley 8/2019 | TIMESTAMPTZ con ms de precisión |
| 3 | Pausas registradas | RD-ley 8/2019 | Cruce con tabla `pausas` en reportes |
| 4 | Total horas/día | RD-ley 8/2019 | Cálculo: salida − entrada − pausas |
| 5 | Conservación 4 años | RD-ley 8/2019 | BD sin DELETE automático |
| 6 | Acceso del trabajador | RD-ley 8/2019 | `/fichaje` tab personal con historial |
| 7 | Disponible inspección | RD-ley 8/2019 | Export CSV con BOM UTF-8, `;`, cabeceras ES |
| 8 | Representantes legales | RD-ley 8/2019 | Supervisor/Jefe/Dev/BO/IT acceden |
| 9 | Modalidad presencial/remoto | Ley 10/2021 | `fichajes.modalidad` + toggle UI |
| 10 | Contingencia: registro manual | RD-ley 8/2019 | `target_user_id` + `motivo` + `corregido_por` |
| 11 | Zona horaria local | — | Frontend calcula día en hora del navegador |
| 12 | Offline resiliente | — | localStorage + sync automático |
| 13 | Usuario desactivado no ficha | RD-ley 2/2024 | Triple check: auth + middleware JWT + API |

### 16.3 Lo que NO es obligatorio

- Envío a API gubernamental (no existe)
- Integración con nóminas
- PDF firmado digitalmente
- Fichaje biométrico (requiere consentimiento expreso)
- Geolocalización