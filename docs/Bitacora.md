# ORATIOO CX — Bitácora de Desarrollo

> Última actualización: 03/06/2026
> Branch: submaster

---

## Sesión 03/06/2026 — Reestructuración completa

13 commits en rama submaster. Enfoque: cablear el bot, frontend de clientes, documentación.

### Implementado

**Bot:**
- Workers selector cableado al coordinator vía parametros JSONB
- Coordinator convertido a daemon: polling de comandos, spawn/kill dinámico
- Control multi-máquina: comandos filtrados por maquina_destino
- Sistema touch: worker actualiza updated_at mientras procesa, incluso durante reintentos de login
- Rescate automático de DNIs atascados (>30 min sin touch)
- FOR UPDATE SKIP LOCKED corregido en next-dni
- proxies.txt cargado desde raíz, 1 proxy por worker

**Frontend:**
- Clientes page estilo master: 9 columnas, filtros, desplegable con líneas, tipo editable, export CSV
- Documentos page: .xlsx/.csv/.txt, cola de DNIs con stats
- Infraestructura: proxies (CRUD visual) + máquinas (CRUD + heartbeat)
- Bots page: selector de máquina destino, status banner

**API (7 nuevos endpoints):**
- /api/clientes (join + transform), /api/clientes/[id] (PATCH tipo_persona)
- /api/bot/touch, /api/bot/reset-stale
- /api/proxies (CRUD proxies.txt), /api/maquinas (CRUD + heartbeat)
- /api/documentos/cola

**BD:**
- Migración 002_maquinas.sql ejecutada
- Carga: NIF → empresa, DNI/NIE → natural

**Docs:**
- Arquitectura Completa v3.0, Roadmap, Base de Datos, Extracción, VPBX, WhatsApp
- Bitácora, Descripción General, README

### Bugs corregidos
- next-dni 500: cp.id_cp → cp.id
- command 400: worker no pasaba ?maquina=
- proxies.txt no encontrado
- Workers compartían proxy → 1:1 por worker-id
- Duplicado power-dialer/page.tsx
- params Promise en Next.js 15

---

## Sesiones Anteriores (master)

### 02/06/2026 — Piloto Orange + Diseño BD
- Piloto con 5 workers, 20 proxies, 1003 DNIs
- Extracción datos reales (~15 DNIs)
- Diseño arquitectura JSONB clientes_proyectos
- Análisis VPBX API

### 28/05/2026 — Producción en master
- 8,039 lineas, ~3,000 completados
- Watchdog + worker loop continuo

### 22/05/2026 — Oratioo CX inicial
- Rebranding, 22 bugs, auth + roles, pipeline CRM, sidebar adaptativo
