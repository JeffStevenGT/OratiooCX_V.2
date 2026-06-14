# Oratioo CX — UX/UI Brief de Diseño

> **Versión:** 5.3 | **Fecha:** 12 Junio 2026
> **Propósito:** Guía de diseño visual, interacción y experiencia de usuario

---

## 1. Filosofía de Diseño

### 1.1 Principios Rectores

| Principio | Descripción | Aplicación |
|-----------|-------------|------------|
| **Jerarquía visual clara** | El usuario debe entender qué es importante de un vistazo | Sidebar: secciones grandes → ítems pequeños; Badges rojos para alertas |
| **Menos clicks, más acción** | Cada pantalla debe resolver una tarea sin navegar | Power Dialer: toda la info del lead + llamada + tipificación en una sola vista |
| **Feedback inmediato** | Toda acción debe tener respuesta visual | Toast notifications, spinners en botones, badges que se actualizan solos |
| **Progresivo por rol** | La complejidad aumenta con la responsabilidad | Asesor ve pocas opciones; Jefe ve todo pero organizado |
| **Consistencia cromática** | Los colores significan lo mismo en toda la app | Verde = positivo/venta, Rojo = alerta/pérdida, Azul = información/acción |
| **Accesibilidad** | Legible, contrastado, usable | Texto mínimo 12px, contrastes WCAG AA, soporte dark mode |

### 1.2 Personalidad Visual

- **Profesional pero no frío** — colores corporativos con calidez
- **Data-dense pero no abrumador** — información compacta con espaciado generoso
- **Moderna pero no trendy** — Tailwind utility classes, sin modas pasajeras
- **Rápida** — transiciones sutiles (150-200ms), sin animaciones pesadas

---

## 2. Sistema de Diseño (Design System)

### 2.1 Paleta de Colores

```
┌──── Modo Claro ────────────────────────────────────────────────────┐
│                                                                     │
│  Fondo principal:   #FFFFFF (white)                                 │
│  Fondo secundario:  #F9FAFB (gray-50)                               │
│  Fondo tarjetas:    #FFFFFF con border #E5E7EB (gray-200)           │
│  Fondo sidebar:     #1E293B (slate-800) — oscuro fijo               │
│  Texto principal:   #111827 (gray-900)                              │
│  Texto secundario:  #6B7280 (gray-500)                              │
│  Texto sidebar:     #CBD5E1 (slate-300)                             │
│                                                                     │
│  Primary (acciones):    #3B82F6 (blue-500)                         │
│  Success (venta):       #10B981 (emerald-500)                       │
│  Warning (alerta):      #F59E0B (amber-500)                         │
│  Danger (error):        #EF4444 (red-500)                           │
│  Info:                  #6366F1 (indigo-500)                        │
│                                                                     │
│  Pipeline estados:                                                  │
│    pendiente:   #9CA3AF (gray-400)                                  │
│    contactado:  #3B82F6 (blue-500)                                  │
│    interesado:  #8B5CF6 (violet-500)                                │
│    negociacion: #A855F7 (purple-500)                                │
│    venta:       #10B981 (emerald-500)                               │
│    no_interesa: #EF4444 (red-500)                                   │
│    no_contesta: #F59E0B (amber-500)                                 │
│                                                                     │
│  Scoring niveles:                                                   │
│    A+: #10B981  A: #34D399  B: #60A5FA  C: #FBBF24  D: #F87171  E: #9CA3AF │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Tipografía

| Uso | Tailwind Class | Tamaño | Peso |
|-----|---------------|--------|------|
| Títulos de página | `text-2xl font-bold` | 24px | 700 |
| Títulos de sección | `text-lg font-semibold` | 18px | 600 |
| Subtítulos | `text-base font-medium` | 16px | 500 |
| Texto cuerpo | `text-sm` | 14px | 400 |
| Texto pequeño | `text-xs` | 12px | 400 |
| Labels sidebar secciones | `text-[11px] font-bold tracking-wider uppercase` | 11px | 700 |
| Items sidebar | `text-[12px]` | 12px | 400 |
| Badges | `text-[10px] font-bold` | 10px | 700 |
| Números KPIs | `text-3xl font-bold` | 30px | 700 |

**Fuente:** System UI (Inter en web, SF Pro en macOS, Segoe UI en Windows)

### 2.3 Espaciado

| Elemento | Espaciado |
|----------|-----------|
| Padding de página | `p-6` (24px) |
| Entre secciones | `gap-6` (24px) o `space-y-6` |
| Entre cards en grid | `gap-4` (16px) |
| Padding interno de cards | `p-4` (16px) |
| Entre filas de tabla | `py-3` (12px vertical) |
| Iconos en sidebar | `mr-2` (8px) |

### 2.4 Bordes y Sombras

| Elemento | Estilo |
|----------|--------|
| Cards | `rounded-xl border border-gray-200 shadow-sm` |
| Tablas | `rounded-lg border border-gray-200` |
| Botones | `rounded-lg` |
| Inputs | `rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500` |
| Badges | `rounded-full` |
| Modal | `rounded-2xl shadow-xl` |
| Sidebar items | `rounded-lg` |

---

## 3. Componentes Clave

### 3.1 Sidebar v2

```
┌─────────────────────┐
│  🏢 ORATIOO CX      │  ← Logo corporativo
│  [Orange ▾]         │  ← ProjectSelector
│─────────────────────│
│  📊 DASHBOARD       │  ← Sección (text-[11px] font-bold uppercase)
│    📋 General       │  ← Item (text-[12px], icono 15px)
│    👤 Asesor        │
│─────────────────────│
│  💼 COMERCIAL        │
│    📞 Power Dialer   │
│    📅 Agenda    [3]🔴│  ← Badge rojo con contador
│    👥 Clientes       │
│    ➕ Asignar [47]🔴 │
│─────────────────────│
│  👁️ SUPERVISIÓN     │
│    📈 Rendimiento    │
│    🧠 Inteligencia  │
│    ...               │
│─────────────────────│
│  ⚙️ ADMINISTRACIÓN   │
│    📡 VPBX           │
│    ...               │
│─────────────────────│
│  👤 Perfil           │
│  🌙 Modo Oscuro      │
│  🚪 Cerrar Sesión    │
└─────────────────────┘

Comportamiento:
- Acordeón: solo 1 sección abierta a la vez
- Auto-abre la sección de la ruta activa
- Chevron rota 90° al expandir (transición 200ms)
- Badges rojos: solo visibles cuando count > 0
- Ítem activo: bg-slate-700, texto blanco
- Ítem hover: bg-slate-700/50
- Sidebar colapsable (◀▶ toggle)
- Ancho: 240px (expandido), 64px (colapsado)
```

### 3.2 Cards de Estadísticas (StatCard)

```
┌─────────────────────┐  ┌─────────────────────┐
│  Ventas Totales      │  │  Leads Sin Asignar   │
│  47                  │  │  152                 │
│  ↑ 12% vs mes pasado │  │  ⭐34 CIMA 🎁28 Reno │
└─────────────────────┘  └─────────────────────┘

Especificaciones:
- Fondo: white, border gray-200, rounded-xl, shadow-sm
- Padding: p-4
- Título: text-sm text-gray-500
- Valor: text-3xl font-bold
- Trend: text-xs (verde ↑ positivo, rojo ↓ negativo)
```

### 3.3 Power Dialer — Tarjeta del Lead

```
┌─────────────────────────────────────────────────────────┐
│  ⏸ Pausa    ← Anterior   Lead 3 de 25   Siguiente →   │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  ROCÍO MARTÍNEZ GONZÁLEZ                          │ │
│  │  DNI 75238036E                                     │ │
│  │                                                    │ │
│  │  ⭐ CIMA    🎁 Renove Mixto Max Descuento   🔄 R2  │ │
│  │  📦 Love Empresa Smart                             │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ ⭐  📞 622 53 46 99  Principal  🟢     [LLAMAR]  │ │
│  │     Activa · Consumo 45.90€/mes · 📡 TV · 📅 2028│ │
│  │     ⭐ ☆ ⊕                                         │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ 🎁  📞 911 22 33 44  Agregado   🟣     [LLAMAR]  │ │
│  │     Suspendida · Sin consumo                       │ │
│  │     ⊕                                              │ │
│  ├───────────────────────────────────────────────────┤ │
│  │     📞 965 11 22 33  Agregado   🟣     [LLAMAR]  │ │
│  │     Hotline · Consumo 0€                           │ │
│  │     ⊕                                              │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  [+ Agregar número]                                     │
│  [💬 WhatsApp]                                          │
└─────────────────────────────────────────────────────────┘

Especificaciones:
- Números: text-2xl font-mono font-bold para fácil lectura
- Badges CIMA/Renove: chips de color con iconos
- Botón LLAMAR: bg-green-500 hover:bg-green-600, text-white, font-bold
- Botón LLAMAR disabled: bg-gray-300, cursor-not-allowed (durante llamada)
- Estados de línea: Activa=verde, Suspendida=gris, Hotline=rojo
- Expandir línea (⊕): rota 45° al expandir, muestra detalles adicionales
```

### 3.4 Modal de Tipificación

```
┌─────────────────────────────────────────────────────────┐
│  Tipificar llamada                          ✕           │
│                                                         │
│  ROCÍO MARTÍNEZ — 622 53 46 99                          │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Estado:                                                 │
│  ┌──────────┐ ┌──────────┐ ┌───────┐ ┌──────────┐     │
│  │INTERESADO│ │NEGOCIACIÓN│ │ VENTA │ │NO INTERES│     │
│  │  🔵      │ │  🟣      │ │  🟢   │ │   🔴     │     │
│  └──────────┘ └──────────┘ └───────┘ └──────────┘     │
│  ┌───────────┐                                          │
│  │NO CONTESTA│                                          │
│  │   🟠      │                                          │
│  └───────────┘                                          │
│                                                         │
│  Sub-estado:                                             │
│  ┌──────────────────────┐ ┌──────────────────────┐    │
│  │ Proceso Portabilidad │ │ Volver a Llamar      │    │
│  └──────────────────────┘ └──────────────────────┘    │
│  ┌──────────────────────┐ ┌──────────────────────┐    │
│  │ Agregó otro número   │ │ Confirmó su número   │    │
│  └──────────────────────┘ └──────────────────────┘    │
│                                                         │
│  Fin de permanencia: [📅 DD/MM/AAAA]                    │
│  Callback: [📅 DD/MM/AAAA] [🕐 HH:MM]                  │
│                                                         │
│  Notas:                                                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │                                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌────────────┐  ┌────────────┐                        │
│  │  GUARDAR   │  │ CANCELAR   │                        │
│  └────────────┘  └────────────┘                        │
└─────────────────────────────────────────────────────────┘

Especificaciones:
- Botones de estado: grandes (min-w-28), con icono, colores semánticos
- Botón activo: borde 2px más oscuro, fondo más claro
- Animación: fadeIn + scale (150ms)
```

### 3.5 LivePanel (Supervisor)

```
┌─────────────────────────────────────────────────────────┐
│  Equipo en Vivo                           Actualiza 15s │
│                                                         │
│  🟢 3 Disponibles  │  🔵 1 En llamada  │  🟡 1 En Pausa│
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ 🟢 Ana Asesora         Ext 101                     │ │
│  │    Disponible                         5 contactos  │ │
│  │    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ 🔵 Luis García          Ext 102                     │ │
│  │    En llamada                         3 contactos  │ │
│  │    ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ 🟡 Carmen López         Ext 103                     │ │
│  │    Almuerzo · 12m 34s                 2 contactos  │ │
│  │    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░  │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

Especificaciones:
- Estados: 🟢 AVAILABLE, 🔵 IN_CALL/RINGING, 🟡 ON_BREAK, ⬜ OFFLINE
- Timer en pausa: color graduado (blanco→ámbar→naranja→rojo según duración)
- Barra de progreso: contactos hoy / total leads asignados
- Recarga automática cada 15 segundos
- Fuente de datos: VPBX API real o simulación si no está conectado
```

### 3.6 Asignar Leads — Chips

```
┌─────────────────────────────────────────────────────────┐
│  Asignar Leads                                           │
│                                                         │
│  Pool disponible: 152  │  ⭐ CIMA: 34  │  🎁 Renove: 28 │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Supervisores:                                    │   │
│  │                                                  │   │
│  │  ┌───────────────┐ ┌───────────────┐             │   │
│  │  │ Pablo Sup Esp  │ │ María Sup Perú │             │   │
│  │  │ 5 pend.        │ │ 8 pend.        │             │   │
│  │  │ [  50  ]       │ │ [  52  ]       │             │   │
│  │  └───────────────┘ └───────────────┘             │   │
│  │                                                  │   │
│  │  ┌───────────────┐                                │   │
│  │  │ Carlos Sup Esp │                                │   │
│  │  │ 3 pend.        │                                │   │
│  │  │ [  50  ]       │                                │   │
│  │  └───────────────┘                                │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Total a asignar: 152 / 152                             │
│                                                         │
│  [Repartir Igual]  ┌──────────────────┐                │
│                    │  ASIGNAR LEADS    │                │
│                    └──────────────────┘                │
└─────────────────────────────────────────────────────────┘

Especificaciones:
- Chips: rounded-xl border p-4, min-w-36
- Input numérico: centrado, font-mono text-lg, border-b-2 focus:border-blue-500
- Validación en rojo si totalAsignado > disponibles
- Sin badges individuales de "X pend." en cada chip
- Solo el badge del sidebar "Asignar Leads" en rojo con el conteo total
```

### 3.7 Tabla de Datos (Clientes, Pipeline, etc.)

```
┌─────────────────────────────────────────────────────────┐
│  [🔍 Buscar DNI o nombre...]  [CIMA: Todos ▾] [Reno ▾] │
│                                                         │
│  Mostrar [10 ▾] de 500                            [CSV] │
│                                                         │
│  DNI        | Nombre       | CIMA | Paquete      | ... │
│  ────────────────────────────────────────────────────── │
│  75238036E  | ROCÍO MART.  | ⭐SI | Love Empresa | ... │
│  12345678A  | JUAN PÉREZ   | ❌NO | Tarifa Plana | ... │
│  87654321B  | MARÍA GÓMEZ  | ⭐SI | Love Negocio | ... │
│  ────────────────────────────────────────────────────── │
│                                                         │
│  ← 1 2 3 ... 50 →                                      │
└─────────────────────────────────────────────────────────┘

Especificaciones:
- Header: bg-gray-50, text-xs font-medium text-gray-500 uppercase
- Filas: hover:bg-blue-50, cursor-pointer si expandible
- CIMA ⭐SI: badge verde con estrella
- Renove 🎁: badge azul con regalo
- Paginación unificada: "Mostrar [10▼] de N" + botones ← →
- Fila expandible: rota chevron, muestra detalle debajo
```

### 3.8 Modales

```
┌─────────────────────────────────────────────────────────┐
│  Título del Modal                            ✕          │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Contenido del modal...                                 │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│              [Cancelar]    [Acción Principal]            │
└─────────────────────────────────────────────────────────┘

Especificaciones:
- Overlay: bg-black/50, backdrop-blur-sm
- Modal: bg-white, rounded-2xl, shadow-xl, max-w-lg, mx-auto
- Animación: fadeIn + scale (150ms ease-out)
- Cierre: tecla ESC, click fuera, botón ✕
```

---

## 4. Patrones de Interacción

### 4.1 Estados de UI

| Estado | Implementación |
|--------|---------------|
| **Loading inicial** | Skeleton cards (pulso gris) en lugar de spinners |
| **Loading navegación** | TopLoader: barra azul animada en borde superior + cursor wait |
| **Loading acción** | Spinner en botón + disable + texto "Asignando..." |
| **Empty** | Icono grande + texto descriptivo + acción sugerida |
| **Error** | Toast rojo en esquina inferior derecha, auto-dismiss 5s |
| **Error crash** | ErrorBoundary: mensaje + botón "Reintentar" |
| **Success** | Toast verde + check animado, auto-dismiss 3s |
| **Offline** | Banner rojo flotante: "Sin conexión — los cambios se guardan localmente" |
| **404** | Página not-found con ilustración + link a inicio |
| **500** | Página error con mensaje + botón reintentar |

### 4.2 Feedback

- **Toast notifications:** esquina inferior derecha, slide-in desde abajo
  - Success: verde, check icon
  - Error: rojo, x icon
  - Warning: amarillo, triangle icon
  - Info: azul, info icon
- **Botones:** ripple effect sutil en click (bg oscurece 10%)
- **Badges:** animación de escala cuando el número cambia
- **LivePanel:** transición suave de color en estados (500ms ease)

### 4.3 Navegación

- **Sidebar:** siempre visible (no hamburger menu en desktop)
- **Breadcrumb:** no se usa — la sidebar ya muestra la ubicación
- **Tabs:** para contenido relacionado dentro de una página (Infraestructura, Scoring)
- **Modales:** para acciones que requieren contexto (tipificar, tramitar, confirmar)
- **Overlay full-screen:** para configuraciones complejas (Proyectos desde /inicio)

### 4.4 Formularios

- Validación en tiempo real (onBlur, no onSubmit)
- Mensajes de error inline debajo del campo (text-red-500 text-xs)
- Inputs con label flotante o label arriba
- Botón submit deshabilitado si hay errores
- Tecla Enter = submit

---

## 5. Responsive Design

| Breakpoint | Comportamiento |
|------------|---------------|
| **Desktop (≥1024px)** | Sidebar expandido (240px), tablas completas, cards en grid 2-4 cols |
| **Tablet (768-1023px)** | Sidebar colapsado (64px) con tooltips, tablas con scroll horizontal |
| **Mobile (<768px)** | Sidebar oculto (hamburger menu), cards stack vertical, tablas simplificadas |

**Nota:** La app está optimizada para desktop. Los asesores y supervisores trabajan en PC. Mobile es secundario.

---

## 6. Dark Mode

- Toggle en sidebar (🌙/☀️)
- Transición suave de colores (200ms)
- Sidebar siempre oscuro (slate-800)
- Contenido principal alterna:
  - Light: bg-gray-50, cards white
  - Dark: bg-gray-950, cards gray-900, texto gray-100
- Gráficos Recharts adaptan colores automáticamente
- Persistencia en localStorage

---

## 7. Iconografía

**Librería:** Lucide React (iconos outline, 24px, stroke-width 2)

| Icono | Uso |
|-------|-----|
| `LayoutDashboard` | Dashboards |
| `Phone` | Power Dialer, VPBX |
| `Calendar` | Agenda |
| `Users` | Clientes |
| `UserPlus` | Asignar Leads |
| `TrendingUp` | Rendimiento |
| `BrainCircuit` | Inteligencia |
| `BarChart3` | Estadísticas |
| `Shield` | Auditoría, Usuarios |
| `Star` | QA |
| `Target` | Metas |
| `AlertTriangle` | Alertas |
| `Settings` | Infraestructura, Configuración |
| `Globe` | Apps (Bots) |
| `Upload` | Documentos |
| `BookOpen` | Wikiratioo |
| `User` | Perfil |
| `Moon/Sun` | Dark/Light toggle |
| `LogOut` | Cerrar sesión |
| `ChevronDown/Right` | Acordeón sidebar |
| `PanelLeftClose/Open` | Colapsar sidebar |

---

## 8. Animaciones y Transiciones

| Elemento | Animación | Duración |
|----------|-----------|----------|
| Modal open | fadeIn + scale(0.95→1) | 150ms ease-out |
| Sidebar sección expandir | max-height + opacity | 200ms ease-in-out |
| Sidebar chevron rotar | rotate(0→90deg) | 200ms |
| Sidebar ítem activo optimistic | cambio instantáneo al hacer click (sin esperar navegación) | 0ms |
| TopLoader (barra progreso) | width 0→30→85→100% | 200-300ms por paso |
| Toast slide-in | translateX(100%→0) + fadeIn | 300ms ease-out |
| Badge count change | scale(1→1.2→1) | 200ms |
| Tab switch | fadeIn | 150ms |
| Fila expandir | max-height | 200ms |
| Dark mode toggle | background-color, color, border-color | 200ms |
| Hover buttons | background-color | 150ms |

---

## 9. Ejemplos Visuales (Wireframes de Referencia)

### Dashboard Asesor
```
┌─────────────────────────────────────────────────────────┐
│ [Sidebar] │  👋 ¡Hola, Ana!                   [🌙] [👤] │
│           │                                             │
│           │  ┌─────────────┐ ┌─────────────┐           │
│           │  │ Mis Leads   │ │ Contactados │           │
│           │  │     45      │ │     Hoy     │           │
│           │  │             │ │     12      │           │
│           │  └─────────────┘ └─────────────┘           │
│           │                                             │
│           │  [⭐ CIMA] [🎁 Renove] [🔍 Buscar...]      │
│           │                                             │
│           │  DNI      | Nombre  | CIMA | Intentos      │
│           │  ─────────────────────────────────────      │
│           │  752380.. | ROCÍO M.| ⭐SI | 3             │
│           │  123456.. | JUAN P. | ❌NO | 1             │
│           │                                             │
│           │  ┌──────────────────────┐                   │
│           │  │  IR AL POWER DIALER  │                   │
│           │  └──────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

### Dashboard Jefe
```
┌─────────────────────────────────────────────────────────┐
│ [Sidebar] │  📊 Panel General               [🌙] [👤]   │
│           │                                             │
│           │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│           │  │Ventas│ │SinAsg│ │Conv% │ │Activo│      │
│           │  │  47  │ │ 152  │ │ 7.8% │ │  5   │      │
│           │  └──────┘ └──────┘ └──────┘ └──────┘      │
│           │                                             │
│           │  Pipeline Funnel                            │
│           │  [████████░░] 1,250 Completados             │
│           │  [███░░░░░░░]   152 Sin asignar             │
│           │  [████████░░]   548 Asignados               │
│           │  [██████░░░░]   320 Contactados             │
│           │  [██░░░░░░░░]    47 Ventas                  │
│           │                                             │
│           │  ┌─── Bot ──────────────────────┐          │
│           │  │ 🟢 5 workers · 234 DNIs cola │          │
│           │  └──────────────────────────────┘          │
│           │                                             │
│           │  Comparativa Equipos                        │
│           │  España: 8.2% conv · Perú: 7.1%            │
└─────────────────────────────────────────────────────────┘
```

### Fichaje Electrónico
```
┌─────────────────────────────────────────────────────────┐
│ [Sidebar] │  🕐 Fichaje                    [📅] [👤]    │
│           │                                             │
│           │  ┌──────────────────────────────────────┐  │
│           │  │                                      │  │
│           │  │           ⏰  09:32:15                │  │
│           │  │                                      │  │
│           │  │      ┌──────────────────────┐       │  │
│           │  │      │     🟢  ENTRADA       │       │  │
│           │  │      │                      │       │  │
│           │  │      └──────────────────────┘       │  │
│           │  │                                      │  │
│           │  │  Jornada de hoy: 4h 12m             │  │
│           │  │  Entrada: 09:00  |  Salida: —       │  │
│           │  └──────────────────────────────────────┘  │
│           │                                             │
│           │  ─── Historial ──────────────────────────  │
│           │  Fecha      | Entrada | Salida | Pausas    │
│           │  12 Jun 2026| 09:00   | —      | 30m      │
│           │  11 Jun 2026| 08:55   | 18:05  | 1h 15m   │
└─────────────────────────────────────────────────────────┘

Vista Supervisor (Equipo):
┌─────────────────────────────────────────────────────────┐
│ [Sidebar] │  🕐 Fichaje del Equipo        [📅] [👤]    │
│           │                                             │
│           │  🟢 Fichados: 5  |  🔴 Sin fichar: 1       │
│           │                                             │
│           │  Usuario | Entrada | Salida | Pausas | Edo │
│           │  Ana     | 08:55   | —      | 15m    | 🟢  │
│           │  Luis    | 09:02   | 14:00  | 30m    | 🟡  │
│           │  Pedro   | —       | —      | —      | 🔴  │
│           │                                             │
│           │  🔴 Pedro no ha fichado — [Registrar manual]│
└─────────────────────────────────────────────────────────┘
```

---

## 10. Reglas de Implementación

1. **Tailwind first** — no CSS custom excepto animaciones complejas
2. **Componentes reutilizables** — no duplicar estilos entre páginas
3. **Dark mode con `dark:` prefix** — todas las cards y textos deben tener variante oscura
4. **Iconos 15-20px** — consistencia de tamaño en toda la app
5. **Colores semánticos** — usar `green-*`, `red-*`, no colores arbitrarios
6. **Estados hover/focus/disabled** — siempre definir los 3
7. **Texto truncado con `truncate`** — nunca overflow en tablas o cards
8. **`transition-colors duration-200`** en elementos interactivos
9. **Z-index layers:** sidebar=40, modal=50, toast=60
10. **Accesibilidad:** `sr-only` para screen readers en iconos sin texto
