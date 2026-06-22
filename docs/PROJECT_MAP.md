# PROJECT_MAP.md — Mapa completo de OratiooCX_V.2

> Documento maestro de referencia. Resume TODO el proyecto: origen de datos, viaje de
> los leads, inteligencia comercial, roles, páginas, API y BD. Mantener actualizado.

---

## 1. Qué es

CRM / automatización de call center de telefonía (campaña **Orange**). Un **bot** scrapea el
portal de Orange (**Pangea**) para extraer la cartera de clientes, los guarda en **PostgreSQL**
vía API, y un **dashboard Next.js** los explota: asignación de leads, discador (Click2Call por
VPBX), scoring, forecast, calidad, fichaje. Multi-proyecto por diseño; hoy solo existe **Orange (id=1)**.

---

## 2. Stack

| Capa | Tecnología |
|---|---|
| Frontend/API | Next.js 15 (App Router) + TypeScript + Tailwind |
| Bot | Python 3.11 + Playwright (Chromium) |
| BD | PostgreSQL (acceso SOLO vía API; el bot nunca toca la BD) |
| Auth | NextAuth.js (credentials + JWT, 8h) |
| VoIP | VPBX (vpbx.me): Click2Call, CDR, grabaciones, agentes/extensiones |
| WhatsApp | Meta Cloud API |
| Cache/colas | Redis OPCIONAL (sin REDIS_URL → memoria) |
| Deploy | Híbrido: VPS Docker (app+Postgres+Nginx) + PC Windows (bot) |

BD local dev: `localhost:5433/oratioo_cx`. Rama activa: `submaster`.

---

## 3. Arquitectura (3 capas, REST entre ellas)

```
BOT (Python)            API (Next.js)              FRONTEND (React)
coordinator_loop  --x-bot-api-key-->  middleware.ts (JWT) <--JWT-- (dashboard)/ 23 páginas
worker_loop       --/api/bot/*-->     /api/* (59 endpoints)
                  --/api/internal-->         |
                                             v
                                    PostgreSQL  ──VPBX──  ──WhatsApp──
```
- Bot → API: `x-bot-api-key`. Frontend → API: JWT (NextAuth). API → BD: pool `pg` (DATABASE_URL).

---

## 4. Origen de los datos — Bot Pangea

- **coordinator_loop.py** (daemon 24/7 por máquina): se registra, heartbeat 30s (`PATCH /api/maquinas`),
  polling comandos 5s (`GET /api/bot/command?maquina=X`), lanza N workers con credenciales Pangea como
  env, reinicia workers muertos (máx 5/h), rescata DNIs atascados (>30min en_progreso) cada 60s,
  libera leads inactivos (>3 días) de 2-3 AM. Comandos: iniciar(workers=N) / detener / pausar(seg).
- **worker_loop.py** (1 por proxy): login Pangea → loop: `next-dni` → `touch` → extraer → `sync`.
  Recicla navegador cada 50 DNIs. Watchdog 40s por extracción (reload+relogin si excede).
- **login.py**: login con 10 reintentos; maneja MaxSessionsError (espera 5min sin gastar intento),
  selecciona marca Orange, abre acto comercial. Blindaje anti-herramientas (oculta menú Pangea por CSS).
- **browser_setup.py**: Chromium, geo/locale España (Madrid), proxies 1:1 (`proxies.txt`), stealth.
- **Estados del DNI** (`clientes_proyectos.datos->>'estado'`): pendiente → en_progreso →
  completado / no_cliente / error_sync (3 reintentos backoff 2/4/8s). ya_procesado = duplicado por teléfono.

---

## 5. Flujo bot → API → BD

1. `GET /api/bot/next-dni` → siguiente pendiente con `FOR UPDATE SKIP LOCKED` (sin colisiones entre workers).
2. `PATCH /api/bot/touch` → mantiene vivo el DNI (evita el rescate).
3. `POST /api/internal/bot-sync` → transacción atómica: SELECT FOR UPDATE datos previos →
   UPSERT `clientes_proyectos` ON CONFLICT (id_cliente, proyecto_id) → **detectar cambios** vs análisis
   anterior → INSERT batch en `detecciones` → INSERT en `historial`.
- Las **detecciones** alimentan la página /alertas (renove nuevo, cima perdido, permanencia vencida, etc.).

---

## 6. Modelo de datos (PostgreSQL)

Tablas núcleo:
- **clientes** — entidad única por `id_cliente` (DNI_/NIE_/NIF_). Campos: nombre_razon_social, tipo_persona,
  whatsapp_*, `telefonos`, alertas_fidelizacion, soft-delete (RGPD).
- **clientes_proyectos** — datos del bot por cliente+proyecto. `datos` JSONB = { estado, header{nombre,dni,
  paquete,direccion}, lineas[ {numero, producto, etiquetas[], estado{hotline,suspendida,impago}, tiene_renove,
  variante_renove, tiene_tv, es_cima, permanencia, consumo, venta_plazos, campanas_extra[]} ], cima_global,
  version_extraccion }. UPSERT por (id_cliente, proyecto_id). Índice GIN sobre `datos`.
- **pipeline** — estado comercial por proyecto: asesor_id, estado, notas, soft-delete (liberación).
- **usuarios** — auth: email, password_hash (bcrypt), rol, equipo, supervisor_id, `extension_vpbx`, fecha_nacimiento, activo.
- **historial** — timeline: extracción, llamada, tipificación, compra, asignación, rgpd_olvido.
- **detecciones** — cambios entre análisis (renove/cima/permanencia/consumo/tv/linea/cliente...).
- **proyectos** — `config` JSONB (campos_lead, metas, cooldown, logo_url).
- **maquinas** (workers/heartbeat) · **comandos_bot** (cola front→coordinator) · **configuracion** (clave-valor).
- **pausas** · **anuncios** + **anuncios_leidos** · **fichajes** · **cdr_vpbx** · **listas_negras** · **analisis_perdidos**.

Inteligencia/ventas (objetos SQL, fuera de 001/002):
- **scoring_leads** (id_cliente, proyecto_id, nivel A+..E, puntuacion) · vista **v_scoring_resumen** ·
  función **calcular_scoring_masivo(proyecto_id)** · función **forecast_ventas(proyecto_id,dias,forecast)**.
- **compras** (id_cliente, proyecto_id, fecha_compra, tipo_producto, numero_linea, importe, comision_estimada, asesor_id) — integración SICA.
- **ddis** (003/004) — catálogo DDI por provincia para telefonía (ver §10).

---

## 7. Viaje del lead (pipeline comercial)

```
pendiente ─► contactado ─► interesado ─► negociacion ─► venta
   │             │              └─► no_interesa
   └─► no_contesta / buzon
```
- **Asignación jerárquica**: CEO/Dev → Jefes de Área → Supervisores → Asesores.
  Página /asignar-leads: cada subordinado es un *chip* con input numérico; botón "Repartir igual".
- **Asesor**: trabaja sus leads en /power-dialer (discador) → marca (Click2Call) → registra **intento**
  (`/api/pipeline/intento`) → **tipifica** (`/api/pipeline/tipificar`, estados configurables en
  `tipificaciones-config`). Si vende → se registra **compra**.
- **Backoffice** (/backoffice): **tramitación** de ventas (`/api/pipeline/tramitacion`).
- **Liberación**: leads inactivos (>3 días) se liberan de madrugada (`release-stale`) y vuelven al pool
  (/liberados). Cooldown por proyecto en `proyectos.config`.
- **Aislamiento**: todas las queries filtran por `proyecto_id`; el asesor solo ve/edita sus leads
  (`requirePipelineOwnership`).

---

## 8. Roles y permisos

7 roles: `asesor`, `supervisor`, `jefe_area`, `back_office`, `auditor_calidad`, `it`, `desarrollador`.
- `desarrollador` = acceso total (bypass). `it` = infraestructura/bots/config/vpbx.
- Auth: `requireAuth()`, `requireRole(...)`, `requirePipelineOwnership(id)` (asesor solo sus leads;
  supervisor/jefe/dev/it cualquiera). Middleware redirige a /inicio si el rol no puede entrar a la ruta.

Mapa ruta → roles permitidos (middleware.ts):
| Ruta | Roles |
|---|---|
| /jefe | jefe_area, dev |
| /admin, /infraestructura, /bots, /config | it, dev |
| /supervisor | supervisor, jefe_area, dev |
| /asesor, /power-dialer | asesor, supervisor, jefe_area, dev |
| /backoffice, /backoffice/tramitacion | back_office, jefe_area, dev |
| /asignar-leads | jefe_area, supervisor, dev |
| /estadisticas, /auditoria, /rendimiento, /inteligencia, /metas, /alertas | supervisor, jefe_area, dev |
| /calidad | auditor_calidad, supervisor, jefe_area, dev |
| /usuarios, /proyectos | jefe_area, dev |
| /clientes | supervisor, jefe_area, it, dev, back_office |
| /vpbx | supervisor, jefe_area, dev, it |
| /fichaje, /perfil, /wikiratioo | casi todos |

Rutas públicas (sin login): /login, /inicio, /api/auth, /api/webhooks, /api/bot/, /api/internal/.

---

## 9. Inteligencia comercial

**Glosario Orange** (etiquetas que extrae el bot y mueven el scoring):
- **CIMA** = cliente con alto valor/elegible · **Renove** = elegible para renovación de terminal
  (variante_renove) · **Permanencia** = fin de compromiso (vencida = libre para portabilidad) ·
  **Hotline** = línea suspendida por impago · **TV** = Orange TV · **VAP** = venta a plazos (financiación).
- **Scoring** (1-100) basado en CIMA, Renove, permanencia y consumo.

Motores (SQL):
- **Scoring**: tabla `scoring_leads` (nivel **A+ A B C D E**, puntuacion), vista `v_scoring_resumen`,
  función `calcular_scoring_masivo(proyecto_id)`. API `/api/dashboard/scoring` (KPIs: top_leads=A+/A,
  calientes=A+/A/B, frios=D/E). Página /inteligencia.
- **Forecast**: función `forecast_ventas(proyecto_id, dias, forecast)` → histórico + predicción.
  API `/api/dashboard/forecast` (media_diaria, total_forecast).
- **Ventas**: tabla `compras` (importe, comision_estimada). API `/api/compras` (SICA). Resumen por asesor.
- **Rendimiento/metas**: `/api/dashboard/rendimiento` → ranking de asesores (ventas, contactabilidad,
  efectividad, ocupación, wrap_up, calidad) + meta mensual (`metas`): porcentaje_meta, media_necesaria,
  estado_meta (cumplida/en_camino/retrasado/sin_meta).
- Otros dashboards: abandono, cinturones, reutilizacion, salud-base, scoring-contactabilidad, reportes.

---

## 10. Telefonía VPBX + DDI por provincia

- Cliente VPBX: `src/lib/vpbx.ts` (originateCall, c2cexternal, CDR, agentes, extensiones, grabaciones, TTS).
- **Llamada saliente**: `POST /api/vpbx/originate` { from = `usuarios.extension_vpbx`, to = nº cliente, dni }.
  Rate-limit Redis 3s. Registra en `historial`.
- **DDI dinámico por provincia** (implementado): el DDI presentado se fija con
  `?outboundId=<UUID>` en `/originatecall` (UUID = "Regla de salida" del panel VPBX; NO es el número,
  NO se lista por API). NO hace falta updateExtension → cada llamada lleva su DDI, sin condiciones de carrera.
- Selector: `src/lib/ddi-router.ts` → `resolverOutboundDDI(to)`. Cascada: fijo (8/9) → provincia por
  prefijo · móvil (6/7) → CP de la dirección del cliente en BD · si no → DDI por defecto. Elige un DDI
  `estado='activo'` de esa provincia (rota por `fecha_ultimo_uso`).
- Catálogo `ddis` (migraciones 003/004): provincia, codigo_prov, prefijos[], ddi, **outbound_id** (UUID, a
  poblar desde el panel), campana, tipo_llamada, estado (activo/spam/no_alta), fechas. 266 DDIs, 50 provincias.
- **Estado**: listo para conectar. Sin panel VPBX cargado (outbound_id vacío) cae al DDI por defecto sin romper nada.
- Webhooks VPBX: `/api/webhooks/vpbx` (eventos CDR → cola Redis). Páginas /vpbx (extensiones+agentes en vivo).

---

## 11. Integraciones

- **WhatsApp** (`src/lib/whatsapp.ts`, Meta Cloud API): `/api/whatsapp/send`, plantillas, webhook entrante.
- **Redis** (`src/lib/redis.ts`, @upstash): rate-limit, cola de webhooks, cache TTL, pub/sub. Opcional (fallback memoria).
- **Storage**: VPBX nativo para grabaciones (Cloudflare R2 deprecado).

---

## 12. Catálogo (resumen)

**23 páginas** `src/app/(dashboard)/`: admin(+anuncios), agenda, alertas, asesor, asignar-leads, auditoria,
backoffice, bots, calidad, clientes, estadisticas, inteligencia, jefe, metas, perfil, power-dialer, proyectos,
rendimiento, supervisor, usuarios, vpbx, wikiratioo, fichaje. (+ /inicio splash, /login).

**59 endpoints** `src/app/api/` por familias:
- `bot/*` (next-dni, command, credenciales, touch, reset-stale) + `internal/bot-sync` — x-bot-api-key.
- `pipeline/*` (route, mine, agenda, estadisticas, intento, tipificar, tramitacion, release-stale, liberados, notifications, backoffice-stats).
- `clientes/*`, `compras`, `detecciones`, `dashboard/*` (scoring, scoring-contactabilidad, forecast, abandono, cinturones, reutilizacion, salud-base, rendimiento, reportes, proyecto, notificaciones).
- `vpbx/*` (originate, agents, extensions, cdr/[callId]/vars) + `webhooks/{vpbx,whatsapp}`.
- `usuarios`, `proyectos(+stats)`, `configuracion`, `tipificaciones-config`, `listas-negras`, `qa`, `auditoria`,
  `anuncios/*`, `maquinas`, `pausas`, `proxies`, `fichajes(+equipo)`, `perfil/password`, `documentos/{cola,upload}`,
  `admin/{credenciales,stats}`, `whatsapp/*`, `health`, `sse`, `auth/[...nextauth]`.

---

## 13. Reglas y migraciones

1. PostgreSQL SOLO vía API (el bot nunca toca la BD). UPSERT por (id_cliente, proyecto_id). Filtrar por proyecto_id.
2. Auth en toda API: `requireAuth()`/`requireRole()`. Bot: `x-bot-api-key`. Datos confidenciales (RGPD).
3. Workers proxies 1:1. NO Supabase. Redis opcional. Commits/comentarios en español.
4. Pitfalls SWC/JSX y deploy: ver skill `oratioo-crm`.

**Migraciones** `migrations/*.sql` (idempotentes). Hermes las aplica con `scripts/apply_migrations.cjs`
(se autoprotege: solo aplica si la BD es local). 001 anuncios · 002 índices · 003 tabla ddis · 004 seed ddis.
Objetos SQL de inteligencia (scoring_leads, v_scoring_resumen, calcular_scoring_masivo, forecast_ventas, compras)
existen fuera de 001/002 — localizar su origen al tocar inteligencia.

