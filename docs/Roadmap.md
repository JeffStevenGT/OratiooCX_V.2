# 🗺️ Oratioo CX — Roadmap

> Branch: `submaster` | Stack: Next.js + PostgreSQL + Python + VPBX
> Actualizado: 03/06/2026

---

## 🎯 Meta del Proyecto

Reemplazar Sicca con un CRM propio que unifique todos los proyectos comerciales
(Orange, Mainjobs, impresoras, futuros) bajo un mismo cliente y automatice la
extracción de leads, las llamadas, el pipeline de ventas y la formación de asesores.

---

## 📅 Fase 1 — MVP Local ✅ (Completada)

**Objetivo:** CRM funcional en localhost con PostgreSQL, bot conectado, frontend usable.

| # | Tarea | Estado |
|---|---|---|
| 1.1 | PostgreSQL local (puerto 5433) + migración ejecutada | ✅ |
| 1.2 | NextAuth.js (login con credenciales) | ✅ |
| 1.3 | Sidebar con matriz de permisos por rol | ✅ |
| 1.4 | Página Clientes con datos del bot, filtros, desplegable, export | ✅ |
| 1.5 | Página Documentos — subida .csv/.txt/.xlsx, cola de DNIs | ✅ |
| 1.6 | Página Bots — control remoto multi-máquina | ✅ |
| 1.7 | Página Infraestructura — proxies + máquinas | ✅ |
| 1.8 | Dashboards por rol | 🟡 Placeholders |
| 1.9 | Agenda + Tramitación | 🟡 Placeholders |

---

## 📅 Fase 1.5 — Estabilización del Bot 🔴 (Actual, prioridad máxima)

**Objetivo:** Bot robusto y tolerante a fallos, listo para producción.

| # | Tarea | Prioridad | Estado |
|---|---|---|---|
| 1.5.1 | Probar flujo completo con Pangea online | 🔴 | ⬜ |
| 1.5.2 | Batching de 20 DNIs (protege cortes de internet) | 🔴 | ⬜ |
| 1.5.3 | Proxy rotation: si proxy falla 3 veces, marcarlo y rotar | 🟡 | ⬜ |
| 1.5.4 | RAM/CPU en heartbeat del coordinator | 🟡 | ⬜ |
| 1.5.5 | `output: standalone` en Next.js para build de producción | 🟡 | ⬜ |

---

## 📅 Fase 2 — Deploy y Producción 🟡 (Próximo)

**Objetivo:** CRM accesible desde cualquier navegador, bot corriendo en PC local conectado al VPS.

| # | Tarea | Prioridad | Estado |
|---|---|---|---|
| 2.1 | Contratar VPS (Hetzner CPX31/CPX41) | 🟡 | ⬜ |
| 2.2 | Instalar Coolify en VPS | 🟡 | ⬜ |
| 2.3 | Deploy Next.js standalone en VPS | 🟡 | ⬜ |
| 2.4 | PostgreSQL en VPS + migrar datos | 🟡 | ⬜ |
| 2.5 | Redis para colas + webhooks VPBX rápidos | 🟡 | ⬜ |
| 2.6 | Cloudflare R2 para grabaciones (ciclo 6 meses) | 🟢 | ⬜ |
| 2.7 | Variables de entorno de producción | 🟡 | ⬜ |

---

## 📅 Fase 3 — VPBX y Power Dialer 🟢 (Después)

**Objetivo:** Discador propio reemplazando Sicca.

| # | Tarea | Prioridad | Estado |
|---|---|---|---|
| 3.1 | Endpoints VPBX implementados (originate, webhooks) | ✅ | Hecho |
| 3.2 | Power Dialer funcional con Click2Call | 🟢 | ⬜ |
| 3.3 | Protección 5s debounce en botón de llamada | 🟢 | ⬜ |
| 3.4 | CDR sync + tabla `cdr_vpbx` | 🟢 | ⬜ |
| 3.5 | Webhook VPBX → Redis → PostgreSQL (flujo asíncrono) | 🟢 | ⬜ |
| 3.6 | Motor de re-análisis (CDR + pipeline → decisión) | 🟢 | ⬜ |
| 3.7 | Página Agenda — callbacks y seguimiento | 🟢 | ⬜ |
| 3.8 | Grabaciones MP3 en R2 con URLs prefirmadas | 🟢 | ⬜ |

---

## 📅 Fase 4 — WhatsApp y Flujo Renove 🟢 (Después)

**Objetivo:** Mensajería directa con clientes vía Meta Cloud API.

| # | Tarea | Prioridad | Estado |
|---|---|---|---|
| 4.1 | Conexión Meta Cloud API | 🟢 | ⬜ |
| 4.2 | Webhooks WhatsApp → `/api/webhooks/whatsapp` | 🟢 | ⬜ |
| 4.3 | Tabla `whatsapp_mensajes` | 🟢 | ⬜ |
| 4.4 | Campos RGPD en `clientes` (opt_in, numero, fecha) | 🟢 | ⬜ |
| 4.5 | Plantilla Meta API 1: Doble Opt-In | 🟢 | ⬜ |
| 4.6 | Plantilla Meta API 2: Alerta Renove automática | 🟢 | ⬜ |
| 4.7 | Panel flotante de chat en frontend (Zustand) | 🟢 | ⬜ |
| 4.8 | Switch "Alertas de Fidelización" en UI del asesor | 🟢 | ⬜ |

---

## 📅 Fase 5 — Pipeline CRM y Dashboards 🟢

**Objetivo:** Gestión comercial completa con métricas por rol.

| # | Tarea | Estado |
|---|---|---|
| 5.1 | Tabla pipeline + triggers de auditoría | ✅ Hecho |
| 5.2 | Página Tramitación funcional | ⬜ |
| 5.3 | Dashboard asesor con métricas reales | ⬜ |
| 5.4 | Dashboard supervisor con KPIs | ⬜ |
| 5.5 | Dashboard jefe con visión global | ⬜ |
| 5.6 | Protección: asesor solo modifica sus propios leads | ⬜ |

---

## 📅 Fase 6 — Expansión (Futuro) ⬜

| # | Tarea |
|---|---|
| 6.1 | Bot Mainjobs |
| 6.2 | Bot Impresoras |
| 6.3 | Wikiratioo (formación) |
| 6.4 | Módulo de Metas y Ranking |
| 6.5 | Módulo de Alertas |
| 6.6 | Dockerizar bots |
| 6.7 | Escalar a múltiples VPS + balanceo de carga |

---

## 📊 Resumen por Prioridad

| 🔴 AHORA | 🟡 PRONTO | 🟢 DESPUÉS | ⬜ FUTURO |
|---|---|---|---|
| Probar bot con Pangea | Deploy VPS + Coolify | Power Dialer VPBX | Bots nuevos |
| Batching 20 DNIs | Redis para colas | WhatsApp + Renove | Wikiratioo |
| | standalone build | Pipeline UI + Dashboards | Docker + escalar |
