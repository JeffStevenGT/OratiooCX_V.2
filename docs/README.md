# Oratioo CX — Sistema de Gestión Comercial

Sistema completo para extraer leads de Pangea Orange, asignarlos a asesores comerciales, gestionar el pipeline de ventas y monitorear métricas del equipo.

---

## 📋 Stack

- **Frontend:** React + Vite + Tailwind + Recharts
- **Backend:** Python (Playwright) — automatización Orange
- **Base de datos:** Supabase (PostgreSQL + JSONB)
- **Autenticación:** Login local con tabla `usuarios`

---

## 🚀 Instalación Rápida

### Frontend

```bash
cd web
npm install
npm run dev
```

### Bot

```bash
cd bot
pip install -r requirements.txt
playwright install chromium
```

### Supabase

Ejecutar en SQL Editor:

1. `docs/migracion_supabase.sql` — tablas principales
2. `docs/migracion_usuarios.sql` — usuarios y seed data
3. `docs/migracion_lotes.sql` — lotes de DNIs
4. `docs/migracion_metas.sql` — tabla de metas

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────┐
│              FRONTEND (React)           │
│                                         │
│  Dashboard  │  Power Dialer  │  Agenda  │
│  Ranking    │  Metas         │  Alertas │
│  Clientes   │  Documentos    │  Lotes   │
│  Proxies    │  Máquinas      │  Workers │
│  Usuarios   │                           │
└───────────────────┬─────────────────────┘
                    │ anon key + RLS
                    ▼
┌─────────────────────────────────────────┐
│             SUPABASE DB                 │
│                                         │
│  lineas (leads)  │  usuarios (roles)    │
│  documentos      │  lotes / lote_dnis   │
│  maquinas        │  metas               │
│  lead_pipeline   │  proxies             │
└───────────────────┬─────────────────────┘
                    │ service_role key
                    ▼
┌─────────────────────────────────────────┐
│              BOT (Python)               │
│                                         │
│  Coordinator → Worker 1 (proxy A)      │
│              → Worker 2 (proxy B)      │
│              → Worker 3 (proxy C)      │
└─────────────────────────────────────────┘
```

---

## 👥 Roles del Sistema

| Rol                 | Acceso                                                             | Sidebar           |
| ------------------- | ------------------------------------------------------------------ | ----------------- |
| **Asesor**          | Dashboard, Power Dialer, Agenda, Ranking, Metas, Alertas           | Solo Comercial    |
| **Supervisor**      | Dashboard, Clientes, Ranking, Metas, Alertas, Usuarios, Documentos | Comercial + Admin |
| **Jefe Área / CEO** | **Todo** el sistema                                                | Todos los grupos  |

### Pirámide Jerárquica

```
Jefe Área / CEO  ← dueño del sistema
       │
   Supervisor     ← gestiona asesores
       │
    Asesor        ← hace llamadas
```

---

## 📊 Páginas del Sistema

### Dashboard

- Cards: Total Leads, CIMA, Renove, Contactados Hoy (o Tasa para jefes)
- Pipeline: Pendientes, En Gestión, Ventas
- Ventas + Agendados
- Leads durmiendo (sin actividad +3/+7/+15 días)
- Actividad de hoy (timeline para asesor)
- Por supervisor/jefe: gráfico semanal + equipo/supervisores
- Filtros: Hoy, 7 días, Mes, Trimestre, 6M, Todo

### Power Dialer

- Navegación lead por lead con tabs: Pendientes 🔵, Hoy, Todos
- 6 botones de estado rápido: Contactado, Interesado, Negociación, **Venta**, No Interesa, No Contesta
- Badge de antigüedad: 🟢 Hoy / 🟡 2d / 🔴 5d+
- Alerta de leads arrastrados (+3d)
- Auto-avance al marcar "No Contesta"
- Agendar callback con modal
- Cancelar callback con ❌
- Supervisor: ve leads de todo su equipo + filtro por asesor

### Agenda 📅

- Callbacks agrupados por día: Hoy, Mañana, fecha
- Vencidos en rojo 🔴
- Botones de estado rápido (mismos que Dialer)
- "No Contesta" NO elimina el callback
- Badge en sidebar 🔵 con count de hoy

### Ranking 🏆

- Vista: Asesores / Equipos
- Ordenable por: Ventas, Contactados, Tasa %
- Medallas 🥇🥈🥉 para top 3
- Muestra meta cumplida ✅ o progreso 🔴
- Tu posición resaltada

### Metas 🎯

- Jerarquía: Jefe asigna a Supervisor → Supervisor asigna a Asesor
- Períodos: Por día, Por semana, Por mes
- Barras de progreso con colores:
  - ✅ Verde: Meta cumplida
  - 🟡 Ámbar: En progreso
  - 🔴 Rojo: Atrasado (< 30%)
- Muestra "Faltan X" o "+X por encima"

### Alertas 🚨

- Leads CIMA + Renove Mixto sin gestionar
- Agrupadas por supervisor (para jefe)
- Niveles: Críticas (+7d) 🔴, Pendientes (3-7d) 🟡, Recientes (1-3d)
- Badge en sidebar 🔴

### Clientes 📋

- Tabla con filtros: CIMA, Renove, fechas, búsqueda
- Asignación masiva de leads con cantidad configurable
- Columna Estado con cambio inline
- Vista expandible con datos completos

### Documentos 📄

- Subir .csv/.txt con DNIs
- Preview con detección automática de columna DNI
- Guarda en `documentos` (historial) y `lineas` (nuevos leads)
- Los leads subidos aparecen como 'pendiente' hasta que el bot los procese

### Infraestructura (Proxies, Máquinas, Workers, Lotes)

- Gestionada por el bot via `coordinator.py`
- Frontend lee desde Supabase (tablas `proxies`, `maquinas`)
- Workers como sub-procesos con proxy exclusivo

---

## 🗄️ Tablas en Supabase

### `lineas` — Leads/clientes

| Campo                 | Tipo        | Descripción                        |
| --------------------- | ----------- | ---------------------------------- |
| `dni`                 | TEXT        | Documento (único por upsert)       |
| `atributos_dinamicos` | JSONB       | Datos del bot + pipeline comercial |
| `created_at`          | TIMESTAMPTZ | Fecha de creación                  |

### `usuarios` — Roles y credenciales

| Campo           | Tipo                                                                 |
| --------------- | -------------------------------------------------------------------- |
| `usuario`       | TEXT                                                                 |
| `password`      | TEXT                                                                 |
| `rol`           | TEXT (asesor, supervisor, jefe_area, it, back_office, desarrollador) |
| `equipo`        | TEXT (España, Perú)                                                  |
| `supervisor_id` | BIGINT                                                               |

### `metas` — Objetivos

| Campo        | Tipo                            |
| ------------ | ------------------------------- |
| `usuario_id` | BIGINT                          |
| `creado_por` | BIGINT                          |
| `tipo`       | TEXT (ventas, contactados)      |
| `cantidad`   | INT                             |
| `periodo`    | TEXT (diario, semanal, mensual) |

### Otras tablas

- `documentos` — Historial de cargas
- `lotes` / `lote_dnis` — Agrupaciones de DNIs
- `lead_pipeline` — Pipeline comercial
- `proxies` — Proxies residenciales
- `maquinas` — PCs con workers_info JSONB
- `config_bots` — Config remota del bot

---

## 🧠 Pipeline Comercial (atributos_dinamicos)

```json
{
  "cima": "SI|NO",
  "tiene_renove_mixto": true|false,
  "renove_mixto_variante": "...",
  "estado": "completado|no_cliente|pendiente",
  "datos_basicos": { "nombre": "...", "direccion": "..." },
  "linea": { "numero": "...", "paquete": "..." },
  "pipeline": {
    "asesor_id": 7,
    "estado": "pendiente|contactado|interesado|en_negociacion|cerrado|no_interesa",
    "notas": "...",
    "ultimo_cambio": "2026-05-23T10:30:00Z",
    "callback_at": "2026-05-24T15:00:00Z"
  }
}
```

---

## 🤖 Bot (Python + Playwright)

### Coordinator

```bash
cd bot
$env:PYTHONIOENCODING='utf-8'
python coordinator.py
```

Pregunta interactivamente cuántos workers iniciar.

### Worker

- Toma DNI de la cola (tabla `lineas`)
- Login en Orange Pangea
- Extrae CIMA, Renove, líneas, pestañas
- Guarda vía REST API a Supabase
- Proxy exclusivo por worker

### main.py (modo prueba local)

```bash
python main.py --local
```

---

## 🔧 Sidebar por Rol

### Asesor

```
📊 Dashboard
▾ Comercial
  📞 Power Dialer
  📅 Agenda          🔵 badge
  🏆 Ranking
  🎯 Metas
  🚨 Alertas         🔴 badge
```

### Supervisor

```
📊 Dashboard
▾ Comercial
  🏆 Ranking
  🎯 Metas
  🚨 Alertas         🔴 badge
▸ Infraestructura
  📋 Clientes
  📄 Documentos
▸ Administración
  👥 Usuarios
```

### Jefe Área / CEO

```
📊 Dashboard
▾ Comercial
  🏆 Ranking  (equipos + asesores)
  🎯 Metas    (asigna a supervisores)
  🚨 Alertas  (por supervisor)
▸ Infraestructura
  📋 Clientes / 🖥 Proxies / 🖥 Máquinas
  ⚙ Workers / 📄 Documentos / 📦 Lotes
▸ Administración
  👥 Usuarios
```

---

## 📝 Licencia

Uso interno — Oratioo CX
