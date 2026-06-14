# Oratioo CX — Roles y Permisos Detallados

> Sistema RBAC con 7 roles. Cada rol tiene permisos específicos por página y por acción.
> El acceso se controla en dos capas: middleware (rutas) + API (endpoints).

---

## 📋 Tabla Resumen de Roles

| # | Rol | Propósito | Usuarios |
|---|---|---|---|
| 1 | `asesor` | Operador telefónico que llama y tipifica | 8 |
| 2 | `supervisor` | Gestiona equipo, monitorea rendimiento | 3 |
| 3 | `jefe_area` | Control total de la campaña comercial | 3 |
| 4 | `back_office` | Tramitación documental post-venta | 2 |
| 5 | `auditor_calidad` | Evalúa calidad de llamadas y atención | 0 |
| 6 | `it` | Infraestructura técnica y soporte | 1 |
| 7 | `desarrollador` | Acceso total al sistema | 2 |

---

## 1. Rol `asesor` — Operador Telefónico

### Perfil
El asesor es el usuario principal del CRM. Su trabajo diario consiste en:
1. Abrir el Power Dialer
2. Llamar a los leads asignados
3. Tipificar el resultado de cada llamada
4. Gestionar su agenda de callbacks

### Páginas que Puede Acceder

#### Dashboard Asesor (`/asesor`)
Es la página de inicio del asesor. Muestra:
- **Tarjeta de bienvenida** con su nombre y rol
- **Tabla "Mis Leads"** con columnas:
  - DNI del cliente
  - Nombre (extraído por el bot)
  - CIMA (SI/NO, badge verde si es CIMA)
  - Renove (SI/NO, badge azul si tiene)
  - Intentos realizados hoy
  - Antigüedad (días desde que se asignó)
- **Filtros:** por CIMA (SI/NO), por Renove (SI/NO), búsqueda por DNI o nombre
- **Botón "Ir al Power Dialer"** para comenzar a llamar

#### Power Dialer (`/power-dialer`)
La herramienta principal de trabajo. Muestra:
- **Navegación entre leads:** botones Anterior/Siguiente, contador "3 de 25"
- **Tarjeta del lead actual:**
  - Nombre y DNI en grande
  - Badges de CIMA y Renove
  - Indicador de ronda actual "Ronda 2/5"
  - Paquete contratado
- **Lista de líneas telefónicas del cliente** con:
  - Número de teléfono en formato grande
  - Etiquetas del bot (Principal, CIMA, Incluido en Pack)
  - Iconos de CIMA (⭐) y Renove (🎁)
  - Badge de tipo de número: Principal (verde), Agregado (morado)
  - **Botón "Llamar"** en verde (se deshabilita durante llamada activa)
  - **Botón estrella** ⭐ para marcar como contacto principal
  - **Botón expandir** (⊕) para ver detalles: producto, estados, permanencia, consumo, VAP, campañas
- **Botón "Agregar número":** input para registrar un número nuevo que el cliente proporciona
- **Modal de resultado post-llamada:**
  - 4 botones grandes: Contactado (verde), No Contesta (rojo), Buzón (gris), Equivocado (ámbar)
  - Campo de notas opcional
  - Botón "Marcar No Contesta y siguiente"
- **Modal de tipificación** (si eligió "Contactado"):
  - 6 estados: Interesado, Negociación, Venta, No Interesa, No Contesta, Contactado
  - 4 sub-estados: Proceso de Portabilidad, Volver a Llamar, Agregó otro número, Confirmó su número
  - Campos condicionales: fecha de fin de permanencia, fecha de callback
  - Campo de notas
- **Botón WhatsApp** para abrir chat con el cliente
- **Indicador de "En llamada — no cierres la ventana"** durante llamada activa

#### Agenda (`/agenda`)
- Lista de callbacks programados para hoy y días siguientes
- Cada entrada muestra: DNI, nombre, teléfono, fecha/hora programada, notas
- Botón "Llamar ahora" para saltar directamente al lead en el Power Dialer

#### Perfil (`/perfil`)
- Datos personales: nombre, email, rol, equipo
- Formulario para cambiar contraseña (requiere contraseña actual + nueva)
- Validación de complejidad: mínimo 8 caracteres, 1 mayúscula, 1 número

#### Wikiratioo (`/wikiratioo`)
- Base de conocimiento con artículos y guías
- Contenido sobre productos, técnicas de venta, objeciones frecuentes
- Búsqueda por texto

### Lo que PUEDE hacer
- Ver sus propios leads asignados
- Llamar a cualquier número de la lista del lead
- Agregar números nuevos proporcionados por el cliente
- Marcar un número como contacto principal del cliente
- Tipificar resultados de llamada con estados y sub-estados
- Programar callbacks para volver a llamar
- Ver su historial de llamadas del día
- Ver su score de calidad (QA)
- Cambiar su contraseña
- Ver contenido de formación en Wikiratioo

### Lo que NO puede hacer
- Ver leads de otros asesores
- Asignar o reasignar leads
- Ver estadísticas globales del equipo
- Modificar configuración del sistema
- Controlar bots o infraestructura
- Ver datos financieros o métricas de otros
- Crear o editar usuarios
- Acceder a páginas de administración

---

## 2. Rol `supervisor` — Gestor de Equipo

### Perfil
El supervisor gestiona un equipo de asesores. Monitorea en tiempo real la actividad, reasigna cargas de trabajo, y analiza el rendimiento del equipo.

### Páginas que Puede Acceder

#### Dashboard Supervisor (`/supervisor`)
- **Tarjetas de resumen:** Ventas totales, Sin Asignar, Liberados, Asesores activos, Contactados hoy
- **Panel en vivo (LivePanel):**
  - Contadores: Disponibles, En llamada, En Pausa
  - Tarjetas individuales por asesor con:
    - Nombre y extensión
    - Estado en tiempo real (🟢 disponible, 🔵 en llamada, 🟡 pausa, ⬜ offline)
    - Indicador de actividad (dot animado)
    - Contador de contactos y pendientes
    - Fuente de datos: VPBX API (estado real) o simulación (si VPBX no está conectado)
- **Tabla de rendimiento del equipo:**
  - Columnas: Asesor, Equipo, Pendientes, Contactados, Por Vencer, Estado, QA Score
  - QA Score con código de colores: verde ≥20, ámbar ≥15, rojo <15
  - **Botón "Ver leads"** en cada fila → expande tabla con los leads del asesor
- **Panel de leads del asesor (drill-down):**
  - Tabla con DNI, Nombre, CIMA, Renove, Intentos
  - Checkbox para selección múltiple
  - Dropdown "Mover a" para reasignar a otro asesor
  - Botón "Reasignar N leads" para mover en lote

#### Clientes (`/clientes`)
- **Tabla maestra** con todos los clientes extraídos por el bot (500 registros)
- Columnas: DNI, Nombre, CIMA, Línea Principal, Paquete, Renove, Fecha, Hora, Estado
- **Filtros:** búsqueda por DNI/nombre, filtro por CIMA, filtro por Renove
- **Exportar CSV** — descarga la tabla completa
- **Expandir fila** para ver detalle del cliente:
  - **Sección "Líneas":** tabla con Número, CIMA, Estado, Consumo, Permanencia, VAP, Renove, TV, Activo desde
    - Los estados se colorean: rojo si activo, gris si inactivo
  - **Sección "Cambios detectados":** lista de detecciones de la última extracción
  - **Sección "Historial":** timeline de eventos del cliente
- **Click en DNI** → abre FichaCliente modal 360°

#### Power Dialer (`/power-dialer`)
Misma interfaz que el asesor. Además:
- Puede ver y llamar a cualquier lead (no solo los propios)
- Puede tipificar cualquier lead

#### Agenda (`/agenda`)
- Vista de todas las agendas de su equipo
- Filtro por asesor

#### Estadísticas (`/estadisticas`)
- **KPIs principales:** Asignados, Contactados, Ventas, Efectividad (%), Contactabilidad (%)
- **Tiempos:** Codificación (wrap-up), Hasta primera llamada
- **Gráficos:** Actividad por día (barras), Actividad por franja horaria (líneas)
- **Tabla por asesor:** % Éxito, barra de progreso, todas las métricas
- **Filtros:** desde-hasta fecha, por equipo
- **Exportar CSV**

#### Metas (`/metas`)
- **Ranking** de asesores ordenado por ventas
- **Barras de progreso** visuales hacia la meta mensual
- **Top Performer** destacado
- **KPIs individuales:** ventas, contactos, conversión
- **Filtro por equipo**

#### Alertas (`/alertas`)
- **Centro de notificaciones** con tarjetas por tipo:
  - Leads sin asignar (rojo, con contador)
  - Leads por vencer (ámbar)
  - Máquinas offline (rojo)
  - Callbacks vencidos (naranja)
- **Links contextuales** que llevan a la sección correspondiente

#### Perfil (`/perfil`)
Mismas funcionalidades que asesor.

#### Wikiratioo (`/wikiratioo`)
Mismas funcionalidades que asesor.

### Lo que PUEDE hacer (además de lo del asesor)
- Ver todos los leads de su equipo
- Reasignar leads entre asesores (individual y masivo)
- Ver métricas de contactabilidad, conversión, tiempos
- Ver ranking completo de asesores
- **Gestionar codificaciones de tipificación:**
  - Agregar nuevos estados/sub-estados
  - Editar etiquetas y colores
  - Activar/desactivar codificaciones
  - Configurar cuáles afectan la calidad (van a lista negra)
- Ver y descargar reportes de listas negras (CSV)
- Ver dashboard de salud de la base de datos
- Gestionar credenciales Pangea (agregar, editar contraseña, eliminar)
- Ver todas las estadísticas y exportar datos
- **Gestionar VPBX:** asignar extensiones SIP a operadores desde la pagina `/vpbx`
- Ver estado de agentes VPBX en tiempo real

### Lo que NO puede hacer
- Crear o eliminar usuarios
- Modificar infraestructura técnica (proxies, máquinas)
- Controlar bots (iniciar/detener workers)
- Acceder a configuración del sistema
- Ver datos de otros proyectos (solo el asignado)

---

## 3. Rol `jefe_area` — Director de Campaña

### Perfil
El jefe de área tiene control total sobre la campaña comercial. Define estrategia, asigna recursos, y es responsable de los resultados globales.

### Páginas que Puede Acceder

#### Dashboard Jefe (`/jefe`)
- **Resumen ejecutivo:**
  - Ventas totales (número grande)
  - Ingreso estimado (ventas × valor promedio)
  - Tasa de conversión global
- **Pipeline Funnel visual:**
  - Completados → Sin asignar → Asignados → Contactados → Ventas
  - Cada etapa con contador y porcentaje
- **Comparativa por equipo:**
  - Tabla con equipo, asesores, ventas, conversión, QA promedio
- **Widget estado del bot:**
  - Workers activos
  - DNIs en cola
  - Proxies disponibles
  - Máquinas online
- **Panel de parámetros operativos:**
  - Metas de venta diarias/semanales
  - Cooldown entre intentos
  - Máximo de intentos/rondas
  - Días para liberación automática

#### Asignar Leads (`/asignar-leads`)
- **Sistema de chips por jerarquía:** CEO asigna a Jefes, Jefe a Supervisores, Supervisor a Asesores
- **Chips con input numérico:** cada subordinado es un chip clickeable con campo para indicar cuántos leads asignarle
- **Botón "Repartir igual":** distribuye equitativamente entre todos los subordinados
- **Validación:** no permite asignar más leads de los disponibles (contador en rojo si excede)
- **Resumen rápido:** cards con total disponibles, CIMA, Renove, CIMA+Renove
- **Tabla de liberados** para reasignar leads devueltos al pool

#### Clientes (`/clientes`)
Mismas funcionalidades que supervisor.

#### Power Dialer (`/power-dialer`)
Mismas funcionalidades que supervisor.

#### Estadísticas (`/estadisticas`)
Mismas funcionalidades que supervisor, más:
- Vista multi-proyecto
- Comparativa inter-proyecto

#### Metas (`/metas`)
Mismas funcionalidades que supervisor, más:
- Configuración de metas por equipo
- Ajuste de objetivos

#### Alertas (`/alertas`)
Mismas funcionalidades que supervisor.

#### Auditoría (`/auditoria`)
- **Timeline completo** de toda la actividad del sistema:
  - Asignaciones, liberaciones, tipificaciones, llamadas
  - Extracciones del bot
  - Cambios de configuración
- **Filtros:** por fecha, por tipo de evento, por usuario
- **Búsqueda** por DNI o nombre

#### Proyectos (`/proyectos`)
- **Lista de proyectos** activos
- **Crear nuevo proyecto:** nombre, descripción, configuración inicial
- **Estadísticas por proyecto:** ventas, leads, conversión
- **Configuración de codificaciones** por proyecto

#### Usuarios (`/usuarios`)
- **Tabla de usuarios** con columnas: Nombre, Email, Rol, Equipo, Activo, Última conexión
- **Crear usuario:** formulario con email, nombre, contraseña, rol, equipo, supervisor asignado
- **Editar usuario:** cambiar rol, equipo, nombre, email, activar/desactivar
- **Resetear contraseña** de cualquier usuario

#### Bots (`/bots`)
- **Panel de control de workers:**
  - Selector de máquina (localhost, vps-espana-1, etc.)
  - Input numérico para cantidad de workers
  - Botones: Iniciar (verde), Pausar (ámbar), Detener (rojo)
  - Estado actual: "5 workers activos en localhost"
  - Indicador de loading durante envío de comando
  - Mensaje de estado (feedback)

#### Configuración (`/config`)
- Parámetros operativos globales
- Configuración de thresholds para alertas
- Configuración de horarios comerciales

#### Perfil (`/perfil`)
Mismas funcionalidades que asesor.

#### Wikiratioo (`/wikiratioo`)
Mismas funcionalidades que asesor.

### Lo que PUEDE hacer (además de supervisor)
- Crear, editar y desactivar usuarios
- Asignar equipos y supervisores
- Ver funnel completo de ventas multi-proyecto
- Ver comparativas entre equipos y proyectos
- Configurar parámetros operativos globales
- **Controlar bots:** iniciar, pausar, detener workers en cualquier máquina
- **Enviar comandos al coordinator** desde el panel
- Acceder a auditoría completa
- Ver estadísticas avanzadas
- Gestionar proyectos (crear, editar)
- **Gestionar VPBX:** acceso completo a `/vpbx` para asignar extensiones y monitorear agentes
- Ver estado de agentes VPBX en tiempo real

### Lo que NO puede hacer
- Modificar infraestructura técnica (proxies, máquinas, servidores)
- Acceder a rutas de desarrollador (admin stats, etc.)
- Ejecutar migraciones de base de datos

---

## 4. Rol `back_office` — Tramitación Documental

### Perfil
El back office gestiona la fase post-venta: verificar documentación, activar servicios, tramitar altas.

### Páginas que Puede Acceder

#### Dashboard Back Office (`/backoffice`)
- **Tabs:** Pendientes y Tramitados
- **Tabla de ventas pendientes de tramitar:**
  - DNI, Nombre, Producto, Fecha de venta, Asesor
  - **Botón "Tramitar"** → abre modal de verificación
- **Modal de tramitación:**
  - Checklist de documentos requeridos (DNI, contrato, factura)
  - Botón "Activar" para confirmar tramitación
  - Botón "Revertir" para devolver a pipeline

#### Power Dialer (`/power-dialer`)
Acceso en modo solo lectura — puede ver los leads pero no llamar.

#### Agenda (`/agenda`)
Acceso en modo solo lectura.

#### Perfil (`/perfil`)
Mismas funcionalidades que asesor.

#### Wikiratioo (`/wikiratioo`)
Mismas funcionalidades que asesor.

### Lo que PUEDE hacer
- Ver leads en estado "venta"
- Tramitar documentos (verificar y activar)
- Revertir ventas a estados anteriores
- Ver historial de tramitaciones

### Lo que NO puede hacer
- Llamar a clientes
- Tipificar leads
- Ver métricas de operadores
- Modificar configuración
- Ver datos de clientes no relacionados con tramitación

---

## 5. Rol `auditor_calidad` — Quality Assurance

### Perfil
El auditor de calidad evalúa las llamadas grabadas para asegurar estándares de atención y compliance.

### Páginas que Puede Acceder

#### Dashboard Calidad (`/calidad`)
- **Panel de evaluaciones:**
  - Selector de asesor a evaluar
  - Lista de llamadas grabadas del asesor
  - Reproductor de audio (cuando VPBX grabaciones esté activo)
- **Formulario de evaluación (rúbrica 5 criterios):**
  - **Speech (1-5⭐):** Claridad, tono, lenguaje profesional
  - **Objeciones (1-5⭐):** Manejo de objeciones, argumentación
  - **Cierre (1-5⭐):** Técnica de cierre, concreción
  - **Compliance (1-5⭐):** Cumplimiento normativo, RGPD, guiones
  - **Empatía (1-5⭐):** Escucha activa, adaptación al cliente
  - Puntaje total automático: suma de los 5 (sobre 25)
- **Resumen por asesor:**
  - Promedio de evaluaciones
  - Tendencia (mejorando/empeorando)
  - Últimas 10 evaluaciones

#### Power Dialer (`/power-dialer`)
Acceso en modo solo lectura.

#### Perfil (`/perfil`)
Mismas funcionalidades que asesor.

#### Wikiratioo (`/wikiratioo`)
Mismas funcionalidades que asesor.

### Lo que PUEDE hacer
- Escuchar grabaciones de llamadas
- Evaluar con rúbrica de 5 criterios
- Asignar puntuación por criterio
- Ver historial de evaluaciones propias
- Ver resumen por asesor

### Lo que NO puede hacer
- Llamar a clientes
- Modificar pipeline
- Ver métricas comerciales
- Acceder a datos de clientes (solo los necesarios para evaluar)

---

## 6. Rol `it` — Infraestructura y Soporte Técnico

### Perfil
El rol de IT gestiona la infraestructura técnica: proxies, máquinas, credenciales, y monitoreo del sistema.

### Páginas que Puede Acceder

#### Infraestructura (`/infraestructura`)
- **Tab "Proxies":**
  - Lista de proxies cargados con IP, puerto, usuario
  - Formulario para agregar nuevo proxy
  - Botón para eliminar proxy
  - Indicador de proxies activos
- **Tab "Máquinas":**
  - Lista de VPS registrados con: nombre, IP, estado (online/offline), workers activos/máx, último heartbeat
  - Formulario para agregar nueva máquina
  - Botón para eliminar máquina
  - Indicador de estado con dot verde/gris
- **Tab "Credenciales":**
  - Lista de credenciales Pangea con: usuario, estado (activo/inactivo), último uso, último error
  - Formulario para agregar nueva credencial
  - Botón para editar contraseña (✏️)
  - Botón para activar/desactivar
  - Botón para eliminar
  - Contador de credenciales disponibles

#### Bots (`/bots`)
- Panel de control completo (mismas funcionalidades que jefe de área)

#### Admin Clientes (`/admin/clientes`)
- Vista administrativa de todos los clientes
- Acciones avanzadas: reanalizar, eliminar (RGPD)

#### Admin Documentos (`/admin/documentos`)
- Gestión de documentos cargados
- Reprocesar documentos con error

#### Configuración (`/config`)
- Acceso a configuración avanzada del sistema

#### Todas las demás páginas
Acceso completo a todas las páginas del sistema, incluyendo VPBX.

### Lo que PUEDE hacer (TODO)
- CRUD completo de proxies
- CRUD completo de máquinas
- CRUD completo de credenciales Pangea
- Iniciar/detener/pausar workers en cualquier máquina
- Ver logs del sistema
- Acceder a todos los endpoints API
- Ver métricas avanzadas del sistema (CPU, RAM, workers activos)
- Auditoría completa
- Todas las funciones de jefe de área
- **Gestionar VPBX:** asignar extensiones SIP a operadores, monitorear agentes

### Lo que NO puede hacer
- Ejecutar migraciones de base de datos (solo desarrollador)
- Modificar código fuente

---

## 7. Rol `desarrollador` — Acceso Total

### Perfil
El desarrollador tiene acceso sin restricciones a todo el sistema. Puede modificar cualquier dato, acceder a cualquier endpoint, y ejecutar operaciones de base de datos.

### Páginas que Puede Acceder
**Todas las páginas del sistema sin excepción.**

### Lo que PUEDE hacer (TODO)
- Absolutamente todo lo que cualquier otro rol puede hacer
- Ejecutar migraciones de base de datos
- Acceder a endpoints internos sin restricciones
- Modificar cualquier registro
- Ver logs del sistema
- Acceso directo a base de datos (en desarrollo)
- Bypass de cualquier restricción de seguridad (en desarrollo)

---

## 🔒 Matriz de Acceso por Página

| Página | asesor | supervisor | jefe_area | back_office | auditor | it | dev |
|---|---|---|---|---|---|---|---|
| `/asesor` (Dashboard) | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/supervisor` | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `/jefe` | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `/clientes` | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `/power-dialer` | ✅ | ✅ | ✅ | 👁️ | 👁️ | ✅ | ✅ |
| `/asignar-leads` | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `/agenda` | ✅ | ✅ | ✅ | 👁️ | ❌ | ✅ | ✅ |
| `/estadisticas` | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `/auditoria` | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `/metas` | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `/alertas` | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `/vpbx` | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `/calidad` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `/backoffice` | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| `/infraestructura` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/bots` | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `/usuarios` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `/config` | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `/proyectos` | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `/perfil` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/wikiratioo` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

👁️ = Solo lectura (no puede llamar ni modificar)

---

## 🔒 Matriz de Acceso por API

| Endpoint | asesor | supervisor | jefe_area | back_office | auditor | it | dev |
|---|---|---|---|---|---|---|---|
| `GET /api/pipeline/mine` | ✅* | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `POST /api/pipeline` (asignar) | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `POST /api/pipeline/tipificar` | ✅* | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `POST /api/bot/command` | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `GET /api/admin/stats` | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `GET/POST /api/admin/credenciales` | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `GET/POST /api/usuarios` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `GET/POST /api/tipificaciones-config` | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `GET /api/listas-negras` | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `GET /api/qa` | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| `POST /api/qa` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| `POST /api/documentos/upload` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `GET /api/vpbx/extensions` | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `GET /api/vpbx/agents` | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `POST /api/vpbx/originate` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |

✅* = Solo sus propios leads (requirePipelineOwnership)
