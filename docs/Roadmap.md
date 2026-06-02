# 🗺️ Oratioo CX — Roadmap

> Branch: `submaster` | Stack: Next.js + PostgreSQL + Python + VPBX

---

## 🎯 Meta del Proyecto

Reemplazar Sicca con un CRM propio que unifique todos los proyectos comerciales
(Orange, Mainjobs, impresoras, futuros) bajo un mismo cliente y automatice la
extracción de leads, las llamadas, el pipeline de ventas y la formación de asesores.

---

## 📅 Fase 0 — Fundación (Actual)

**Objetivo:** Todo listo para empezar a construir.

| # | Tarea | Estado |
|---|---|---|
| 0.1 | Rama `submaster` creada | ✅ |
| 0.2 | Arquitectura documentada | ✅ |
| 0.3 | Stack definido (Next.js + PostgreSQL + Python + VPBX) | ✅ |
| 0.4 | Modelo de datos diseñado (clientes, proyectos, historial, pipeline) | ✅ |
| 0.5 | Migración SQL lista (`supabase/001_migracion_inicial.sql`) | ✅ |
| 0.6 | Componentes base del frontend (StatCard, Modal, CallButton) | ✅ |
| 0.7 | Cliente VPBX, Storage (R2), Watchdog del bot | ✅ |
| 0.8 | Piloto de Orange ejecutándose (1003 DNIs, 5 workers) | 🔄 |

---

## 📅 Fase 1 — MVP Local (1-2 semanas)

**Objetivo:** CRM funcional en localhost con PostgreSQL.

### Semana 1: Base de Datos + Auth

| # | Tarea | Prioridad | Estado |
|---|---|---|---|
| 1.1 | Instalar PostgreSQL local y ejecutar migración | 🥇 | ⬜ |
| 1.2 | Configurar NextAuth.js (login con credenciales + JWT) | 🥇 | ⬜ |
| 1.3 | Crear usuario admin seed | 🥇 | ⬜ |
| 1.4 | Middleware de protección de rutas por rol | 🥇 | ⬜ |
| 1.5 | Sidebar con matriz de permisos por rol | 🥇 | ⬜ |

### Semana 2: Clientes + Pipeline

| # | Tarea | Prioridad | Estado |
|---|---|---|---|
| 1.6 | Página `Clientes.jsx` — Ficha 360 (datos core + proyectos) | 🥇 | ⬜ |
| 1.7 | Componente `TimelineCliente.tsx` — historial del cliente | 🥇 | ⬜ |
| 1.8 | CRUD de pipeline (API + página `Tramitacion.jsx`) | 🥇 | ⬜ |
| 1.9 | Página `Documentos.jsx` — subida de archivos con DNIs | 🥈 | ⬜ |
| 1.10 | Dashboards por rol (5 dashboards mínimos con StatCards) | 🥈 | ⬜ |

---

## 📅 Fase 2 — Extracción Automatizada (1 semana)

**Objetivo:** El bot escribe datos reales en la BD.

| # | Tarea | Prioridad | Estado |
|---|---|---|---|
| 2.1 | Adaptar el bot actual para escribir en PostgreSQL (no Supabase) | 🥇 | ⬜ |
| 2.2 | Worker con pool de conexiones + `tomar_siguiente_dni()` | 🥇 | ⬜ |
| 2.3 | Coordinator multi-worker con heartbeat a PostgreSQL | 🥇 | ⬜ |
| 2.4 | Endpoint API para control remoto del bot | 🥈 | ⬜ |
| 2.5 | Monitoreo de bots desde el frontend (Admin) | 🥈 | ⬜ |

---

## 📅 Fase 3 — Wikiratioo (1 semana)

**Objetivo:** Formación de asesores integrada en el CRM.

| # | Tarea | Prioridad | Estado |
|---|---|---|---|
| 3.1 | Tablas SQL: cursos, lecciones, cuestionarios, progreso | 🥇 | ⬜ |
| 3.2 | Página `Wikiratioo.jsx` — catálogo de cursos | 🥇 | ⬜ |
| 3.3 | Visor de curso (video embebido + markdown) | 🥇 | ⬜ |
| 3.4 | Cuestionario interactivo con evaluación automática | 🥈 | ⬜ |
| 3.5 | Panel de progreso (asesor ve lo completado, admin ve equipo) | 🥈 | ⬜ |

---

## 📅 Fase 4 — Integración VPBX (2 semanas)

**Objetivo:** Discador propio reemplazando Sicca.

### Semana 1: Click2Call

| # | Tarea | Prioridad | Estado |
|---|---|---|---|
| 4.1 | Obtener API Key de VPBX y configurar extensiones | 🥇 | ⬜ |
| 4.2 | Configurar webhook URL en VPBX | 🥇 | ⬜ |
| 4.3 | API endpoint `/api/vpbx/originate` | 🥇 | ⬜ |
| 4.4 | Página `PowerDialer.jsx` — llamar lead por lead | 🥇 | ⬜ |
| 4.5 | Tabla CDR sincronizada con VPBX | 🥇 | ⬜ |

### Semana 2: Re-Análisis

| # | Tarea | Prioridad | Estado |
|---|---|---|---|
| 4.6 | Webhook VPBX → Redis → PostgreSQL (flujo asíncrono) | 🥇 | ⬜ |
| 4.7 | Motor de re-análisis (CDR + pipeline → decisión) | 🥇 | ⬜ |
| 4.8 | Página `Agenda.jsx` — callbacks y seguimiento | 🥈 | ⬜ |
| 4.9 | Grabaciones de llamadas (R2 presigned URLs) | 🥈 | ⬜ |

---

## 📅 Fase 5 — Despliegue Producción (1 semana)

**Objetivo:** CRM accesible desde cualquier navegador.

| # | Tarea | Prioridad | Estado |
|---|---|---|---|
| 5.1 | Deploy Next.js en Vercel (Free) | 🥇 | ⬜ |
| 5.2 | Migrar PostgreSQL a Render (Free tier) | 🥇 | ⬜ |
| 5.3 | Configurar Cloudflare R2 para archivos | 🥈 | ⬜ |
| 5.4 | Variables de entorno de producción | 🥇 | ⬜ |
| 5.5 | Pruebas con 5-10 asesores reales | 🥇 | ⬜ |

---

## 📅 Fase 6 — Expansión (Futuro)

**Objetivo:** Nuevos proyectos y escalabilidad.

| # | Tarea | Prioridad | Estado |
|---|---|---|---|
| 6.1 | Nuevo proyecto: Mainjobs (bot + datos) | 🥉 | ⬜ |
| 6.2 | Nuevo proyecto: Impresoras | 🥉 | ⬜ |
| 6.3 | Módulo de Metas y Ranking | 🥉 | ⬜ |
| 6.4 | Módulo de Alertas | 🥉 | ⬜ |
| 6.5 | Optimización para 100+ asesores (Redis, pooling, índices) | 🥉 | ⬜ |
| 6.6 | Dockerizar los bots (deploy en VPS) | 🥉 | ⬜ |

---

## 📊 Resumen por Prioridad

| Prioridad | Fase | Tiempo | Qué entrega |
|---|---|---|---|
| 🥇 | Fase 1: MVP Local | 2 semanas | CRM funcional en localhost con login, clientes, pipeline |
| 🥇 | Fase 2: Extracción | 1 semana | Bot escribe en PostgreSQL, datos reales en el CRM |
| 🥇 | Fase 3: Wikiratioo | 1 semana | Formación de asesores integrada |
| 🥇 | Fase 4: VPBX | 2 semanas | Discador propio, re-análisis inteligente |
| 🥇 | Fase 5: Deploy | 1 semana | CRM en producción, accesible desde cualquier lado |
| 🥉 | Fase 6: Expansión | ∞ | Nuevos proyectos, escalar a 100+ asesores |

---

## ⏱️ Calendario Estimado

```
Junio 2026
  1ª semana (del 2 al 7):  Fase 0 — Fundación (actual)
  2ª-3ª semana (8-21):     Fase 1 — MVP Local  
  4ª semana (22-28):       Fase 2 — Extracción Automatizada

Julio 2026
  1ª semana (29-5):        Fase 3 — Wikiratioo
  2ª-3ª semana (6-19):     Fase 4 — VPBX  
  4ª semana (20-26):       Fase 5 — Deploy Producción

Agosto 2026+:              Fase 6 — Expansión y nuevos proyectos
```
