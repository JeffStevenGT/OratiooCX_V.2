# 🔧 Manual Técnico — Oratioo CX

## Arquitectura del Sistema

```
                    ┌─────────────────────────────┐
                    │       Supabase (Nube)        │
                    │  ┌───────────────────────┐   │
                    │  │  PostgreSQL + JSONB    │   │
                    │  │                       │   │
                    │  │  lineas               │   │
                    │  │  maquinas             │   │
                    │  │  config_bots          │   │
                    │  │  logs_bot             │   │
                    │  │  documentos           │   │
                    │  └───────────────────────┘   │
                    └──────────┬──────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
    ┌─────┴─────┐      ┌─────┴─────┐      ┌──────┴─────┐
    │  Web UI   │      │ Máquina 1 │      │  Máquina 2 │
    │ Vercel    │      │ Coord.    │      │  Coord.    │
    │           │      │ ├─W1 PA   │      │  ├─W4 PD   │
    │ React     │      │ ├─W2 PB   │      │  ├─W5 PE   │
    │ Supabase  │      │ └─W3 PC   │      │  └─W6 PF   │
    │ anon key  │      │           │      │            │
    └───────────┘      └───────────┘      └────────────┘
```

### Comunicación

- **Todos los componentes** se comunican exclusivamente con Supabase REST API
- **No hay comunicación directa** entre máquinas ni entre web y bots
- **No hay API intermedia** — se eliminó para simplificar

---

## 📁 Estructura del Proyecto

```
Oratioo_CX/
├── .env                     ← Variables de entorno
├── Roadmap.md               ← Roadmap del proyecto
├── bot/                     ← Código del bot Python
│   ├── main.py              ← Entry point (modo individual)
│   ├── coordinator.py       ← Orquestador multi-worker
│   ├── worker.py            ← Worker individual
│   ├── login.py             ← Login + extracción Orange
│   ├── browser_setup.py     ← Config navegador + proxy
│   ├── supabase_client.py   ← Cliente REST Supabase
│   ├── proxies.txt          ← Lista de proxies
│   ├── numeros.txt          ← DNIs de prueba
│   └── requirements.txt     ← pip freeze
├── web/                     ← Web UI (React + Vite)
│   ├── src/
│   │   ├── App.jsx
│   │   ├── supabaseClient.js
│   │   ├── pages/
│   │   │   └── *.jsx
│   │   └── components/
│   │       └── *.jsx
│   ├── package.json
│   └── vite.config.js
└── docs/                    ← Documentación
    ├── README.md
    ├── GUIA_CLIENTE.md
    ├── MANUAL_TECNICO.md    ← Este archivo
    └── migracion_supabase.sql
```

---

## 🗄️ Esquema de Supabase

### Tabla `lineas`

```sql
CREATE TABLE lineas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dni TEXT NOT NULL,
    nombre TEXT DEFAULT 'N/A',
    direccion TEXT DEFAULT 'N/A',
    linea TEXT DEFAULT 'N/A',
    seg_fijo TEXT DEFAULT 'N/A',
    seg_movil TEXT DEFAULT 'N/A',
    paquete TEXT DEFAULT 'N/A',
    estado TEXT DEFAULT 'pendiente',
    semana TEXT,
    procesado_por TEXT,
    atributos_dinamicos JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_lineas_dni ON lineas (dni);
CREATE INDEX idx_lineas_estado ON lineas (estado);
CREATE INDEX idx_lineas_atributos ON lineas USING GIN (atributos_dinamicos);
```

### Tabla `maquinas`

```sql
CREATE TABLE maquinas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    ip TEXT DEFAULT 'N/A',
    workers_activos INT DEFAULT 0,
    workers_info JSONB DEFAULT '[]'::jsonb,
    proxies_asignados JSONB DEFAULT '[]'::jsonb,
    ultimo_heartbeat TIMESTAMPTZ DEFAULT now(),
    estado TEXT DEFAULT 'desconectado',
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### Tabla `config_bots`

```sql
CREATE TABLE config_bots (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    clave TEXT NOT NULL UNIQUE,
    valor TEXT NOT NULL,
    descripcion TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 🔄 Flujo del Bot (detallado)

### 1. Login en Orange

```
1. Navegar a https://pangea.orange.es/
2. Esperar input[name='temp-username'] (hasta 20s)
3. Escribir usuario con _escribir_como_humano() (delay 50-150ms por letra + Tab)
4. Escribir contraseña en input[name='temp-password']
5. Click en #submit-button
6. Esperar .brands (hasta 30s)
7. Click en a.orange-box
8. Esperar #orange-container (hasta 30s)
9. Click "Nuevo acto comercial"
10. Click "Tarifas"
11. Click último "Crear"
12. Esperar button[title='Cambiar cliente'] (hasta 30s)
```

### 2. Búsqueda por DNI

```
1. Click button[title='Cambiar cliente']
2. Esperar input[name='document'] (hasta 10s)
3. Click, fill(vacío), fill(DNI)
4. Disparar eventos input + change para Angular
5. Click último "Buscar cliente"
6. Esperar que modal se cierre (hasta 10s)
7. Si aparece "No se han encontrado datos para este cliente" -> no_cliente
8. Esperar .mod-barclient__container-data (hasta 50s)
```

### 2.5 Deteccion de etiquetas (CIMA, TV, Principal)

Las etiquetas se extraen del heading de cada linea:

```python
heading = bloque.locator(".client-tariff-heading")
labels = heading.locator("span.label")
etiquetas = [labels.nth(k).inner_text().strip() for k in range(labels.count())]
es_cima = "CIMA" in etiquetas
tiene_tv = "TV" in etiquetas
es_principal = "Principal" in etiquetas
activo_desde = re.search(r'Activo desde\s+(\\d{2}/\\d{2}/\\d{4})', texto_completo)
```

El flag `cima` se determina por presencia de la etiqueta "CIMA" en el array, no por busqueda de texto suelto.

### 3. Extracción de datos

```
Cabecera:
  - Nombre:     .tooltip-text.name strong
  - DNI:        span.font-xxs.p-r-10
  - Dirección:  .tooltip-text.address
  - Seg Fijo:   div.font-xxs:has-text('Seg. Fijo:') strong
  - Seg Móvil:  div.font-xxs:has-text('Seg. Móvil:') strong
  - Paquete:    .client-tariff-title .font-lg

Líneas (paginación):
  - Cada línea: .client-tariff-flex
  - Número:     .line-section .color-primary strong
  - Pestañas:   button.Title.text (Destacadas, Renove, etc.)
  - Contenido:  .card-tariff-info-text

Paginación:
  - Siguiente:  button.ocs-pagination-next
```

### 4. Guardado en Supabase (UPSERT)

```
1. GET /lineas?select=id&dni=eq.{dni}&limit=1
2. Si existe -> PATCH /lineas?id=eq.{id}
3. Si no existe -> POST /lineas
```

---

## 🎯 Detección de Renove Mixto

En la pestaña "Renove", se busca en el texto extraído si contiene alguna de estas variantes (en orden de prioridad):

```python
RENOVE_VARIANTES = [
    "renove mixto al mejor precio con máximo descuento",  # PRIORIDAD 1
    "renove mixto al mejor precio con descuento",          # PRIORIDAD 2
    "renove mixto al mejor precio",                        # PRIORIDAD 3
    "renove mixto",                                        # PRIORIDAD 4
]
```

Se guarda la variante más específica (más larga) en `atributos_dinamicos.renove_mixto_variante`.

---

## 🔌 Proxies

### Formato en proxies.txt

```
ip:puerto:usuario:contraseña
```

Ejemplo:
```
92.113.242.44:6628:locgphkb:68e5df4uxjre
```

### Asignación

El `coordinator.py` asigna **1 proxy exclusivo por worker**:
1. Carga todos los proxies de `proxies.txt`
2. Los mezcla aleatoriamente
3. Asigna los primeros N a los N workers
4. Cada worker tiene su propio proxy que nadie más usa

Si hay más workers que proxies, los workers extra van sin proxy.

---

## 🌐 Web UI

### Stack
- React 19 + Vite
- Tailwind CSS 4
- Supabase JS Client (lectura directa)
- Recharts (gráficos)
- ExcelJS (exportación)
- react-dropzone (upload)

### Conexión a Supabase

```js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY  // anon key (lectura + RLS)
)
```

### Rutas

| Ruta | Componente | Descripción |
|---|---|---|
| `/login` | Login.jsx | Pantalla de login |
| `/` | Dashboard.jsx | Estadísticas semanales |
| `/clientes` | Clientes.jsx | Tabla expandible |
| `/proxies` | Proxies.jsx | Gestión de proxies |
| `/maquinas` | Maquinas.jsx | PCs conectados |
| `/documentos` | Documentos.jsx | Subida de archivos |
| `/workers` | Workers.jsx | Workers activos |
| `/admin/users` | Usuarios.jsx | Gestión de usuarios |

---

### Tabla `usuarios`

```sql
CREATE TABLE IF NOT EXISTS usuarios (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    nombre TEXT DEFAULT '',
    email TEXT DEFAULT '',
    rol TEXT NOT NULL DEFAULT 'asesor',
    activo BOOLEAN DEFAULT true,
    ultima_conexion TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acceso publico usuarios" ON usuarios FOR ALL USING (true);
```

### Roles del sistema

| Rol | Descripción | Permisos en Web UI |
|---|---|---|
| `asesor` | Asesor comercial | Dashboard, Clientes |
| `back_office` | Personal administrativo | Dashboard, Clientes, Documentos |
| `it` | Soporte técnico | Dashboard, Clientes, Proxies, Máquinas, Workers |
| `jefe_area` | Jefe de área | Dashboard, Clientes, Proxies, Máquinas, Documentos, Workers, Usuarios |
| `desarrollador` | Desarrollador/administrador | Dashboard, Clientes, Proxies, Máquinas, Documentos, Workers, Usuarios |

### Autenticación local

Actualmente el sistema usa **usuarios locales en localStorage** para el login, con usuarios predefinidos:

| Usuario | Contraseña | Rol |
|---|---|---|
| admin | admin | desarrollador |
| jefe | jefe | jefe_area |
| it | it | it |
| back | back | back_office |
| asesor | asesor | asesor |

La sesión se guarda en `oratioo_session` con el formato:
```json
{
  "loggedIn": true,
  "user": "admin",
  "rol": "desarrollador",
  "timestamp": 1712345678901
}
```

### Sidebar por roles

El menú lateral se filtra según el rol del usuario logueado. Cada ítem tiene una lista de roles permitidos:
```js
{ to: '/admin/users', icon: Shield, label: 'Usuarios', roles: ['jefe_area', 'desarrollador'] }
```

### Gestión de usuarios (Usuarios.jsx)

- **Datos simulados**: los usuarios se guardan en `localStorage` bajo la clave `oratioo_usuarios`
- **Migración futura**: el archivo `docs/migracion_usuarios.sql` contiene el esquema para migrar a Supabase
- **Componente**: `web/src/pages/Usuarios.jsx` — tabla expandible con modal de creación/edición
- **Exporta** `loginLocal()` y `ROL_PERMISOS` para ser usados desde Login.jsx y Sidebar.jsx

---

## 🚀 Despliegue

### Web UI en Vercel

```bash
cd web
npm install
npm run build
vercel --prod
```

Variables de entorno en Vercel:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_KEY`

### Bot en PC del cliente

```bash
# Instalar dependencias
cd bot
pip install -r requirements.txt
playwright install chromium

# Probar
python main.py --local --headless

# Producción
python coordinator.py --workers 3
```

---

## 🔍 Troubleshooting

### Error: "modal de búsqueda se quedó atascado"
- Posible: Orange cambió el selector del input
- Verificar: `input[name='document']` sigue siendo el campo correcto
- Solución: Actualizar selector en `login.py`

### Error: "Fallo en login"
- Verificar credenciales en `.env`
- Probar login manual en https://pangea.orange.es/
- Posible: Orange cambió el login flow

### Error: "Supabase 401 Unauthorized"
- `SUPABASE_SERVICE_KEY` no es válida o expiró
- Regenerar en Supabase Dashboard > Settings > API

### Workers se caen solos
- Posible: falta de RAM (cada worker ~500MB-1GB)
- Reducir número de workers
- Verificar que los proxies funcionan

---

## 📊 Monitoreo

### Heartbeat de workers

Cada worker actualiza su estado en Supabase cada 30s a través del coordinator. Si un worker no reporta por más de 2 minutos, se considera caído.

### Logs

Los logs se guardan en la tabla `logs_bot` con:
- `worker_id`: ID del worker
- `maquina`: Nombre de la máquina
- `nivel`: INFO, WARN, ERROR
- `mensaje`: Descripción del evento
- `dni`: DNI asociado (si aplica)

---

## 🔄 Ciclo de vida de un DNI

```
1. Subida (web UI)     → estado: "pendiente", atributos: {}
2. Worker lo toma      → estado: "en_progreso", worker_id: N
3. Procesado exitoso   → estado: "completado", datos completos
4. No es cliente       → estado: "no_cliente", nombre: "NO ES CLIENTE"
5. Error técnico       → estado: "error", causa en JSONB
```

---

## 👨‍💻 Desarrollo

### Agregar un nuevo proxy

Solo agregar al archivo `proxies.txt` en el formato:
```
ip:puerto:usuario:contraseña
```

### Agregar una nueva pestaña a extraer

En `login.py` función `extraer_datos_cliente()`, agregar el nombre en la lista `pestanas_objetivo`.

### Cambiar selectores de Orange

Los selectores CSS están en `login.py`. Si Orange cambia su interfaz, hay que actualizarlos.

## Sistema de Lotes y Asignaciones

### Tablas

**lotes** — Agrupacion de DNIs asignados por Jefe de Area a un Supervisor
| Columna | Tipo | Descripcion |
|---|---|---|
| id | BIGINT PK | Auto-increment |
| nombre | TEXT | Nombre del lote |
| supervisor_id | INT | Supervisor asignado |
| creado_por | INT | Usuario que creo el lote |
| total_dnis | INT | Total de DNIs en el lote |
| asignados | INT | DNIs ya asignados a asesores |
| created_at | TIMESTAMPTZ | Fecha de creacion |

**lote_dnis** — Cada DNI dentro de un lote
| Columna | Tipo | Descripcion |
|---|---|---|
| id | BIGINT PK | Auto-increment |
| lote_id | INT | Lote al que pertenece |
| dni | TEXT | Documento del cliente |
| asesor_id | INT | Asesor asignado (null si pendiente) |
| estado | TEXT | pendiente / asignado |
| created_at | TIMESTAMPTZ | Fecha de creacion |

### Flujo de asignacion

1. Jefe de Area sube archivo con DNIs, crea un lote y lo asigna a un Supervisor
2. Supervisor recibe el lote, distribuye los DNIs entre sus asesores
3. Dashboard y Clientes filtran segun el rol:
   - Jefe Area: todo
   - Supervisor: solo datos de su equipo (supervisor_id)
   - Asesor: solo sus DNIs asignados (asesor_id)
