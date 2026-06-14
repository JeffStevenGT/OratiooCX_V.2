# Oratioo CX — Flujo de la Aplicación

> **Versión:** 5.3 | **Fecha:** 12 Junio 2026
> **Propósito:** Mapa completo de navegación y flujos de usuario en la aplicación

---

## 1. Diagrama General de Navegación

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LOGIN                                               │
│                   /login (público)                                           │
│              Email + Contraseña → JWT 8h                                     │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SPLASH SCREEN                                            │
│                      /inicio                                                 │
│                                                                             │
│   ┌──────────────────────────────────────────────────────────────────┐     │
│   │  Bienvenida personalizada según rol                               │     │
│   │  ⚙️ Overlay: Configuración de Proyectos (solo Dev/Jefe)           │     │
│   │  Botón: "Ir al Dashboard"                                         │     │
│   └──────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DASHBOARD (según rol)                                  │
│                                                                             │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│   │ ASESOR   │  │SUPERVISOR│  │  JEFE    │  │   BO     │  │  ADMIN   │   │
│   │ /asesor  │  │/supervisor│ │  /jefe   │  │/backoffice│ │ /admin   │   │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│        │             │             │             │             │           │
│        ▼             ▼             ▼             ▼             ▼           │
│   Mis Leads     LivePanel     Pipeline       Pendientes    Métricas        │
│   + Filtros     + Drill-down  Funnel         Tramitados    Sistema         │
│   + Power       + Reasignar   Comparativa    Activar       Workers         │
│     Dialer        Equipos     Forecast                     Bot Stats       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Flujo por Rol

### 2.1 Flujo del ASESOR

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     JORNADA TÍPICA DEL ASESOR                              │
│                                                                          │
│  1. LOGIN → /inicio → "Ir al Dashboard" → /asesor                        │
│                                                                          │
│  2. DASHBOARD ASESOR (/asesor)                                           │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │  Card: "Mis Leads" (N pendientes)                             │    │
│     │  Tabla: DNI | Nombre | CIMA | Renove | Intentos | Antigüedad │    │
│     │  Filtros: [CIMA: SI/NO] [Renove: SI/NO] [Buscar DNI...]      │    │
│     │                                                               │    │
│     │  ┌──────────────────────┐                                     │    │
│     │  │ IR AL POWER DIALER   │  → CLICK                             │    │
│     │  └──────────────────────┘                                     │    │
│     └──────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  3. POWER DIALER (/power-dialer)                                         │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │  ⏸ Pausa  |  ← Anterior  |  Lead 3 de 25  |  Siguiente →    │    │
│     │                                                               │    │
│     │  ┌─────────────────────────────────────────────────┐         │    │
│     │  │  ROCÍO MARTÍNEZ  —  DNI 75238036E               │         │    │
│     │  │  ⭐CIMA  🎁Renove Mixto Max  —  Ronda 2/5       │         │    │
│     │  │  Paquete: Love Empresa Smart                     │         │    │
│     │  └─────────────────────────────────────────────────┘         │    │
│     │                                                               │    │
│     │  Líneas del cliente:                                         │    │
│     │  ┌──────────────────────────────────────────┐                │    │
│     │  │ ⭐CIMA  📞 622 53 46 99  Principal 🟢    │ [LLAMAR]      │    │
│     │  │              Activa · Consumo 45.90€      │  ⭐ ☆ ⊕       │    │
│     │  ├──────────────────────────────────────────┤                │    │
│     │  │ 🎁Reno  📞 911 22 33 44  Agregado 🟣    │ [LLAMAR]      │    │
│     │  │              Suspendida                   │     ⊕        │    │
│     │  └──────────────────────────────────────────┘                │    │
│     │                                                               │    │
│     │  [+ Agregar número]                                           │    │
│     └──────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  4. CLICK EN [LLAMAR]                                                    │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │  🔵 En llamada — no cierres la ventana                        │    │
│     │  Llamando a 622534699 desde tu extensión 101                  │    │
│     │  VPBX → suena tu teléfono → descuelgas → marca al cliente     │    │
│     └──────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  5. MODAL DE RESULTADO (post-llamada)                                    │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │  ¿Cómo fue la llamada?                                        │    │
│     │                                                               │    │
│     │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────┐ │    │
│     │  │ CONTACTADO │ │NO CONTESTA │ │   BUZÓN    │ │EQUIVOCADO │ │    │
│     │  │   🟢       │ │   🔴       │ │   ⚪       │ │  🟠       │ │    │
│     │  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬─────┘ │    │
│     │        │              │              │              │        │    │
│     │        ▼              ▼              ▼              ▼        │    │
│     │   Se abre modal   Pipeline:     Pipeline:      Pipeline:     │    │
│     │   de TIPIFICACIÓN  no_contesta   pendiente      pendiente    │    │
│     │                    (con/sin      (misma ronda)  (misma ronda)│    │
│     │                     callback)                                │    │
│     └──────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  6. MODAL DE TIPIFICACIÓN (si Contactado)                                │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │  Estado:                                                      │    │
│     │  [Interesado] [Negociación] [Venta] [No Interesa] [No Contesta]│   │
│     │                                                               │    │
│     │  Sub-estado:                                                  │    │
│     │  [Proceso Portabilidad] [Volver a Llamar] [Agregó número]    │    │
│     │  [Confirmó número] [No llamar más] [Cliente fallecido]       │    │
│     │                                                               │    │
│     │  Fin de permanencia: [📅 seleccionar fecha]                   │    │
│     │  Callback: [📅 seleccionar fecha y hora]                      │    │
│     │  Notas: [___________________________]                         │    │
│     │                                                               │    │
│     │  [GUARDAR]                                                    │    │
│     └──────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  7. AGENDA (/agenda)                                                     │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │  📅 Hoy                    🔴 Vencidos (3)                    │    │
│     │  ┌────────────────────┐    ┌────────────────────┐            │    │
│     │  │ ROCÍO M. 622...    │    │ JUAN P. 911...     │            │    │
│     │  │ 14:30 · Interesado │    │ 11:00 (-45 min) 🔴 │            │    │
│     │  │ [Llamar] [Estado]  │    │ [Llamar] [Estado]  │            │    │
│     │  └────────────────────┘    └────────────────────┘            │    │
│     │                                                               │    │
│     │  📅 Mañana                                                    │    │
│     │  📅 Viernes 13 Junio                                          │    │
│     └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Flujo del SUPERVISOR

```
┌──────────────────────────────────────────────────────────────────────────┐
│                  FLUJO DEL SUPERVISOR                                     │
│                                                                          │
│  1. DASHBOARD SUPERVISOR (/supervisor)                                   │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │  Cards resumen:                                               │    │
│     │  [Ventas: 12] [Sin Asignar: 47] [Liberados: 8] [Activos: 5] │    │
│     │  [Contactados Hoy: 89]                                        │    │
│     │                                                               │    │
│     │  ┌─── LIVEPANEL ──────────────────────────────────────┐      │    │
│     │  │ 🟢 Disponibles: 3  |  🔵 En llamada: 1  |  🟡 Pausa: 1│   │    │
│     │  │                                                    │      │    │
│     │  │  Ana     🟢 Disponible    Ext 101   5 contactos   │      │    │
│     │  │  Luis    🔵 En llamada    Ext 102   3 contactos   │      │    │
│     │  │  Carmen  🟡 Almuerzo      Ext 103   12m en pausa  │      │    │
│     │  └────────────────────────────────────────────────────┘      │    │
│     │                                                               │    │
│     │  Tabla de Rendimiento:                                        │    │
│     │  Asesor | Equipo | Pend | Cont | Por Vencer | QA | Acción    │    │
│     │  ────────────────────────────────────────────────────         │    │
│     │  Ana    | España | 45   | 12   | 3         | 22 ✅ | [Ver→]  │    │
│     │  Luis   | España | 38   | 8    | 0         | 18 🟡 | [Ver→]  │    │
│     │  Carmen | España | 52   | 15   | 5         | 24 ✅ | [Ver→]  │    │
│     └──────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  2. DRILL-DOWN (click en [Ver leads])                                    │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │  Leads de Ana:                                                │    │
│     │  ☐ DNI | Nombre | CIMA | Renove | Intentos                   │    │
│     │  ☐ 75238036E | ROCÍO M. | ⭐ | 🎁 | 3                        │    │
│     │  ☐ 12345678A | JUAN P.   | ❌ | 🎁 | 1                        │    │
│     │                                                               │    │
│     │  Mover seleccionados a: [Luis ▼]  [REASIGNAR 2 LEADS]        │    │
│     └──────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  3. ASIGNAR LEADS (/asignar-leads)                                       │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │  Pool: 152 leads disponibles  |  ⭐CIMA 34 | 🎁Renove 28      │    │
│     │                                                               │    │
│     │  Chips de asesores:                                           │    │
│     │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │    │
│     │  │  Ana     │ │  Luis    │ │  Carmen  │ │  Pedro   │        │    │
│     │  │  [ 12]   │ │  [ 15]   │ │  [ 10]   │ │  [ 13]   │        │    │
│     │  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │    │
│     │                                                               │    │
│     │  Total a asignar: 50  |  [Repartir Igual]  |  [ASIGNAR]      │    │
│     └──────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  4. ESTADÍSTICAS (/estadisticas)                                         │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │  KPIs: Asignados: 152 | Contactados: 89 | Ventas: 12         │    │
│     │  Efectividad: 13.5% | Contactabilidad: 58.6%                 │    │
│     │                                                               │    │
│     │  📊 Actividad por día (barras)                                │    │
│     │  ┃                                                   ┃       │    │
│     │  ┃  ┃  ┃  ┃  ┃     ┃  ┃  ┃  ┃  ┃  ┃  ┃  ┃         │    │
│     │  Lun Mar Mie Jue Vie Sab Dom                                │    │
│     │                                                               │    │
│     │  Tabla por asesor + Export CSV                                │    │
│     └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Flujo del JEFE DE ÁREA

```
┌──────────────────────────────────────────────────────────────────────────┐
│                  FLUJO DEL JEFE DE ÁREA                                    │
│                                                                          │
│  1. DASHBOARD JEFE (/jefe)                                               │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │  Ventas Totales: 47     Ingreso Est.: ~€32,900               │    │
│     │  Conversión: 7.8%                                             │    │
│     │                                                               │    │
│     │  Pipeline Funnel:                                             │    │
│     │  Completados (1,250) → Sin Asignar (152) → Asignados (548)   │    │
│     │  → Contactados (320) → Ventas (47)                            │    │
│     │                                                               │    │
│     │  Comparativa Equipos:                                         │    │
│     │  Equipo  | Asesores | Ventas | Conv% | QA Prom                │    │
│     │  España  | 4        | 28     | 8.2%  | 21.3                   │    │
│     │  Perú    | 4        | 19     | 7.1%  | 19.8                   │    │
│     │                                                               │    │
│     │  Widget Bot: 🟢 5 workers activos | 234 DNIs en cola         │    │
│     └──────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  2. ASIGNAR LEADS (Jefe → Supervisores)                                  │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │  Pool: 152 leads disponibles                                  │    │
│     │                                                               │    │
│     │  Chips de supervisores:                                       │    │
│     │  ┌────────────┐ ┌────────────┐ ┌────────────┐                │    │
│     │  │Pablo (Esp) │ │María (Perú)│ │Carlos (Esp)│               │    │
│     │  │   [ 50]    │ │   [ 52]    │ │   [ 50]    │                │    │
│     │  └────────────┘ └────────────┘ └────────────┘                │    │
│     │                                                               │    │
│     │  Total a asignar: 152  |  [Repartir Igual]  |  [ASIGNAR]    │    │
│     │  ⚠️ No puedes asignar más de 152                               │    │
│     └──────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  3. INTELIGENCIA COMERCIAL (/inteligencia)                               │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │  [Scoring Orange] [Scoring Contacto] [Forecast] [Cinturones] │    │
│     │                                                               │    │
│     │  Distribución Scoring Orange:                                 │    │
│     │  A+ ████████░░░░░░░░░ 8.2%  (103 leads)                      │    │
│     │  A  ████████████░░░░░ 12.1% (151 leads)                      │    │
│     │  B  █████████████████ 45.3% (566 leads)                      │    │
│     │  C  ██████████░░░░░░░ 22.1% (276 leads)                      │    │
│     │  D  ██████░░░░░░░░░░░ 8.8%  (110 leads)                      │    │
│     │  E  ██░░░░░░░░░░░░░░░ 3.5%  (44 leads)                       │    │
│     │                                                               │    │
│     │  Forecast 7 días: 28 - 42 ventas estimadas                    │    │
│     └──────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  4. GESTIÓN DE USUARIOS (/usuarios)                                      │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │  [+ Nuevo Usuario]                                            │    │
│     │                                                               │    │
│     │  Nombre | Email | Rol | Equipo | Activo | Última | Acción    │    │
│     │  Ana    | ana@  | As  | España | ✅     | Hoy    | ✏️ 🗑     │    │
│     │  Pablo  | pablo | Sup | España | ✅     | Ayer   | ✏️ 🗑     │    │
│     └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Flujo del BACK OFFICE

```
┌──────────────────────────────────────────────────────────────────────────┐
│                  FLUJO DEL BACK OFFICE                                     │
│                                                                          │
│  1. DASHBOARD BO (/backoffice)                                           │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │  [Pendientes: 8] [Tramitados: 39]                             │    │
│     │                                                               │    │
│     │  DNI | Nombre | Producto | Fecha Venta | Asesor | Acción     │    │
│     │  7523 | ROCÍO  | Fibra+Móviles | 12 Jun | Ana   | [Tramitar] │    │
│     │  1234 | JUAN   | Solo Móvil    | 11 Jun | Luis  | [Tramitar] │    │
│     └──────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  2. MODAL DE TRAMITACIÓN                                                  │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │  Documentos requeridos:                                        │    │
│     │  ☑ DNI del titular                                             │    │
│     │  ☑ Contrato firmado                                            │    │
│     │  ☐ Factura de portabilidad                                     │    │
│     │  ☑ Grabación de venta                                          │    │
│     │                                                               │    │
│     │  [ACTIVAR]  [REVERTIR A PIPELINE]                             │    │
│     └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.5 Flujo del AUDITOR DE CALIDAD

```
┌──────────────────────────────────────────────────────────────────────────┐
│                  FLUJO DEL AUDITOR DE CALIDAD                              │
│                                                                          │
│  1. DASHBOARD QA (/calidad)                                              │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │  Seleccionar asesor: [Ana ▼]                                  │    │
│     │                                                               │    │
│     │  Llamadas recientes de Ana:                                   │    │
│     │  Fecha | Cliente | Duración | Evaluación | Acción            │    │
│     │  12Jun | ROCÍO   | 4:23     | Sin eval   | [Evaluar]        │    │
│     │  12Jun | JUAN    | 2:15     | 22/25 ✅   | [Ver]            │    │
│     │  11Jun | MARÍA   | 6:02     | 19/25 🟡   | [Ver]            │    │
│     └──────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  2. FORMULARIO DE EVALUACIÓN (Rúbrica 5 criterios)                       │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │  🎤 Reproducir grabación                                      │    │
│     │                                                               │    │
│     │  Speech (claridad, tono, profesionalismo):    ⭐⭐⭐⭐☆  4/5   │    │
│     │  Objeciones (manejo, argumentación):          ⭐⭐⭐☆☆  3/5   │    │
│     │  Cierre (técnica, concreción):                ⭐⭐⭐⭐⭐ 5/5  │    │
│     │  Compliance (normativa, RGPD, guiones):       ⭐⭐⭐⭐⭐ 5/5  │    │
│     │  Empatía (escucha activa, adaptación):        ⭐⭐⭐⭐⭐ 5/5  │    │
│     │                                                               │    │
│     │  Puntaje Total: 22/25 ✅                                      │    │
│     │  Comentarios: [________________________________]              │    │
│     │                                                               │    │
│     │  [GUARDAR EVALUACIÓN]                                         │    │
│     └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.6 Flujo del IT

```
┌──────────────────────────────────────────────────────────────────────────┐
│                  FLUJO DEL IT                                              │
│                                                                          │
│  1. INFRAESTRUCTURA (/infraestructura)                                    │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │  [Proxies] [Máquinas] [Credenciales]                          │    │
│     │                                                               │    │
│     │  Tab Proxies:                                                 │    │
│     │  IP:Puerto | Usuario | Acción                                 │    │
│     │  45.xx:8080| user1   | 🗑                                     │    │
│     │  [+ Agregar Proxy] [formato: ip:puerto:usuario:pass]         │    │
│     │                                                               │    │
│     │  Tab Máquinas:                                                │    │
│     │  Nombre | IP | Estado | Workers | Heartbeat | Acción         │    │
│     │  localhost| - | 🟢 online| 5/20 | Hace 8s | 🗑              │    │
│     │  vps-2    | x | 🔴 offline| 0/10 | Hace 2h | 🗑              │    │
│     │  [+ Agregar Máquina]                                          │    │
│     │                                                               │    │
│     │  Tab Credenciales:                                            │    │
│     │  Usuario | Estado | Último uso | Último error | Acción       │    │
│     │  user1   | ✅     | Hace 5m     | -           | ✏️ 🗑       │    │
│     │  [+ Agregar Credencial]                                       │    │
│     └──────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  2. CONTROL DE BOTS (/bots)                                              │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │  Máquina: [localhost ▼]  Workers: [5]                         │    │
│     │                                                               │    │
│     │  [▶ Iniciar]  [⏸ Pausar]  [⏹ Detener]                        │    │
│     │                                                               │    │
│     │  Estado: ✅ 5 workers activos en localhost                    │    │
│     │  DNIs procesados hoy: 234                                     │    │
│     │  Último DNI: 75238036E (hace 12s)                            │    │
│     └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Flujos Transversales

### 3.1 Flujo de Sistema de Pausas

```
Power Dialer → Click ⏸ Pausa
    │
    ▼
Modal: Seleccionar tipo de pausa
┌──────────────────────────────┐
│  🚽 Baño                     │
│  🍽️ Almuerzo                 │
│  ☕ Descanso                  │
│  📋 Reunión                  │
│  📚 Capacitación             │
│  📝 Otro                     │
│                              │
│  [INICIAR PAUSA]             │
└──────────────────────────────┘
    │
    ▼
Pantalla completa bloqueante con timer
┌──────────────────────────────┐
│  ⏸ EN PAUSA                  │
│                              │
│  Almuerzo                    │
│  ⏱️ 00:12:34                 │
│                              │
│  [FINALIZAR PAUSA]           │
└──────────────────────────────┘
    │
    ▼
POST /api/pausas → fin = now()
LivePanel del supervisor se actualiza automáticamente
```

### 3.2 Flujo de Notificaciones (Sidebar Badges)

```
Sidebar — Badges rojos 🔴 con contadores contextuales:

ASIGNAR LEADS [47]🔴   ← Leads sin asignar en el pool
AGENDA [3]🔴           ← Callbacks vencidos o para hoy
ALERTAS [2]🔴          ← Notificaciones no leídas

Cálculo contextual por rol:
- Jefe → pool completo del proyecto
- Supervisor → pool filtrado por su equipo (si aplica)
- Asesor → sinAsignar = 0 (él no asigna)

Los contadores se refrescan cada vez que se abre/cierra el sidebar
vía GET /api/pipeline/notifications?user_id=X&rol=Y
```

### 3.3 Flujo de WhatsApp

```
Power Dialer → Botón WhatsApp 🟢
    │
    ▼
Seleccionar plantilla:
┌──────────────────────────────┐
│  Plantillas disponibles:     │
│  📋 Bienvenida               │
│  📋 Info Renove              │
│  📋 Seguimiento              │
│  📋 Oferta                   │
│                              │
│  [ENVIAR]                    │
└──────────────────────────────┘
    │
    ▼
Verificar opt-in del cliente:
    ├── ✅ True → POST /api/whatsapp/send → Meta API → Cliente
    └── ❌ False → Error: "Cliente no dio consentimiento"
```

### 3.4 Flujo de Búsqueda y Ficha de Cliente

```
/clientes → Tabla maestra (500 registros)
    │
    ├── Filtros: [Buscar DNI/nombre] [CIMA: SI/NO] [Renove: SI/NO]
    ├── [Exportar CSV]
    │
    └── Click en fila → expandir:
        ┌──────────────────────────────────────────┐
        │  Líneas:                                 │
        │  Número | CIMA | Estado | Consumo | ...  │
        │  ─────────────────────────────────────── │
        │  622... | ⭐SI | Activa | 45.90€ | ...   │
        │  911... | ❌NO | Suspen | -      | ...   │
        │                                          │
        │  Cambios detectados:                     │
        │  📌 12 Jun: Línea 622 cambió de estado   │
        │                                          │
        │  Historial:                              │
        │  12 Jun 14:30 - Llamada (4:23)          │
        │  12 Jun 10:15 - Extracción bot           │
        │  11 Jun 16:00 - Asignado a Ana           │
        └──────────────────────────────────────────┘
        │
        └── Click en DNI → FichaCliente modal 360°
            ┌──────────────────────────────────────┐
            │  Pestañas:                           │
            │  [Datos] [Pipeline] [Llamadas] [Docs]│
            │                                      │
            │  Datos completos del cliente         │
            │  + Líneas con detalle completo       │
            │  + Proyectos en los que está         │
            │  + Opciones RGPD                     │
            └──────────────────────────────────────┘
```

### 3.5 Flujo de Configuración de Proyecto

```
/inicio → ⚙️ (icono engranaje, solo Dev/Jefe)
    │
    ▼
Overlay modal full-screen
┌──────────────────────────────────────────────┐
│  CONFIGURACIÓN DE PROYECTOS                  │
│                                              │
│  Proyecto: [Orange ▼]                        │
│                                              │
│  ┌─── General ─────────────────────────┐    │
│  │  Nombre: Orange                     │    │
│  │  Logo URL: [https://...]            │    │
│  │  Activo: ✅                         │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  ┌─── Metas ──────────────────────────┐    │
│  │  Ventas diarias: 10                │    │
│  │  Ventas semanales: 50              │    │
│  │  Ventas mensuales: 200             │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  ┌─── Pipeline ───────────────────────┐    │
│  │  Cooldown intentos: 48h            │    │
│  │  Máx rondas: 5                     │    │
│  │  Días liberación: 7                │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  ┌─── Campos Lead ────────────────────┐    │
│  │  [campo1: CIMA, tipo: badge]       │    │
│  │  [campo2: Renove, tipo: badge]     │    │
│  │  [+ Agregar campo]                 │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  [GUARDAR]                                   │
└──────────────────────────────────────────────┘
```

---

## 4. Sidebar — Mapa de Navegación

```
SIDEBAR (colapsable) — v2 con acordeón y badges
│
├── 📊 DASHBOARD
│   ├── General        (Jefe, Dev, IT)
│   ├── Asesor          (Asesor)
│   ├── Supervisor      (Supervisor)
│   ├── BO              (Back Office)
│   └── Admin           (IT, Dev)
│
├── 💼 COMERCIAL
│   ├── Power Dialer 🔵 (Asesor, Supervisor)
│   ├── Agenda 🔴       (Asesor, Supervisor)
│   ├── Fichaje 🕐       (Asesor, Sup, Jefe, BO, IT, Dev)
│   ├── Clientes        (Supervisor, Jefe, IT, Dev)
│   └── Asignar Leads 🔴(Jefe, Supervisor, Dev)
│
├── 👁️ SUPERVISIÓN
│   ├── Rendimiento     (Supervisor, Jefe, Dev)
│   ├── Inteligencia    (Supervisor, Jefe, Dev)
│   ├── Estadísticas    (Supervisor, Jefe, Dev)
│   ├── Auditoría       (Supervisor, Jefe, Dev)
│   ├── QA              (Auditor, Sup, Jefe, Dev)
│   ├── Metas           (Supervisor, Jefe)
│   └── Alertas 🔴      (Supervisor, Jefe)
│
├── ⚙️ ADMINISTRACIÓN
│   ├── VPBX            (Supervisor, Jefe, Dev, IT)
│   ├── Usuarios        (Jefe, Dev)
│   ├── Infraestructura (IT, Dev)
│   ├── Apps            (IT, Dev)
│   ├── Documentos      (Supervisor, Jefe, IT, Dev)
│   └── Configuración   (IT, Dev)
│
├── 📚 APRENDIZAJE
│   └── Wikiratioo      (Todos)
│
├── 👤 PERFIL           (Todos)
├── 🌙 DARK/LIGHT       (Todos)
└── 🚪 CERRAR SESIÓN    (Todos)
```

---

## 5. Ciclo de Vida del Lead (Línea de Tiempo)

```
DÍA 1 — ENTRADA DE DATOS
  🕐 10:00 Bot extrae DNI 75238036E de Orange Pangea
  🕐 10:00 → clientes_proyectos.datos guardado (version=1)
  🕐 10:00 → Estado: completado (en pool, sin asignar)

DÍA 1 — ASIGNACIÓN
  🕐 14:00 Jefe asigna 50 leads a supervisores
  🕐 14:00 → Supervisor Pablo asigna 15 a Ana
  🕐 14:00 → pipeline: estado=pendiente, ronda=1, asesor=Ana
           → Notificación sidebar: "Asignar Leads: 47 🔴"

DÍA 2 — PRIMERA LLAMADA
  🕐 09:30 Ana abre Power Dialer → ve a ROCÍO MARTÍNEZ
  🕐 09:31 Click "Llamar" → 622534699
  🕐 09:35 Cuelga → modal "Contactado"
  🕐 09:35 Tipifica: INTERESADO, notas "Fibra, permanencia hasta 2028"
  🕐 09:35 → pipeline: estado=interesado

DÍA 5 — SEGUNDA RONDA (cooldown 48h pasado)
  🕐 11:00 Ana llama → "Estoy de viaje, llámame en 1 semana"
  🕐 11:01 Tipifica: NO CONTESTA, sub=Volver a Llamar, callback=12 Jun
  🕐 11:01 → pipeline: estado=no_contesta, callback_at=2026-06-12

DÍA 12 — CALLBACK AUTOMÁTICO
  🕐 02:00 CRON libera leads con callback vencido
  🕐 02:00 → pipeline: estado=pendiente (reactivado)
  🕐 09:00 Ana ve el lead en su dashboard → va al Power Dialer

DÍA 12 — TERCERA RONDA
  🕐 10:00 Ana llama → interesado pero quiere pensarlo
  🕐 10:01 Envía WhatsApp: plantilla "Seguimiento"
  🕐 10:01 → whatsapp_mensajes: saliente, seguimiento

DÍA 15 — CUARTA RONDA → ¡VENTA!
  🕐 15:30 Ana llama → ¡Venta! Fibra 600Mb + 2 Móviles 50GB
  🕐 15:35 Tipifica: VENTA
  🕐 15:35 → pipeline: estado=venta → Back Office notificado

DÍA 16 — TRAMITACIÓN
  🕐 09:00 Back Office verifica documentos
  🕐 09:30 Click "Activar" → pipeline: estado=activado
  🕐 09:30 → Cliente activo en Orange. Comisión para Ana 💰

RESULTADO: Lead procesado en 15 días, 4 rondas, 1 venta.
```

---

## 6. Diagrama de Estados del Pipeline

```
                    ┌──────────┐
                    │PENDIENTE │ ← estado inicial al asignar
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        ┌──────────┐ ┌────────┐ ┌──────────┐
        │CONTACTADO│ │BUZÓN   │ │EQUIVOCADO│ → sigue en pendiente
        └────┬─────┘ └───┬────┘ └──────────┘    (misma ronda)
             │            │
    ┌────────┼────────┐   └→ sigue en pendiente
    ▼        ▼        ▼      (misma ronda)
┌────────┐┌────────┐┌───────┐
│INTERESA││NEGOCIA ││VENTA  │
└───┬────┘└───┬────┘└───┬───┘
    │         │         │
    │         │         ▼
    │         │   ┌─────────────┐
    │         │   │BACK OFFICE  │
    │         │   │(Tramitación)│
    │         │   └──────┬──────┘
    │         │          ▼
    │         │   ┌─────────────┐
    │         │   │ACTIVADO     │ 🏁 FIN
    │         │   └─────────────┘
    │         │
    └────┬────┘
         │ (si no avanza)
         ▼
    ┌──────────┐    ┌───────────┐
    │NO INTERES│    │NO CONTESTA│
    └────┬─────┘    └─────┬─────┘
         │                │
         ▼                ▼
    ┌──────────┐    ┌──────────────┐
    │ANÁLISIS  │    │CALLBACK       │
    │PERDIDOS  │    │programado     │
    └──────────┘    └──────┬───────┘
    🏁 FIN                 │
                           ▼ (al vencer)
                    ┌──────────┐
                    │PENDIENTE │ → vuelve al ciclo
                    └──────────┘

Sistema de Rondas:
  Ronda 1 → Ronda 2 (tras 48h cooldown) → ... → Ronda 5
  Si 5 rondas sin contacto → CIERRE AUTOMÁTICO → análisis_perdidos
```
