# 🏗️ Oratioo CX — Arquitectura del Sistema

> Stack: Next.js + PostgreSQL (local) → Vercel + Render (producción)
> Versión: 2.0 — Con análisis de concurrencia y escenarios de fallo

---

## 🌐 Frontend

### Framework

| Componente | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) |
| Lenguaje | TypeScript (tipado estricto) |
| Estilos | Tailwind CSS 4 |
| UI Components | shadcn/ui (headless, personalizables) |
| Iconos | Lucide React |
| Graficos | Recharts |
| Estado global | React Context + Zustand |
| Formularios | React Hook Form + Zod |
| HTTP Client | fetch nativo |
| Tablas | TanStack Table |

### Design System

- Paleta: Morado (#481163) + Azul (#0a6ea9) + Gris neutro
- Tipografia: Inter (system font)
- Responsive: mobile-first con Tailwind

### Paginas por Rol

| Ruta | Pagina | Roles |
|---|---|---|
| /asesor | Dashboard Asesor | asesor |
| /supervisor | Dashboard Supervisor | supervisor |
| /jefe | Dashboard Jefe | jefe_area |
| /backoffice | Dashboard Backoffice | back_office |
| /admin | Dashboard Admin | it, admin |
| /clientes | Ficha 360 del cliente | supervisor, jefe, admin |
| /power-dialer | Discador VPBX | asesor, supervisor |
| /agenda | Callbacks | asesor, supervisor |
| /wikiratioo | Formacion | todos |
| /tramitacion | Pipeline ventas | back_office |
| /proyectos | Admin de campanas | jefe, admin |
| /usuarios | Gestion usuarios | jefe, admin |
| /infraestructura | Maquinas, proxies | admin |
| /bots | Control de bots | admin |
| /documentos | Subida de DNIs | admin, supervisor |


## Estructura del Proyecto

```
Oratioo_CX/
│
├── bots/                          ← Bots en Python (locales)
│   ├── orange/                    ← Bot Pangea Orange
│   │   ├── coordinator.py         ← Orquestador multi-worker
│   │   ├── worker.py              ← Worker individual
│   │   ├── login.py               ← Login + extracción Orange
│   │   ├── browser_setup.py       ← Config navegador + proxy
│   │   ├── supabase_client.py     ← Adaptador PostgreSQL (service role)
│   │   ├── agente.py              ← Agente remoto (comandos)
│   │   └── asesor_agent.py        ← Agente para asesores
│   ├── mainjobs/                  ← Futuro bot Mainjobs
│   └── shared/                    ← Código compartido entre bots
│
├── src/                           ← Next.js (App Router)
│   ├── app/
│   │   ├── (auth)/                ← Login, registro
│   │   ├── (dashboard)/           ← Páginas protegidas por rol
│   │   │   ├── asesor/
│   │   │   ├── supervisor/
│   │   │   ├── jefe/
│   │   │   ├── backoffice/
│   │   │   └── admin/
│   │   ├── api/                   ← API Routes
│   │   │   ├── auth/              ← Login, logout, session
│   │   │   ├── clientes/          ← CRUD clientes
│   │   │   ├── proyectos/         ← CRUD proyectos
│   │   │   ├── pipeline/          ← Estados comerciales
│   │   │   ├── historial/         ← Timeline
│   │   │   ├── documentos/        ← Subida de DNIs
│   │   │   ├── webhooks/          ← VPBX callbacks
│   │   │   └── vpbx/              ← Click2Call, CDR
│   │   └── layout.tsx
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── ProtectedRoute.tsx
│   │   ├── TimelineCliente.tsx
│   │   ├── FichaCliente.tsx
│   │   ├── CallButton.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── db.ts                  ← Pool de conexiones PostgreSQL
│   │   ├── auth.ts                ← NextAuth.js
│   │   ├── vpbx.ts                ← Cliente VPBX
│   │   └── storage.ts             ← Archivos locales / R2
│   └── middleware.ts              ← Protección de rutas
│
├── supabase/                      ← Migraciones SQL
│   ├── 001_clientes.sql
│   ├── 002_proyectos.sql
│   └── ...
│
├── docs/
│   └── Arquitectura Completa.md
│
├── .env.local
├── next.config.js
├── package.json
└── tsconfig.json
```

---

## Base de Datos — PostgreSQL

### Tabla: `clientes` — Core del sistema

```sql
CREATE TABLE clientes (
    id_cliente TEXT PRIMARY KEY,        -- "DNI_12345678A" | "NIE_X1234567L" | "NIF_B12345678"
    tipo_documento TEXT NOT NULL,       -- DNI | NIE | NIF
    numero_documento TEXT NOT NULL,
    nombre_razon_social TEXT,
    tipo_persona TEXT,                  -- natural | autonomo | empresa
    cnae TEXT,                          -- Código actividad económica
    telefonos JSONB DEFAULT '[]',
    emails JSONB DEFAULT '[]',
    direccion JSONB DEFAULT '{}',
    datos_extra JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_clientes_tipo_doc ON clientes (tipo_documento, numero_documento);
CREATE INDEX idx_clientes_nombre ON clientes USING GIN (to_tsvector('spanish', nombre_razon_social));
CREATE INDEX idx_clientes_telefonos ON clientes USING GIN (telefonos);
```

### Tabla: `proyectos` — Campañas / Proyectos

```sql
CREATE TABLE proyectos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,         -- "orange" | "mainjobs"
    nombre_visible TEXT NOT NULL,
    activo BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabla: `clientes_proyectos` — Datos del cliente POR proyecto

```sql
CREATE TABLE clientes_proyectos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    proyecto_id BIGINT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    datos JSONB DEFAULT '{}',
    ultima_extraccion TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(id_cliente, proyecto_id)
);

CREATE INDEX idx_cp_cliente ON clientes_proyectos (id_cliente);
CREATE INDEX idx_cp_proyecto ON clientes_proyectos (proyecto_id);
CREATE INDEX idx_cp_datos ON clientes_proyectos USING GIN (datos);
```

### Tabla: `historial` — Timeline único

```sql
CREATE TABLE historial (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    tipo TEXT NOT NULL,                  -- "llamada" | "extraccion" | "tipificacion" | "curso" | "compra"
    proyecto_id BIGINT REFERENCES proyectos(id),
    asesor_id BIGINT,
    descripcion TEXT,
    datos JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_historial_cliente ON historial (id_cliente);
CREATE INDEX idx_historial_fecha ON historial (created_at DESC);
CREATE INDEX idx_historial_tipo ON historial (tipo);
```

### Tabla: `pipeline` — Estado comercial

```sql
CREATE TABLE pipeline (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    proyecto_id BIGINT NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    asesor_id BIGINT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente',
        CHECK (estado IN ('pendiente','contactado','interesado','negociacion',
                          'venta','tramitado','activado','no_interesa','no_contesta')),
    notas TEXT,
    documentos JSONB DEFAULT '[]',
    callback_at TIMESTAMPTZ,
    ultimo_cambio TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(id_cliente, proyecto_id, asesor_id)
);

CREATE INDEX idx_pipeline_asesor ON pipeline (asesor_id);
CREATE INDEX idx_pipeline_estado ON pipeline (estado);
CREATE INDEX idx_pipeline_callback ON pipeline (callback_at) WHERE callback_at IS NOT NULL;
```

### Tabla: `usuarios` — Con NextAuth.js

```sql
CREATE TABLE usuarios (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'asesor',
        CHECK (rol IN ('asesor','supervisor','jefe_area','back_office','it','desarrollador')),
    equipo TEXT,                         -- "España" | "Perú"
    supervisor_id BIGINT REFERENCES usuarios(id),
    activo BOOLEAN DEFAULT true,
    ultima_conexion TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabla: `comandos_bot` — Para control remoto de workers

```sql
CREATE TABLE comandos_bot (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    maquina_destino TEXT NOT NULL,
    comando TEXT NOT NULL,               -- "iniciar" | "detener" | "pausar" | "reanudar" | "reset_queue"
    parametros JSONB DEFAULT '{}',
    estado TEXT DEFAULT 'pendiente',
        CHECK (estado IN ('pendiente','en_curso','completado','fallo')),
    created_at TIMESTAMPTZ DEFAULT now(),
    ejecutado_at TIMESTAMPTZ
);
```

---

## JSONB — `clientes_proyectos.datos`

### Proyecto: `orange`

```json
{
  "ultima_extraccion": "2026-06-02T14:30:00Z",
  "header": {
    "nombre": "Juan Pérez López",
    "dni": "12345678A",
    "direccion": "C/ Mayor 123, Madrid",
    "seg_fijo": "N/A",
    "seg_movil": "Básico",
    "paquete": "Love Futbol Total 4 2024"
  },
  "lineas": [
    {
      "numero": "622534699",
      "plan": "Línea Smartphone Sin Límites",
      "activo_desde": "28/05/2013",
      "etiquetas": ["Principal", "CIMA"],
      "estado": {
        "hotline": true,
        "suspendida": false,
        "impago": false,
        "fraude": false
      },
      "consumo": { "datos": "28.34GB", "tipo": "ilimitados" },
      "permanencia": { "tipo": "fecha_fin", "fecha_fin": "27/10/2027" },
      "venta_plazos": {
        "activa": true,
        "cuotas": 5,
        "importe_mensual": "48.74€",
        "total_pendiente": "243.70€"
      },
      "pestanas": {
        "destacadas": [
          { "titulo": "Renove", "valor": "RENOVE MULTIDISPOSITIVO" }
        ],
        "renove": [
          {
            "titulo": "RENOVE MULTIDISPOSITIVO",
            "variante": "multidispositivo"
          }
        ],
        "bonos": [],
        "sva": [],
        "cambio_tarifa": []
      }
    }
  ],
  "permanencias_vap": [
    {
      "linea": "625123483",
      "motivo": "Móvil: Descuento aplicado",
      "fecha_inicio": "22/05/2025",
      "fecha_fin": "22/05/2027",
      "duracion": "24 meses",
      "modalidad": "ESTANDAR",
      "importe": "135,00 €",
      "vaps": [
        {
          "producto": "OPPO A80 5G",
          "cuotas": "24",
          "importe_mensual": "6,90€",
          "total": "41,40 €"
        }
      ]
    }
  ],
  "descuentos": [],
  "facturas": { "DIC": "178,59€", "ENE": "177,96€", "FEB": "183,32€" },
  "consumo_grupo": {
    "total": "104,75GB",
    "limite": "ilimitados",
    "por_linea": [{ "numero": "601262363", "consumo": "28,87GB" }]
  },
  "cima_global": true
}
```

---

## Concurrencia y Escenarios de Fallo

### 1. Bloqueos y Condiciones de Carrera

#### Escenario: Dos asesores tipifican el mismo cliente a la vez

```
Asesor A click "Venta"        Asesor B click "No Interesa"
           │                            │
           ▼                            ▼
    UPDATE pipeline SET           UPDATE pipeline SET
    estado='venta'                estado='no_interesa'
    WHERE id_cliente=X            WHERE id_cliente=X
           │                            │
           ▼                            ▼
     Gana el último en escribir → ⚠️ Se pisa el estado
```

**Solución:** `SELECT ... FOR UPDATE` (bloqueo pesimista) o `updated_at` como condición de update.

```sql
-- Transacción atómica
BEGIN;
  SELECT * FROM pipeline WHERE id = X FOR UPDATE;
  -- Verificar que nadie más lo tocó
  UPDATE pipeline SET estado = 'venta', ultimo_cambio = now()
  WHERE id = X;
COMMIT;
```

#### Escenario: El bot y un asesor modifican el mismo registro

```
Bot: extrae datos → UPDATE clientes_proyectos SET datos = {...}
Asesor: tipifica → UPDATE pipeline SET estado = 'contactado'

No hay conflicto porque son tablas diferentes.
El bot escribe en clientes_proyectos.datos
El asesor escribe en pipeline.estado
```

**No hay condición de carrera** entre bot y frontend.

#### Escenario: Dos workers del bot procesan el mismo DNI

```
Worker A procesa DNI 12345678A
Worker B procesa DNI 12345678A (lo mismo)

→ UPSERT: el segundo UPDATE sobrescribe al primero
→ Se pierden datos si el primero tenía más info que el segundo
```

**Solución:** Cada worker toma un DNI exclusivo con `UPDATE ... LIMIT 1` atómico:

```sql
WITH tomado AS (
  UPDATE clientes_proyectos
  SET datos = jsonb_set(datos, '{estado}', '"procesando"')
  WHERE id = (
    SELECT id FROM clientes_proyectos
    WHERE proyecto_id = 1 AND datos->>'estado' = 'pendiente'
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id
)
SELECT * FROM clientes_proyectos WHERE id IN (SELECT id FROM tomado);
```

`FOR UPDATE SKIP LOCKED` evita que dos workers tomen el mismo registro.

---

### 2. Deadlocks

#### Escenario: Deadlock entre workers

```
Worker A: UPDATE clientes_proyectos WHERE id=1
Worker B: UPDATE clientes_proyectos WHERE id=2
Worker A: UPDATE pipeline WHERE id_cliente=1  ← espera lock de B
Worker B: UPDATE pipeline WHERE id_cliente=2  ← espera lock de A
                              → DEADLOCK!
```

**Solución:** Siempre actualizar en el mismo orden de tablas:

1. Primero `clientes_proyectos`
2. Luego `pipeline`
3. Luego `historial`

**Y timeout:** PostgreSQL mata el deadlock automáticamente después de `deadlock_timeout` (1s por defecto). El worker reintenta.

---

### 3. Timeouts y Conexiones

#### Escenario: 20 workers + 100 asesores → muchas conexiones a PostgreSQL

**Riesgo:** Cada worker abre una conexión. Cada página del frontend abre otra. Se agota el pool.

**Solución:**

- Pool de conexiones: `pgbouncer` o `pg-pool` en Node.js
- Máximo 20 conexiones simultáneas desde el frontend
- Workers usan pool compartido (service_role) con máximo 10 conexiones
- Las queries lentas se matan después de 30s (`statement_timeout`)

```typescript
// lib/db.ts
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Máximo 20 conexiones simultáneas
  idleTimeoutMillis: 30000,
  statement_timeout: 30000, // Queries lentas: kill después de 30s
});
```

---

### 4. Reintentos y Fallos de Red

#### Escenario: Orange falla, proxy muere, red se cae

**El bot debe:**

1. Reintentar login hasta 60s entre intentos (infinito si es error de sesiones)
2. Si un proxy falla 3 veces → marcarlo como caído y usar otro
3. Si Orange responde con error → marcar DNI como `error_reintentar` y seguir
4. Si la BD no responde → esperar 5s y reintentar, hasta 3 veces
5. Si todo falla → loguear y esperar 30s antes de reintentar

```python
# Bot strategy
MAX_REINTENTOS_PROXY = 3
MAX_REINTENTOS_DB = 3
ESPERA_BASE = 5  # segundos
```

#### Escenario: 500 asesores hacen clic en "Llamar" a la vez

**Riesgo:** Click2Call masivo satura VPBX y PostgreSQL.

**Solución:**

- Rate limiting en API: máximo 1 llamada por asesor cada 5 segundos
- Click2Call es asíncrono: el frontend llama a la API, la API lanza la llamada VPBX, responde OK sin esperar que el asesor descuelgue
- El frontend se actualiza vía WebSocket cuando el asesor descuelga

```typescript
// Rate limiter simple en Next.js API
const RATE_LIMIT = new Map<string, number>();

export async function POST(req: Request) {
  const asesorId = req.headers.get("x-asesor-id");
  const lastCall = RATE_LIMIT.get(asesorId);

  if (lastCall && Date.now() - lastCall < 5000) {
    return Response.json({ error: "Demasiado rápido" }, { status: 429 });
  }

  RATE_LIMIT.set(asesorId, Date.now());
  // ... lanzar llamada VPBX
}
```

---

### 5. Seguridad

#### Escenario: Un asesor modifica el pipeline de otro asesor

**Solución:** RLS a nivel de API (PostgreSQL + middleware de Next.js):

```typescript
// API route protegida
export async function PATCH(req: Request) {
  const session = await getSession(req);
  const body = await req.json();

  // Un asesor solo puede modificar sus propios registros
  if (session.rol === "asesor") {
    const result = await db.query(
      `UPDATE pipeline SET estado = $1
       WHERE id = $2 AND asesor_id = $3`,
      [body.estado, body.id, session.userId],
    );
  }
}
```

#### Escenario: SQL injection

**Solución:** Siempre usar queries parametrizadas (nunca concatenar strings).

```typescript
//  MALO
await db.query(`SELECT * FROM clientes WHERE dni = '${dni}'`);

//  BUENO
await db.query("SELECT * FROM clientes WHERE dni = $1", [dni]);
```

---

### 6. Pérdida de Datos

#### Escenario: El bot escribe datos corruptos en JSONB

**Solución:**

- Validar JSON antes de insertar: `jsonb` type de PostgreSQL rechaza JSON inválido
- Worker valida estructura mínima antes de escribir
- Tabla `historial` guarda un respaldo del raw data extraído

```python
# En el worker
def validar_datos_extraccion(datos: dict) -> bool:
    """Valida que los datos tengan la estructura mínima esperada."""
    campos_requeridos = ['lineas', 'header']
    for campo in campos_requeridos:
        if campo not in datos:
            log(f"[VALIDACION] Falta campo requerido: {campo}")
            return False

    if not isinstance(datos.get('lineas'), list):
        return False

    return True
```

#### Escenario: Se borra un registro accidentalmente

**Solución:**

- `ON DELETE CASCADE` controlado: solo en tablas hijas
- `deleted_at` (soft delete) en tablas críticas: `clientes`, `pipeline`
- Logs de cambios: tabla `auditoria` para cambios de estado en pipeline

```sql
-- Soft delete en pipeline
ALTER TABLE pipeline ADD COLUMN deleted_at TIMESTAMPTZ;
-- En vez de DELETE, hacer:
UPDATE pipeline SET deleted_at = now() WHERE id = X;
```

---

### 7. Escalabilidad

#### Escenario: 10,000 DNIs encolados, 20 workers procesando

**Cuello de botella:**

- 20 navegadores Chrome abiertos → ~20 GB RAM
- 20 conexiones PostgreSQL ocupadas constantemente
- Orange limita sesiones simultáneas

**Soluciones:**

- Máximo 10 workers por máquina (por RAM)
- Si se necesita más, distribuir en varias máquinas (cada una con su coordinator)
- Orange permite ~3-5 sesiones simultáneas por cuenta → usar cola, no workers paralelos

```python
# Coordinator auto-limita según recursos del sistema
import psutil

def calcular_workers_optimos():
    ram_disponible = psutil.virtual_memory().available / (1024**3)  # GB
    return max(1, min(10, int(ram_disponible / 2)))  # ~2GB por worker
```

---

## Matriz de Escenarios de Fallo

| #   | Escenario                           | Probabilidad | Impacto | Mitigación                                  |
| --- | ----------------------------------- | ------------ | ------- | ------------------------------------------- |
| 1   | Dos workers toman mismo DNI         | Alta         | Medio   | `FOR UPDATE SKIP LOCKED`                    |
| 2   | Deadlock entre workers              | Baja         | Alto    | Orden fijo de tablas + timeout              |
| 3   | Pool de BD se agota                 | Media        | Alto    | Pool de 20 conexiones + statement_timeout   |
| 4   | Proxy muere                         | Alta         | Bajo    | Reintentar con otro proxy                   |
| 5   | Orange caído                        | Media        | Alto    | Reintentos infinitos c/60s                  |
| 6   | Asesor modifica datos ajenos        | Baja         | Medio   | RLS por API + middleware                    |
| 7   | SQL injection                       | Baja         | Crítico | Queries parametrizadas                      |
| 8   | JSON corrupto en BD                 | Baja         | Medio   | Validación antes de insertar                |
| 9   | Datos borrados por error            | Baja         | Alto    | Soft delete en tablas críticas              |
| 10  | Pico de 500 llamadas Click2Call     | Baja         | Medio   | Rate limiting + cola asíncrona              |
| 11  | Bot se cuelga y no reporta          | Media        | Medio   | Watchdog: si no heartbeat > 2min, reiniciar |
| 12  | Sesiones de Orange saturadas        | Alta         | Medio   | Reintentos infinitos c/60s                  |
| 13  | RAM insuficiente en máquina del bot | Media        | Alto    | Auto-límite de workers                      |
| 14  | Disco lleno de logs                 | Baja         | Medio   | Rotación de logs automática                 |

---

## Integración VPBX

### API VPBX

| Endpoint                         | Uso                                               |
| -------------------------------- | ------------------------------------------------- |
| `GET /api/originatecall/FROM/TO` | Click2Call (suena en extensión, llama al cliente) |
| `POST /api/cdr`                  | Consultar registro de llamadas                    |
| `GET /api/cdr/{callId}`          | Datos de una llamada                              |
| `POST /api/cdrcount`             | Contar llamadas                                   |
| `GET /api/recording/{callId}`    | Descargar grabación MP3                           |
| `GET /api/agent`                 | Listar agentes                                    |
| `Webhook`                        | RINGING / ANSWERED / HANGUP                       |

### Lógica de Re-Análisis

```
CDR dice          | Pipeline dice  | Acción
──────────────────|────────────────|──────────────────────
Llamó + contestó  | venta          | Re-analizar en 3 meses
Llamó + contestó  | no_interesa    | No re-analizar
Llamó + NO contestó| (vacío)       | Re-analizar en 7 días
NO llamó          | (vacío)        | Re-analizar AHORA
NO llamó          | venta          | 🚩 Posible fraude
```

---

## Roles del Sistema

| Rol             | Acceso principal                                                                |
| --------------- | ------------------------------------------------------------------------------- |
| **Asesor**      | Dashboard, Power Dialer, Agenda, Wikiratioo                                     |
| **Supervisor**  | Dashboard, Clientes, Power Dialer, Agenda, Metas, Alertas                       |
| **Jefe Área**   | Dashboard, Clientes, Proyectos, Metas, Alertas, Usuarios, Infraestructura, Bots |
| **Back Office** | Dashboard, Tramitacion                                                          |
| **Admin/IT**    | Dashboard, Clientes, Usuarios, Infraestructura, Bots, Documentos                |

---

## Pipeline Comercial

```
Pendiente → Contactado → Interesado → Negociación → Venta → Tramitado → Activado
                                                         → No Interesa
                                                         → No Contesta → reintentar 7d
```

Venta → re-analizar en 3 meses (el bot revisa si hay nueva oportunidad).

---

## Wikiratioo — Formación

```
Cursos (video, PDF) → Cuestionarios → Evaluación automática → Certificado
Admin crea cursos → Asigna a roles → Asesor completa → Progreso visible
```

---

## Plan de Deploy

| Fase                        | Frontend             | BD                  | Archivos                  |
| --------------------------- | -------------------- | ------------------- | ------------------------- |
| Desarrollo                  | `localhost:3000`     | PostgreSQL local    | Carpeta `uploads/`        |
| Producción inicial          | Vercel Free          | Render Free ($0)    | Cloudflare R2 (10GB free) |
| Crecimiento (+100 asesores) | Vercel Pro ($20/mes) | Render Pro ($7/mes) | R2 pago (~$0.015/GB/mes)  |
