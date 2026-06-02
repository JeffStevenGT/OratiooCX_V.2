# 🌐 Web — Dashboard React de Oratioo CX

Interfaz web en React para visualizar leads, gestionar usuarios, subir documentos, configurar infraestructura (proxies, máquinas, workers) y monitorear el rendimiento del bot.

---

## Stack

- **React 19** + **Vite**
- **Tailwind CSS 4**
- **Supabase JS Client** (lectura directa con anon key + RLS)
- **Recharts** (gráficos)
- **ExcelJS** (exportación)
- **react-dropzone** (upload)
- **lucide-react** (iconos)
- **react-router-dom** (ruteo)

---

## 📁 Estructura

```
web/
├── src/
│   ├── main.jsx                → Entry point
│   ├── App.jsx                 → Router + Layout
│   ├── index.css               → Estilos globales
│   ├── supabaseClient.js       → Conexión Supabase
│   ├── pages/
│   │   ├── Login.jsx           → Login local
│   │   ├── Dashboard.jsx       → Estadísticas y gráficos
│   │   ├── Clientes.jsx        → Tabla de leads con filtros
│   │   ├── Documentos.jsx      → Subida de archivos + monitoreo bot
│   │   ├── ConfigurarBot.jsx   → Configuración del bot
│   │   ├── Proxies.jsx         → Gestión de proxies
│   │   ├── Maquinas.jsx        → PCs conectados
│   │   ├── Workers.jsx         → Workers activos
│   │   ├── Lotes.jsx           → Asignación de leads
│   │   ├── Usuarios.jsx        → Gestión de usuarios
│   │   └── AdminUsers.jsx      → Admin de usuarios (alternativa)
│   └── components/
│       ├── Sidebar.jsx         → Menú lateral por roles
│       ├── ProtectedRoute.jsx  → Protección de rutas
│       ├── BotStatus.jsx       → Estado del bot
│       ├── ExportButtons.jsx   → Exportación Excel/JSON
│       ├── FilaExpandible.jsx  → Fila expandible con detalles
│       ├── StatCard.jsx        → Card de estadística
│       └── WeekSelector.jsx    → Selector de semana
├── dist/                       → Build (gitignored)
├── package.json
└── vite.config.js
```

---

## 🚀 Desarrollo

```bash
cd web
npm install
npm run dev      # http://localhost:5173
npm run build    # Producción
```

### Variables de entorno

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_KEY=anon_xxx
```

---

## 🧭 Rutas

| Ruta | Página | Descripción |
|---|---|---|
| `/login` | Login | Inicio de sesión |
| `/dashboard` | Dashboard | Estadísticas semanales |
| `/clientes` | Clientes | Tabla de leads con filtros |
| `/documentos` | Documentos | Subir archivos + monitoreo bot |
| `/configurar-bot` | Configurar App | Configuración remota del bot |
| `/proxies` | Proxies | Gestión de proxies |
| `/maquinas` | Máquinas | PCs conectados |
| `/workers` | Workers | Estado de workers |
| `/lotes` | Asignar Leads | Lotes y asignación |
| `/admin/users` | Usuarios | Gestión de usuarios del sistema |

---

## 👥 Roles y Permisos

| Rol | Sidebar visible |
|---|---|
| **Asesor** | Dashboard |
| **Back Office** | Dashboard, Clientes, Documentos |
| **IT** | Dashboard, Clientes, Proxies, Máquinas, Workers |
| **Supervisor** | Dashboard, Clientes, Documentos, Usuarios |
| **Jefe Área** | Dashboard, Clientes, Proxies, Máquinas, Documentos, Workers, Lotes, Usuarios, Configurar App |
| **Desarrollador** | Acceso total |

El sidebar se filtra automáticamente según el rol del usuario logueado. Cada ítem tiene su matriz de permisos en `Sidebar.jsx`.

---

## 📊 Páginas

### Dashboard
- Cards: Total Leads, CIMA, Renove, Procesados Hoy
- Desglose por variante de Renove (6 cards de colores)
- Gráfico semanal de DNIs procesados
- Filtros acumulativos: CIMA, Renove, variantes, Multidispositivo
- Auto-refresh

### Clientes
- Tabla con todos los DNIs procesados
- Filtros: CIMA, Renove, variantes, fechas, búsqueda por DNI/nombre
- Filas expandibles con detalle completo (líneas, pestañas, pipeline)
- Columnas: Documento, Nombre, Líneas, CIMA, Renove, Variante, Estado, Fecha
- Exportación Excel/JSON

### Documentos
- Subir archivos .csv/.txt/.xlsx con DNIs
- Detección automática de columna DNI
- Preview antes de guardar
- Historial de cargas agrupado por día
- Estado detallado de cada lote (pendientes, procesados, errores)
- Monitoreo de workers activos por máquina
- Panel de control del bot (iniciar/detener/resetear cola)

### Configurar App
- Configuración remota del bot vía Supabase (tabla `config_bots`)
- Variables como número de workers, intervalo de heartbeat, etc.

### Lotes
- Asignación masiva de leads
- Crear lotes desde archivos o DNIs individuales
- Distribuir a supervisores/asesores

### Proxies, Máquinas, Workers
- CRUD de proxies residenciales
- Estado de máquinas conectadas (heartbeat, workers activos)
- Workers activos por máquina

### Usuarios
- CRUD completo de usuarios del sistema
- Roles, equipos, proxy asignado
- Activar/desactivar usuarios

---

## 🔐 Autenticación

Login local con tabla `usuarios` en Supabase:

```
POST /login → SELECT * FROM usuarios WHERE usuario = ? AND password = ?
```

La sesión se guarda en `localStorage` como `oratioo_session`:
```json
{
  "loggedIn": true,
  "user": "admin",
  "rol": "desarrollador",
  "id": 1,
  "email": "admin@oratioo.com",
  "timestamp": 1712345678901
}
```

---

## 🗄️ Conexión a Supabase

```js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY  // anon key (lectura + RLS)
)
```

Todas las consultas se hacen con permisos RLS. El bot usa `service_role key` para escritura.

---

## 📤 Exportación

- **Excel CIMA+Renove** — Solo leads que cumplen ambos criterios
- **Excel Completo** — Todos los leads
- **JSON** — Datos crudos

Formato: documento, tipoDoc, nombre, apellidos, teléfono, línea, paquete, CIMA, Renove, variante, estado

---

## 🚀 Despliegue (Vercel)

```bash
cd web
npm install
npm run build
vercel --prod
```

Variables de entorno en Vercel:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_KEY`
