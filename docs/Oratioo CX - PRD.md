# Oratioo CX — Documento de Requisitos del Producto (PRD)

> **Versión:** 5.3 | **Fecha:** 12 Junio 2026 | **Autor:** Jeff Steven Gil Toribio
> **Proyecto:** CRM Omnicanal Multi-Proyecto para Call Centers de Ventas Outbound

---

## 1. Resumen Ejecutivo

### 1.1 Propósito

Oratioo CX es un CRM omnicanal diseñado para automatizar y gestionar el ciclo completo de ventas outbound en call centers. Integra extracción automatizada de datos desde portales de carriers de telecomunicaciones (comenzando por Orange España), asignación inteligente de leads, discador telefónico con Click2Call, pipeline comercial completo, inteligencia comercial con scoring y forecasting, y dashboards de gestión por niveles jerárquicos.

### 1.2 Problema que Resuelve

- **Extracción manual de datos:** Los asesores pierden 15-20 min por cliente entrando manualmente al portal de Orange Pangea, copiando datos, línea por línea, pestaña por pestaña
- **Falta de trazabilidad:** Sin CRM, los supervisores no saben qué lead se llamó, cuándo, con qué resultado
- **Asignación ineficiente:** Los leads se reparten en Excel, duplicando esfuerzos y sin equidad
- **Sin inteligencia de datos:** No hay manera de priorizar leads de alto valor (CIMA, Renove) automáticamente
- **Desconexión tecnológica:** Bot de extracción, CRM, telefonía y mensajería están desconectados

### 1.3 Propuesta de Valor

Un sistema unificado que:

1. **Extrae automáticamente** todos los datos de cada cliente desde Orange Pangea (lines, CIMA, Renove, consumo, permanencia)
2. **Distribuye inteligentemente** los leads según jerarquía organizacional (CEO → Jefe → Supervisor → Asesor)
3. **Permite llamar con 1 clic** desde el CRM (Click2Call VPBX)
4. **Prioriza automáticamente** los mejores leads con doble scoring (datos Orange + historial de contacto)
5. **Predice resultados** con forecast de ventas basado en pipeline real
6. **Gestiona múltiples proyectos** bajo una misma plataforma

---

## 2. Usuarios y Personas

### 2.1 Roles del Sistema (7)

| # | Rol | Descripción | Cantidad |
|---|-----|-------------|----------|
| 1 | **Asesor** | Operador telefónico. Llama, tipifica, agenda callbacks. | 8 |
| 2 | **Supervisor** | Gestiona equipo de asesores. Monitorea en vivo, reasigna, analiza rendimiento. | 3 |
| 3 | **Jefe de Área** | Control total de la campaña. Define estrategia, asigna recursos, configura proyectos. | 3 |
| 4 | **Back Office** | Tramitación documental post-venta. Verifica y activa servicios. | 2 |
| 5 | **Auditor de Calidad** | Evalúa llamadas grabadas con rúbrica de 5 criterios. | 0-1 |
| 6 | **IT** | Infraestructura: workers, proxies, máquinas, configuración (todo en Apps). | 1 |
| 7 | **Desarrollador** | Acceso total al sistema. | 2 |

### 2.2 Jerarquía Organizacional

```
CEO / Desarrollador
    │
    └── Jefe de Área (asigna leads a supervisores)
            │
            └── Supervisor (asigna leads a asesores)
                    │
                    └── Asesor (llama y tipifica)
```

### 2.3 Historias de Usuario Principales

**Asesor:**
- "Quiero abrir el Power Dialer y ver toda la info del cliente sin salir de la pantalla"
- "Quiero llamar con un solo clic al número que elijo"
- "Quiero saber si el cliente es CIMA o tiene Renove antes de llamar"
- "Quiero tipificar rápido: 4 botones grandes después de cada llamada"
- "Quiero ver mi agenda de callbacks y que me avise si tengo llamadas pendientes"

**Supervisor:**
- "Quiero ver en vivo qué está haciendo cada asesor de mi equipo"
- "Quiero reasignar leads entre asesores cuando hay desbalance"
- "Quiero ver quién está en pausa y hace cuánto"
- "Quiero saber la tasa de conversión y contactabilidad de mi equipo"

**Jefe de Área:**
- "Quiero asignar X leads a cada supervisor de forma equitativa"
- "Quiero ver el funnel completo: leads totales → asignados → contactados → ventas"
- "Quiero saber cuánto vamos a vender los próximos 7 días (forecast)"
- "Quiero controlar el bot: iniciar, pausar, detener workers"

**IT:**
- "Quiero gestionar proxies, máquinas y credenciales desde la UI"
- "Quiero saber si las máquinas están online y cuántos workers activos tienen"

---

## 3. Funcionalidades (Features)

### 3.1 Extracción Automatizada de Datos (Bot)

| Funcionalidad | Prioridad | Estado |
|---------------|-----------|--------|
| Login automático en Orange Pangea | P0 | ✅ Completado |
| Búsqueda de cliente por DNI/NIE/NIF | P0 | ✅ Completado |
| Extracción de datos de cabecera (nombre, dirección, teléfono) | P0 | ✅ Completado |
| Iteración de todas las líneas del cliente con paginación | P0 | ✅ Completado |
| 5 pestañas por línea: Destacadas, Renove, Bonos, Cambio Tarifa, SVA | P0 | ✅ Completado |
| Detección de CIMA (cliente premium) | P0 | ✅ Completado |
| Detección de Renove (6 tipos de oferta) | P0 | ✅ Completado |
| Estados de línea (Activa, Suspendida, Hotline, etc.) | P0 | ✅ Completado |
| Consumo, permanencia, VAP, facturas | P0 | ✅ Completado |
| Coordinador 24/7 con múltiples workers simultáneos | P0 | ✅ Completado |
| Sistema de rescate de DNIs atascados | P1 | ✅ Completado |
| Heartbeat de workers (cada 30s) | P1 | ✅ Completado |
| Auto-reinicio de workers muertos (máx 5/hora) | P1 | ✅ Completado |
| Liberación automática de leads inactivos (2 AM) | P1 | ✅ Completado |

### 3.2 Pipeline Comercial

| Funcionalidad | Prioridad | Estado |
|---------------|-----------|--------|
| Estados: pendiente → contactado → interesado → negociación → venta | P0 | ✅ Completado |
| Estados de cierre: no_interesa, no_contesta | P0 | ✅ Completado |
| Sub-estados configurables por proyecto (tipificaciones_config) | P0 | ✅ Completado |
| Sistema de rondas (5 rondas máx, cooldown 48h entre rondas) | P0 | ✅ Completado |
| Callbacks programables (agenda con fecha/hora) | P0 | ✅ Completado |
| Intentos por número (tracking de cada llamada) | P1 | ✅ Completado |
| Auto-liberación de leads inactivos | P1 | ✅ Completado |
| Soft delete (RGPD) | P1 | ✅ Completado |
| Leads liberados (devueltos al pool) | P2 | ✅ Completado |

### 3.3 Asignación de Leads

| Funcionalidad | Prioridad | Estado |
|---------------|-----------|--------|
| Asignación jerárquica por chips (CEO→Jefe→Sup→Asesor) | P0 | ✅ Completado |
| Input numérico por subordinado para cantidad exacta | P0 | ✅ Completado |
| Botón "Repartir Igual" (distribución equitativa) | P0 | ✅ Completado |
| Validación: no asignar más de los disponibles | P0 | ✅ Completado |
| Badges de notificación en sidebar: leads sin asignar (rojo) | P0 | ✅ Completado |
| Filtros: CIMA, Renove, fecha desde/hasta | P1 | ✅ Completado |
| Reasignación de leads liberados | P1 | ✅ Completado |

### 3.4 Power Dialer (Discador)

| Funcionalidad | Prioridad | Estado |
|---------------|-----------|--------|
| Tarjeta del lead con nombre, DNI, badges CIMA/Renove/ronda | P0 | ✅ Completado |
| Lista de líneas telefónicas con botón "Llamar" por número | P0 | ✅ Completado |
| Click2Call vía VPBX (1 clic = llamada) | P0 | ✅ Completado |
| Modal de resultado post-llamada: Contactado, No Contesta, Buzón, Equivocado | P0 | ✅ Completado |
| Modal de tipificación con estados y sub-estados | P0 | ✅ Completado |
| Campos dinámicos por proyecto (campos_lead en config JSONB) | P1 | ✅ Completado |
| Agregar número de teléfono durante la llamada | P1 | ✅ Completado |
| Marcar número como contacto principal (⭐) | P1 | ✅ Completado |
| Navegación Anterior/Siguiente entre leads | P1 | ✅ Completado |
| Sistema de pausas: botón ⏸ → modal tipos → pantalla completa bloqueante con timer | P1 | ✅ Completado |
| Envío de WhatsApp con plantillas | P2 | ✅ Completado |

### 3.5 Dashboards por Rol

| Dashboard | Usuarios | Funcionalidades Clave | Estado |
|-----------|----------|-----------------------|--------|
| Asesor | Asesor | Mis Leads con filtros CIMA/Renove, acceso directo al Power Dialer | ✅ |
| Supervisor | Supervisor, Jefe, Dev | LivePanel (estados en vivo), drill-down por asesor, reasignación, tabla rendimiento | ✅ |
| Jefe | Jefe, Dev | Funnel pipeline, comparativa equipos, forecast ventas, salud base, scoring, widgets bot | ✅ |
| Back Office | Back Office | Pendientes/Tramitados, verificación documental, activación | ✅ |
| Admin | IT, Dev | Métricas del sistema, gestión técnica | ✅ |

### 3.6 Páginas de Gestión

| Página | Roles | Funcionalidades | Estado |
|--------|-------|-----------------|--------|
| Clientes | Sup, Jefe, IT, Dev | Tabla maestra 500 registros, filtros, export CSV, expandir fila, FichaCliente modal 360° | ✅ |
| Estadísticas | Sup, Jefe, Dev | KPIs, gráficos actividad, tabla por asesor, export CSV, filtros fecha/equipo | ✅ |
| Fichaje | Asesor, Sup, Jefe, BO, IT, Dev | Fichaje electrónico: botón entrada/salida, historial, vista equipo, offline sync, export CSV | ✅ |
| Metas | Sup, Jefe | Ranking asesores, barras progreso, top performer | ✅ |
| Alertas | Sup, Jefe | Centro de notificaciones: sin asignar, por vencer, máquinas offline | ✅ |
| Auditoría | Sup, Jefe, Dev | Timeline actividad completa, filtros, búsqueda | ✅ |
| Agenda | Asesor, Sup | Callbacks por día (Hoy, Mañana, fechas), vencidos en rojo, botones de estado rápido | ✅ |
| VPBX | Sup, Jefe, Dev, IT | Gestión extensiones + monitoreo agentes en vivo | ✅ |
| Calidad (QA) | Auditor, Sup, Jefe, Dev | Rúbrica 5 criterios, evaluaciones, resumen por asesor | ✅ |
| Usuarios | Jefe, Dev | CRUD usuarios, asignación roles/equipos/supervisor | ✅ |
| Apps | IT, Dev | 4 tabs: Control workers, Proxies, Máquinas, Config | ✅ |
| Proyectos | Jefe, Dev | CRUD multi-proyecto, config JSONB, stats | ✅ |
| Inteligencia | Sup, Jefe, Dev | Scoring doble, forecast, cinturones, reutilización, abandono | ✅ |
| Rendimiento | Sup, Jefe, Dev | Ranking, cinturones, tendencias, heatmap, ocupación | ✅ |
| Wikiratioo | Todos | Base de conocimiento, artículos, guías | ✅ |
| Perfil | Todos | Datos personales, cambiar contraseña | ✅ |
| Documentos | Sup, Jefe, IT, Dev | Upload lotes, cola procesamiento | ✅ |

### 3.7 Inteligencia Comercial

| Funcionalidad | Descripción | Estado |
|---------------|-------------|--------|
| Scoring Orange | 14 factores: CIMA, Renove, TV, permanencia, WhatsApp, estados línea, etc. Niveles A+ a E | ✅ |
| Scoring Contacto (Yone) | Basado en historial de contacto + compras. Recurrente, decisor, efectividad | ✅ |
| Forecast Ventas | Predicción 7 días: leads × contactabilidad × efectividad con intervalos confianza | ✅ |
| Cinturones | 4 niveles gamificación: Blanco, Azul, Marrón, Faixa Preta con criterios | ✅ |
| Notificaciones Supervisor | 7 tipos: bajo rendimiento, sin actividad, excede no_interesa, sin ventas, recuperación, cinturón, caída | ✅ |
| Métricas Abandono | Robinson, no contesta, no interesa, fallecidos | ✅ |
| Tasa Reutilización | Cada cuánto se reanalizan los registros | ✅ |
| Reportes | HTML imprimible: completo, rendimiento, ventas, scoring | ✅ |

### 3.8 Multi-Proyecto

| Funcionalidad | Estado |
|---------------|--------|
| Proyectos independientes con datos aislados por proyecto_id | ✅ |
| Config JSONB por proyecto (logo_url, campos_lead, metas, cooldown) | ✅ |
| Campos dinámicos en Power Dialer según proyecto activo | ✅ |
| Codificaciones de tipificación por proyecto | ✅ |
| APIs filtradas por proyecto_id | ✅ |
| Selector de proyecto en sidebar | ✅ |
| Proyecto activo: solo Orange | ✅ |

---

## 4. Requisitos No Funcionales

### 4.1 Rendimiento

- Tiempo de carga de página: < 2 segundos
- Extracción bot por DNI: < 40 segundos (watchdog)
- Click2Call: < 3 segundos desde clic hasta que suena
- Pool DB: 20 conexiones máximo
- Workers simultáneos por máquina: hasta 20

### 4.2 Seguridad

- Autenticación: NextAuth.js v5 con JWT (8h expiración)
- Contraseñas: bcrypt 10 rondas, mínimo 8 chars + 1 mayúscula + 1 número
- Autorización: RBAC de 2 capas (middleware rutas + API endpoints)
- SQL Injection: 100% queries parametrizadas
- Bot API: protegida con x-bot-api-key
- Soft delete para cumplimiento RGPD
- Rate limiting: Click2Call 3s entre llamadas

### 4.3 Disponibilidad

- Bot: 24/7 con auto-recuperación de workers
- CRM: alta disponibilidad en VPS Hetzner
- Fallback sin Redis: todo funciona en memoria si Redis no está configurado

### 4.4 Escalabilidad

- PostgreSQL soporta millones de registros
- Multi-máquina: workers distribuidos en varias PCs/VPS
- Arquitectura API-first: frontend y bot desacoplados

---

## 5. Alcance y Límites

### 5.1 Incluido (v5.3)

- Todo lo listado en la sección 3 con estado "✅ Completado"
- 20 páginas frontend
- 59 endpoints API
- 30 tablas PostgreSQL
- Bot Python con coordinator + workers
- Integración VPBX y WhatsApp
- Dashboard multi-rol
- Inteligencia comercial
- Sidebar v2 con acordeón y badges

### 5.2 Fuera de Alcance (v5.3)

- Proyecto Repsol — venta de luz y gas (futuro)
- Bot de voz IA con WebSocket (futuro)
- Integración SICA (futuro)
- Email/SMTP (futuro)
- App móvil nativa
- Modo offline

### 5.3 Próxima Fase: Planillas y Contratos (P1)

Gestión de contratos laborales y generación de planillas desde los fichajes existentes.

| Funcionalidad | Base existente | Qué falta |
|---------------|----------------|-----------|
| Contratos laborales | `documentos` (upload), `usuarios` (empleados) | Tabla `contratos` + página de gestión |
| Planillas / nóminas | `fichajes` (horas), `pausas` (descuentos), `usuarios` (salario) | Tabla `planillas` + cálculo automático |
| Datos del empleado | `usuarios` (nombre, email, equipo, rol) | Tabla `empleados` (SS, categoría, IBAN, tipo contrato) |
| Export para contabilidad | Export CSV existente (patrón) | PDF/CSV con formato de nómina |

**Estimación:** 40h | **Prioridad:** P1 (siguiente tras deploy)

### 5.4 Proyecto Futuro Planificado

| Proyecto | Tipo | Descripción | Prioridad |
|----------|------|-------------|-----------|
| Repsol | Utilities | Venta de luz y gas | P2 |

---

## 5.3 Cumplimiento Normativo — Fichaje Electrónico (España)

### Marco Legal

| Normativa | Objeto | Fecha |
|-----------|--------|-------|
| **RD-ley 8/2019** (art. 34.9 ET) | Registro diario obligatorio de jornada | 12 Mar 2019 |
| **Ley 10/2021** | Trabajo a distancia: registro debe distinguir presencial/remoto | 9 Jul 2021 |
| **RD-ley 2/2024** | Refuerzo: sanciones por incumplimiento | 2024 |

### Checklist de Cumplimiento

| # | Requisito Legal | Norma | ¿Cumple? | Evidencia |
|---|----------------|-------|:---:|-----------|
| 1 | Registro diario de inicio y fin de jornada | RD-ley 8/2019 | ✅ | Tabla `fichajes` con `entrada`/`salida` + timestamp |
| 2 | Horario concreto (hora y minuto) | RD-ley 8/2019 | ✅ | `TIMESTAMPTZ` con precisión de milisegundos |
| 3 | Pausas e interrupciones registradas | RD-ley 8/2019 | ✅ | Tabla `pausas` existente, cruzada en reportes diarios |
| 4 | Total de horas trabajadas al día | RD-ley 8/2019 | ✅ | Cálculo automático: salida − entrada − pausas |
| 5 | Conservación de registros 4 años | RD-ley 8/2019 | ✅ | Sin DELETE automático; soft delete preserva datos |
| 6 | Acceso del trabajador a su propio registro | RD-ley 8/2019 | ✅ | Página `/fichaje` — historial personal completo |
| 7 | Disponible para Inspección de Trabajo | RD-ley 8/2019 | ✅ | Export CSV con BOM UTF-8, punto y coma, formato español |
| 8 | A disposición de representantes legales | RD-ley 8/2019 | ✅ | Supervisor/Jefe/BO/Dev/IT acceden a vista equipo + export |
| 9 | Distinguir trabajo presencial del remoto | Ley 10/2021 | ✅ | Columna `modalidad` (presencial/remoto) en cada fichaje |
| 10 | Registro manual por el supervisor en contingencias | RD-ley 8/2019 | ✅ | Endpoint con `target_user_id` + `motivo` obligatorio + trazabilidad |
| 11 | Respetar zona horaria local del trabajador | Implícito | ✅ | Frontend calcula inicio/fin del día en hora local del navegador |
| 12 | Funcionamiento offline si el sistema falla | Mejor práctica | ✅ | localStorage sync automático al reconectar |
| 13 | Sanciones por incumplimiento: hasta €7,500/empleado | RD-ley 2/2024 | ✅ | Sistema mitiga riesgo al cumplir todos los puntos anteriores |

### Lo que NO cubre (y no es obligatorio en el registro de jornada)

| Concepto | ¿Obligatorio? | Estado |
|----------|:---:|--------|
| Envío automático a Inspección (no existe API gubernamental) | ❌ | No aplica |
| Integración con software de nóminas | ❌ | No obligatorio; posible feature futura |
| PDF firmado digitalmente | ❌ | No obligatorio; CSV basta |
| Fichaje biométrico (huella, facial) | ❌ | No obligatorio; requiere consentimiento expreso |
| Registro de horas extra (corresponde a nóminas, no al fichaje) | ❌ | Se puede añadir como campo adicional |
| Geocalización del fichaje | ❌ | No obligatorio |

---

## 6. Métricas de Éxito (KPIs del Producto)

| Métrica | Objetivo |
|---------|----------|
| Leads extraídos por día | > 200 |
| Tiempo medio de extracción por DNI | < 30s |
| Contactabilidad | > 35% |
| Tasa de conversión (contactado → venta) | > 8% |
| Tiempo medio de tipificación | < 15s |
| Leads asignados correctamente | 100% |
| Uptime del bot | > 99% |
| Satisfacción del asesor (cualitativo) | "El Power Dialer me ahorra 2h/día" |

---

## 7. Glosario

| Término | Definición |
|---------|------------|
| **CIMA** | Cliente premium de Orange (alta valoración comercial) |
| **Renove** | Oferta de renovación que Orange hace al cliente |
| **Pipeline** | Flujo de estados del lead: pendiente → contactado → interesado → negociación → venta |
| **Power Dialer** | Discador: interfaz donde el asesor ve el lead y llama con 1 clic |
| **Click2Call** | Llamada iniciada desde el CRM: VPBX llama al asesor, al descolgar marca al cliente |
| **VPBX** | Centralita telefónica virtual (Siptize) |
| **CDR** | Call Detail Record: registro completo de una llamada |
| **Wrap-up** | Tiempo post-llamada para tipificar |
| **Ronda** | Ciclo completo de llamadas a todos los números de un lead |
| **Cooldown** | Tiempo mínimo entre rondas (48h) |
| **Forecast** | Predicción de ventas futuras basada en pipeline |
| **Scoring** | Puntuación automática de calidad del lead (A+ a E) |
| **Cinturón** | Nivel de gamificación del asesor (Blanco → Faixa Preta) |
