# Oratioo CX — Descripción General del Proyecto

> CRM omnicanal con bots, discador VPBX, pipeline comercial, formación y base de clientes 360°
> Versión: 1.0 — Junio 2026

---

## 1. ¿Qué es Oratioo CX?

Oratioo CX es un **CRM omnicanal** diseñado para **call centers** que comercializan múltiples productos y servicios a través de campañas gestionadas desde una única plataforma.

A diferencia de un CRM tradicional (donde los datos se ingresan manualmente), Oratioo CX utiliza **bots automatizados** que extraen información real de los portales de los proveedores (como Orange Pangea), eliminando la necesidad de que los asesores pierdan tiempo buscando clientes manualmente.

---

## 2. El Problema que Resuelve

### Situación actual del cliente

La empresa tiene múltiples proyectos comerciales:
- **Orange España** — Venta de líneas móviles, fibra, Renove, CIMA, descuentos
- **Mainjobs** — Cursos de formación profesional
- **Impresoras** — Venta de equipos y consumibles
- Y más proyectos futuros...

Cada proyecto opera de forma independiente:
- Los leads se extraen manualmente de Orange
- Se cargan en un discador externo (Sicca)
- Los resultados se registran en Excel
- No hay historial unificado del cliente
- Cada nuevo proyecto arranca desde cero

### Lo que Oratioo CX cambia

- **Un solo CRM** para todos los proyectos
- **Bots automáticos** que extraen los leads sin intervención humana
- **Discador propio** (VPBX) sin depender de terceros
- **Cliente 360°** con todo el historial en un solo lugar
- **Base enriquecida** que crece con cada interacción

---

## 3. Stack Tecnológico

### Frontend + API

| Componente | Tecnología | Propósito |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | Frontend + API en un solo proyecto |
| Lenguaje | **TypeScript** | Tipado estático, menos errores en producción |
| Estilos | **Tailwind CSS 4** | CSS utility-first, rápido de desarrollar |
| UI Components | **shadcn/ui** | Componentes accesibles y personalizables |
| Iconos | **Lucide React** | Iconos SVG ligeros |
| Gráficos | **Recharts** | Dashboard con gráficos interactivos |
| Estado global | **Zustand** | Estado compartido sin boilerplate |
| Formularios | **React Hook Form + Zod** | Formularios con validación tipada |
| Tablas | **TanStack Table** | Ordenamiento, filtros, paginación |
| HTTP | **fetch nativo** | Cliente HTTP incorporado en Next.js |

### Base de Datos

| Componente | Tecnología |
|---|---|
| Motor | **PostgreSQL 16** |
| Local | Instalación local en la máquina de desarrollo |
| Producción | Render o Railway (PostgreSQL gestionado) |
| Pool de conexiones | `pg` + `pg-pool` (Node.js) |
| Migraciones | Archivos SQL en `supabase/` |

### Bots

| Componente | Tecnología |
|---|---|
| Lenguaje | **Python 3.13** |
| Automatización | **Playwright** (Chromium headless/full) |
| Proxies | Residenciales españoles (20 disponibles) |
| BD | `psycopg2` o `asyncpg` para PostgreSQL |

### Comunicaciones

| Componente | Tecnología |
|---|---|
| Centralita | **VPBX** (https://vpbx.me) |
| Click2Call | API REST VPBX |
| CDR | API REST VPBX (registro de llamadas) |
| Webhooks | Eventos RINGING / ANSWERED / HANGUP |
| Grabaciones | MP3 vía API VPBX → Cloudflare R2 |

### Despliegue

| Componente | Local | Producción |
|---|---|---|
| Web + API | `localhost:3000` | **Vercel** (Free → Pro) |
| BD | PostgreSQL local | **Render** (Free → $7/mes) |
| Archivos | Carpeta `uploads/` | **Cloudflare R2** (Free 10GB) |

---

## 4. Arquitectura General

```
                        ┌──────────────────────────────────┐
                        │       NEXT.JS (Vercel)            │
                        │                                   │
                        │  ┌─────────────────────────────┐  │
                        │  │     API Routes              │  │
                        │  │  /api/auth                  │  │
                        │  │  /api/clientes              │  │
                        │  │  /api/vpbx/originate        │  │
                        │  │  /api/webhooks/vpbx         │  │
                        │  └─────────────────────────────┘  │
                        │                                   │
                        │  ┌─────────────────────────────┐  │
                        │  │     Páginas (App Router)     │  │
                        │  │  /asesor                     │  │
                        │  │  /supervisor                 │  │
                        │  │  /jefe                       │  │
                        │  │  /backoffice                 │  │
                        │  │  /admin                      │  │
                        │  │  /clientes                   │  │
                        │  │  /power-dialer               │  │
                        │  │  /wikiratioo                 │  │
                        │  └─────────────────────────────┘  │
                        └──────────────┬───────────────────┘
                                       │
          ┌────────────────────────────┼────────────────────────────┐
          │                            │                            │
          ▼                            ▼                            ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   PostgreSQL      │       │   VPBX API        │       │  Cloudflare R2   │
│   (Render/Railway)│       │   (Centralita)    │       │  (Archivos)      │
│                   │       │                   │       │                  │
│   clientes        │       │   Click2Call      │       │  Grabaciones     │
│   proyectos       │       │   CDR             │       │  Documentos      │
│   pipeline        │       │   Webhooks        │       │  Capturas        │
│   historial       │       │   Agentes         │       │                  │
│   usuarios        │       │   Grabaciones     │       │                  │
└──────────────────┘       └──────────────────┘       └──────────────────┘
          ▲
          │
          │
┌─────────┴─────────┐
│   BOTS (Python)    │
│                    │
│   ┌──────────────┐ │
│   │ Orange Bot   │ │
│   │ Coordinator  │ │
│   │ Worker 1     │ │── Proxy A (España)
│   │ Worker 2     │ │── Proxy B (España)
│   │ Worker N     │ │── Proxy N (España)
│   └──────────────┘ │
│                    │
│   ┌──────────────┐ │
│   │ Mainjobs Bot │ │  ← Futuro
│   └──────────────┘ │
└────────────────────┘
```

---

## 5. Modelo de Datos

### Core: `clientes`

La tabla central del sistema. Cada cliente es único y se identifica por `(tipo_documento, numero_documento)`.

| Tipo de documento | Ejemplo | Quién es |
|---|---|---|
| `DNI` | 12345678A | Persona natural |
| `NIE` | X1234567L | Extranjero |
| `NIF` | B12345678 | Empresa |
| `NIF` | 12345678Z | Autónomo |

### Datos por proyecto: `clientes_proyectos`

Cada proyecto guarda su propia información en un campo `JSONB` llamado `datos`. No hay límite de estructura — cada proyecto escribe lo que necesita.

**Ejemplo de datos de Orange:**
```json
{
  "lineas": [
    {
      "numero": "622534699",
      "plan": "Línea Smartphone Sin Límites",
      "activo_desde": "28/05/2013",
      "etiquetas": ["Principal", "CIMA"],
      "estado": { "hotline": true, "suspendida": false },
      "consumo": "28.34GB",
      "permanencia": { "fecha_fin": "27/10/2027" },
      "venta_plazos": { "activa": true, "cuotas": "48.74€/mes" }
    }
  ],
  "permanencias_vap": [{ "producto": "iPhone 16 Pro", "cuotas": "48" }],
  "facturas": { "MAY": "182.64€" },
  "consumo_grupo": { "total": "104.75GB" }
}
```

### Historial: `historial`

Timeline único que acumula todas las interacciones sin importar el proyecto:
- Extracciones del bot
- Llamadas (desde VPBX)
- Tipificaciones del asesor
- Cambios de estado en el pipeline
- Compras, cursos, eventos futuros

### Pipeline: `pipeline`

Estado comercial actual del cliente en cada proyecto:

```
Pendiente → Contactado → Interesado → Negociación → Venta → Tramitado → Activado
                                                         → No Interesa
                                                         → No Contesta
```

---

## 6. Bots Automatizados

### Bot Orange (actual)

El bot navega la plataforma Pangea de Orange España, busca clientes por DNI y extrae toda su información comercial.

**Tecnología:** Python + Playwright (Chromium)
**Proxies:** 20 proxies residenciales españoles (rotación 1:1)

**Flujo:**
1. Coordinator lanza N workers como procesos hijos
2. Cada worker inicia Chromium con su proxy exclusivo
3. Login en Pangea Orange (reintentos infinitos si hay error de sesiones)
4. Toma un DNI de la cola (con `FOR UPDATE SKIP LOCKED` para evitar duplicados)
5. Busca el DNI, extrae todas las líneas con sus datos
6. Guarda en `clientes_proyectos.datos` + registra en `historial`
7. Pasa al siguiente DNI

**Lo que extrae por cada cliente:**
- Nombre, dirección, seguros, paquete contratado
- **Cada línea:** número, plan, estado, consumo, permanencia, VAP
- **Cada pestaña:** Destacadas, Renove, Bonos, SVA, Cambio Tarifa
- **Secciones:** Permanencias/VAP, Descuentos, Facturas, Consumo de grupo
- Indicador CIMA global

### Bots futuros

La arquitectura permite agregar nuevos bots (Mainjobs, impresoras, seguros...) sin modificar el core del sistema. Cada bot escribe en `clientes_proyectos` con su propio `proyecto_id`.

---

## 7. Power Dialer (VPBX)

### ¿Qué es?

El Power Dialer reemplaza a Sicca. Los asesores llaman a los leads directamente desde el CRM, sin copiar números ni usar otro sistema.

### Click2Call

1. El asesor ve un lead en el Power Dialer
2. Hace clic en "Llamar"
3. Next.js API llama a VPBX: `GET /api/originatecall/{ext}/{telefono}`
4. VPBX hace sonar el teléfono del asesor
5. El asesor descuelga → VPBX marca al cliente
6. Webhook de VPBX notifica: RINGING → ANSWERED → HANGUP
7. El CRM guarda la llamada en el historial

### Registro de llamadas (CDR)

VPBX guarda de cada llamada:
- Quién llamó (extensión del asesor)
- A quién llamó (teléfono del cliente)
- Cuánto duró (timbre y conversación)
- Si contestaron o no (`billsec > 0`)
- Por qué terminó (`hangupCause`)
- Grabación disponible (MP3)

### Re-análisis inteligente

El bot cruza el CDR de VPBX con la tipificación del CRM para decidir si un lead necesita re-analizarse:

| Llamada real (CDR) | Tipificación (CRM) | Acción |
|---|---|---|
| Contestó | Venta | Re-analizar en 3 meses |
| Contestó | No interesa | No re-analizar |
| No contestó | (vacío) | Re-analizar en 7 días |
| No llamó | (vacío) | Re-analizar AHORA |
| No llamó | Venta | ⚠️ Posible fraude |

---

## 8. Pipeline Comercial

### Estados

1. **Pendiente** — El bot extrajo los datos, el lead espera su primera llamada
2. **Contactado** — El asesor llamó (verificado por CDR o tipificación manual)
3. **Interesado** — El cliente mostró interés
4. **Negociación** — En proceso de cierre
5. **Venta** — Cerrado, se adjuntan documentos (capturas, contratos PDF)
6. **Tramitado** — Backoffice verificó y tramitó la venta
7. **Activado** — Servicio activado, fin del ciclo
8. **No interesa** — Cliente rechazó
9. **No contesta** — Se reintenta en 7 días

### Flujo de ventas

```
[Asesor] marca VENTA + sube documentos
    ↓
[Backoffice] recibe notificación (badge en sidebar)
    ↓
[Backoffice] revisa documentos → cambia a TRAMITADO
    ↓
[Backoffice] confirma activación → cambia a ACTIVADO
    ↓
[Bot] re-analiza en 3 meses
```

### Notificaciones

- Badge en el sidebar de backoffice con el conteo de ventas pendientes de tramitar
- El badge se actualiza en tiempo real (polling o WebSocket)

---

## 9. Wikiratioo (Formación)

Módulo de formación para nuevas incorporaciones. Reemplaza la necesidad de formadores presenciales.

### Funcionalidades

- **Cursos:** Videos (embed), PDF, contenido markdown
- **Cuestionarios:** Preguntas de opción múltiple con evaluación automática
- **Progreso:** Qué operador vio qué curso, resultados de exámenes
- **Certificado:** Al completar un curso con nota mínima
- **Admin:** Crear cursos, asignar a roles, ver progreso del equipo

---

## 10. Roles y Permisos

| Rol | Responsabilidad | Acceso |
|---|---|---|
| **Asesor** | Realiza llamadas, tipifica leads | Dashboard, Power Dialer, Agenda, Wikiratioo |
| **Supervisor** | Gestiona equipo de asesores | Dashboard, Clientes, Power Dialer, Agenda, Metas, Alertas |
| **Jefe Área** | Dueño del negocio, configura proyectos | Dashboard, Clientes, Proyectos, Metas, Alertas, Usuarios, Infraestructura, Bots |
| **Back Office** | Tramita ventas | Dashboard, Tramitacion |
| **Admin/IT** | Soporte técnico | Dashboard, Clientes, Usuarios, Infraestructura, Bots, Documentos |

---

## 11. Concurrencia y Escenarios de Fallo

### Riesgos identificados y mitigaciones

| # | Escenario | Impacto | Mitigación |
|---|---|---|---|
| 1 | Dos workers procesan el mismo DNI | Se pisan los datos | `FOR UPDATE SKIP LOCKED` |
| 2 | Deadlock entre workers | Workers se cuelgan | Orden fijo de tablas + timeout automático |
| 3 | Pool de BD se agota (100+ asesores) | Queries lentas | Pool de 20 conexiones + `statement_timeout` 30s |
| 4 | Proxy muere | Worker no puede acceder a Orange | Reintentar con otro proxy (20 disponibles) |
| 5 | Orange caído o sesiones saturadas | No se pueden extraer datos | Reintentos infinitos cada 60s |
| 6 | Asesor modifica datos de otro asesor | Inconsistencias | Validación por rol en cada API call |
| 7 | SQL injection | Pérdida de datos | Queries parametrizadas (siempre) |
| 8 | JSON corrupto en BD | Frontend se rompe | Validación antes de insertar |
| 9 | Borrado accidental | Pérdida de histórico | Soft delete (`deleted_at`) |
| 10 | 500 Click2Call simultáneos | Saturación de VPBX | Rate limiting (1 llamada/5s por asesor) |
| 11 | Bot se cuelga | No procesa DNIs | Watchdog: heartbeat cada 30s, reiniciar si >2min sin reportar |
| 12 | RAM insuficiente en máquina del bot | Workers se matan | Auto-límite de workers según RAM disponible |
| 13 | Disco lleno de logs | Bot falla | Rotación automática de logs |

---

## 12. Plan de Desarrollo

### Fase 1 — MVP (local)
- [ ] PostgreSQL local + migraciones
- [ ] Next.js con autenticación (NextAuth.js)
- [ ] Power Dialer básico (sin VPBX, modo manual)
- [ ] Pipeline: Venta → Tramitado → Activado
- [ ] Wikiratioo: cursos + cuestionarios
- [ ] Bot Orange: extracción estructurada a BD

### Fase 2 — Integración VPBX
- [ ] Click2Call desde el CRM
- [ ] Sincronización de CDR
- [ ] Webhooks (RINGING, ANSWERED, HANGUP)
- [ ] Re-análisis inteligente (CDR + pipeline)
- [ ] Grabaciones de llamadas

### Fase 3 — Producción
- [ ] Deploy: Vercel + Render + R2
- [ ] Pruebas con 10 asesores reales
- [ ] Ajustes de rendimiento
- [ ] Monitoreo y alertas

### Fase 4 — Crecimiento
- [ ] Nuevos proyectos (Mainjobs, impresoras...)
- [ ] Nuevos bots
- [ ] 100+ asesores
- [ ] Optimización de consultas

---

## 13. Costos

### Desarrollo (local)

| Componente | Costo |
|---|---|
| Next.js | $0 |
| PostgreSQL | $0 |
| Python | $0 |
| Proxies | Ya los tienes |
| **Total** | **$0/mes** |

### Producción (inicial, 10-50 asesores)

| Componente | Servicio | Costo |
|---|---|---|
| Web + API | Vercel Free | $0 |
| BD | Render Free (1GB RAM) | $0 |
| Archivos | Cloudflare R2 (10GB free) | $0 |
| VPBX | Plan existente | ? |
| **Total** | | **~$0/mes + VPBX** |

### Escalado (+100 asesores)

| Componente | Upgrade | Costo |
|---|---|---|
| Web | Vercel Pro | $20/mes |
| BD | Render Pro (2GB RAM) | $7/mes |
| Archivos | R2 pago | ~$0.015/GB/mes |
| **Total** | | **~$30/mes + VPBX** |
