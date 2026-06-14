# Oratioo CX — Roadmap Detallado

> **Inicio:** 19 Mayo 2026 | **Duracion:** 16 semanas | **Horas totales:** 463h
> **Formato:** Obsidian (checkboxes)

---

## Fase 1 — Fundacion (Semanas 1-2)

### Semana 1: Setup y Base de Datos

- [x] Configuracion Next.js 15 + TypeScript + Tailwind
- [x] PostgreSQL local (puerto 5433), BD `oratioo_cx`
- [x] Migracion 001: clientes, pipeline, historial, usuarios, proyectos
- [x] Seed de 18 usuarios con roles y 3 proyectos
- [x] Pool de conexiones pg (20 max, 30s timeout)

### Semana 2: Autenticacion y Navegacion

- [x] NextAuth.js v5 con Credentials + JWT + bcrypt
- [x] Pagina de login con diseno glass-morphism
- [x] Middleware RBAC con mapa de rutas por rol
- [x] Sidebar con iconos Lucide, menu adaptable por rol
- [x] Pagina de inicio con bienvenida segun rol

---

## Fase 2 — Bot de Extraccion (Semanas 3-4)

### Semana 3: Bot Python Base

- [x] Playwright + Chromium headless
- [x] Carga de 20 proxies espanoles desde proxies.txt
- [x] Script login.py: cookies, formulario, credenciales
- [x] Navegacion: seleccionar marca Orange, acto comercial
- [x] Extraccion basica: nombre, paquete, linea principal
- [x] Guardar resultado via POST a API Next.js

### Semana 4: Bot Avanzado

- [x] Extraccion por lineas (iterar .client-tariff-flex)
- [x] Deteccion CIMA (badge en heading)
- [x] Deteccion Renove (click en pestana, leer tarjeta)
- [x] Watchdog 40s por DNI
- [x] Coordinator daemon (coordinator_loop.py)
- [x] Worker loop continuo (worker_loop.py)
- [x] API bot-sync (POST /api/internal/bot-sync)

---

## Fase 3 — CRM Core (Semanas 5-7)

### Semana 5: Paginas de Datos

- [x] Pagina Clientes: tabla 9 columnas, filtros, export CSV
- [x] Ficha cliente modal 360 con tabs
- [x] Pagina Documentos: upload, cola de procesamiento
- [x] Deduplicacion al subir lotes
- [x] Pagina Proyectos: CRUD multi-proyecto

### Semana 6: Pipeline Comercial

- [x] Estados: pendiente -> contactado -> interesado -> negociacion -> venta
- [x] Asignar leads: pool, seleccion multiple, round-robin
- [x] API pipeline completa (CRUD)
- [x] Dashboard Asesor: Mis Leads con tabla y filtros
- [x] Pipeline v2: intentos, sub-estados, cooldown 48h
- [x] Tipificacion: modal con estados + sub-estados

### Semana 7: Dashboards de Gestion

- [x] Dashboard Supervisor: LivePanel, drill-down, reasignacion
- [x] Dashboard Jefe: funnel, comparativa, forecast
- [x] Estadisticas: KPIs, graficos, export CSV
- [x] Auditoria: timeline con filtros
- [x] Metas: ranking con barras de progreso
- [x] Alertas: centro de notificaciones

---

## Fase 4 — VPBX y Discador (Semanas 8-9)

### Semana 8: Integracion VPBX

- [x] Analisis API VPBX (doc.vpbx.me/api)
- [x] Libreria vpbx.ts: 14 funciones
- [x] Endpoint originate: POST /api/vpbx/originate
- [x] Webhooks VPBX: RINGING, ANSWERED, HANGUP -> cdr_vpbx
- [x] CDR Sync con filtros y paginacion
- [x] Variables CDR: POST /api/vpbx/cdr/[id]/vars
- [x] LivePanel con estados reales de VPBX
- [x] Gestion de extensiones por API
- [x] Pagina VPBX (`/vpbx`): UI de gestion de extensiones + monitoreo de agentes
- [x] API `/api/vpbx/extensions`: fusiona extensiones VPBX + usuarios CRM
- [x] Campo `extension_vpbx` en PATCH usuarios
- [x] Sidebar + middleware + breadcrumb para VPBX (roles: supervisor, jefe, dev, it)
- [x] Redis: rate limiting, webhook queue, cache (con fallback automático)
- [x] Sistema de pausas: BD + API + Power Dialer full-screen + LivePanel + colores graduales
- [x] Sidebar v2: acordeón real, badges con contadores, jerarquía visual
- [x] Reorganización sidebar: Gestión/Calidad/Formación eliminadas, ítems redistribuidos
- [x] Multi-proyecto: campos de lead dinámicos por proyecto, logo, CRUD, aislamiento de datos
- [x] Asignar Leads v3: chips por jerarquía (CEO→Jefe→Sup→Asesor) con input numérico
- [x] Proyectos hardcodeados eliminados (solo Orange)
- [x] Paginación unificada (Paginator component) en todas las tablas
- [x] Configuración de proyectos via overlay en /inicio
- [x] Pipeline multi-proyecto (filtro por proyecto_id en APIs clave)

### Semana 9: Power Dialer

- [x] Interfaz completa de discador
- [x] Click2Call integrado con rate limiting 3s
- [x] Modal de resultado post-llamada
- [x] Tipificacion integrada en el flujo
- [x] Navegacion entre leads (anterior/siguiente)
- [x] Panel de llamadas CDR en tiempo real
- [x] Agenda de callbacks programados
- [x] Integracion de grabaciones VPBX (almacena 1 año nativo)
- [x] Widget de colas en vivo

---

## Fase 5 — WhatsApp (Semana 10)

### Semana 10: Integracion WhatsApp Business

- [x] Configuracion Meta Developers (app, webhook, token)
- [x] Libreria whatsapp.ts: sendText, sendTemplate, parseIncoming
- [x] Webhook entrante: POST /api/webhooks/whatsapp
- [x] API envio: POST /api/whatsapp/send
- [x] CRUD de plantillas: GET/POST /api/whatsapp/plantillas
- [x] Chat UI en Power Dialer
- [x] Campos RGPD: opt_in, numero, fecha
- [x] Renove automatico: bot detecta -> backend cruza -> dispara WhatsApp
- [x] Panel de plantillas en Configuracion

---

## Fase 6 — Calidad de Datos (Semanas 11-12)

### Semana 11: Sistema de Calidad

- [x] Telefonos estructurados: migracion a telefonos_v2
- [x] Deteccion de cambios: 15 tipos entre extracciones
- [x] Tabla detecciones + UI en ficha cliente
- [x] Tipificacion dinamica: tabla tipificaciones_config
- [x] UI configuracion: supervisor agrega/quita codificaciones
- [x] Listas negras: tabla + trigger automatico
- [x] Dashboard salud: GET /api/dashboard/salud-base
- [x] Reportes CSV descargables

### Semana 12: QA y Refinamiento

- [x] Rubrica QA 5 criterios (Speech, Objeciones, Cierre, Compliance, Empatia)
- [x] Tabla qa_evaluaciones con puntaje automatico
- [x] Dashboard QA: resumen por asesor
- [x] Scoring de leads: niveles C, D, E
- [x] Auditoria de seguridad: 12 vulnerabilidades corregidas
- [x] Indices de rendimiento (6 nuevos)
- [x] Correccion de bugs y edge cases
- [x] Documentacion actualizada

---

## Fase 7 — Inteligencia Comercial (Semanas 13-14)

### Semana 13: Metricas de Operadores

- [x] Contactabilidad y conversion por operador
- [x] Ventas por hora del grupo y por operador
- [x] Tiempo medio de llamada (requiere VPBX conectado)
- [x] Tiempo post-llamada (wrap-up)
- [x] Ocupacion: tiempo conectado vs hablando
- [x] Dashboard de rendimiento unificado
- [x] Sistema de cinturones (gamificacion)
- [x] Notificaciones automaticas al supervisor

### Semana 14: Scoring Avanzado

- [x] Scoring completo A+ a E
- [x] Tabla compras + integracion SICA
- [x] Tasa de reutilizacion de registros
- [x] Analisis de abandono de leads
- [x] Prediccion de ventas diarias (forecast)
- [x] Panel de forecast en dashboard Jefe
- [x] Reportes PDF descargables

---

## Fase 8 — Deploy y Produccion (Semanas 15-16)

### Semana 15: Infraestructura

- [ ] Contratacion VPS Hetzner CPX41
- [ ] Instalacion Plesk
- [ ] PostgreSQL produccion + backups
- [ ] Deploy Next.js standalone
- [ ] Nginx reverse proxy + SSL
- [ ] Instalacion Redis para colas
- [ ] Monitoreo y alertas

### Semana 16: Pruebas y Lanzamiento

- [ ] Pruebas de carga (10 workers, 1000+ DNIs)
- [ ] Pruebas de estres (50+ usuarios)
- [ ] Correccion de bugs
- [ ] Migracion de datos historicos SICA
- [ ] Capacitacion a equipos
- [ ] Documentacion final
- [ ] Handover y entrega

---

## Progreso General

- [x] Fase 1 — Fundacion
- [x] Fase 2 — Bot Python
- [x] Fase 3 — CRM Core
- [x] Fase 4 — VPBX y Discador
- [x] Fase 5 — WhatsApp
- [x] Fase 6 — Calidad de Datos
- [x] Fase 7 — Inteligencia Comercial
- [ ] Fase 8 — Deploy y Produccion

**Completado:** 7/8 fases (87.5%) | **Pendiente:** 1/8 fases (12.5%)