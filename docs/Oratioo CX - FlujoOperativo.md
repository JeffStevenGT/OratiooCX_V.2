# Oratioo CX — Flujo Operativo Completo

> Documento de procesos de negocio. Describe el ciclo de vida completo de un lead, desde su entrada al sistema hasta su cierre como venta o descarte.

---

## 1. Diagrama General del Flujo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ENTRADA DE LEADS                                      │
│                                                                             │
│  ┌──────────────────────┐          ┌──────────────────────────┐            │
│  │    BOT PYTHON         │          │    CARGA MANUAL           │            │
│  │  (Orange Pangea)      │          │  (Documentos > Upload)    │            │
│  │                      │          │                          │            │
│  │  1. Login Orange     │          │  1. Subir CSV/Excel       │            │
│  │  2. Buscar DNI       │          │  2. Deduplicacion auto    │            │
│  │  3. Extraer lineas   │          │  3. Validacion formato    │            │
│  │  4. Detectar CIMA    │          │  4. Cruzar listas negras  │            │
│  │  5. Detectar Renove  │          │  5. Clasificar DNIs       │            │
│  │  6. Estados de linea │          │                          │            │
│  │  7. Consumo/perman.  │          │                          │            │
│  │  8. Campanas extras  │          │                          │            │
│  └──────────┬───────────┘          └────────────┬─────────────┘            │
│             │                                   │                          │
│             ▼                                   ▼                          │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │              VALIDACION Y CALIDAD AUTOMATICA                      │     │
│  │                                                                  │     │
│  │  • Deduplicacion por DNI y por telefono cruzado                  │     │
│  │  • Validacion de formato de telefono (+34, 9 digitos)            │     │
│  │  • Cruce contra listas_negras (Robinson, no_llamar, fallecidos)  │     │
│  │  • Clasificacion: nuevo, ignorar_activo, ignorar_cooldown,       │     │
│  │    ignorar_reciente, reabrir                                     │     │
│  │  • Deteccion de cambios vs extraccion anterior (15 tipos)        │     │
│  └──────────────────────────────┬───────────────────────────────────┘     │
│                                 │                                         │
│                                 ▼                                         │
│                    ┌─────────────────────────┐                            │
│                    │   POOL DE LEADS          │                            │
│                    │   (Sin asignar)          │                            │
│                    │                         │                            │
│                    │   Visible en:            │                            │
│                    │   Jefe > Asignar Leads   │                            │
│                    └────────────┬────────────┘                            │
└─────────────────────────────────┼──────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ASIGNACION DE LEADS                                   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  JEFE DE AREA (Pagina: Asignar Leads)                               │   │
│  │                                                                     │   │
│  │  1. Selecciona filtros: CIMA=SI, Renove=SI, fecha desde-hasta      │   │
│  │  2. Ve contador: "152 clientes disponibles"                         │   │
│  │  3. Elige cantidad: 50 leads                                       │   │
│  │  4. Selecciona equipo: Peru / Espana                                │   │
│  │  5. Click: "Seleccionar y Repartir"                                 │   │
│  │                                                                     │   │
│  │  El sistema hace round-robin:                                       │   │
│  │    Lead 1 → Ana   Lead 2 → Luis   Lead 3 → Carmen                   │   │
│  │    Lead 4 → Ana   Lead 5 → Luis   Lead 6 → Carmen                   │   │
│  │                                                                     │   │
│  │  Cada asignacion:                                                   │   │
│  │    • INSERT en pipeline (estado=pendiente, asesor_id=X)             │   │
│  │    • INSERT en historial (tipo=asignacion)                          │   │
│  │    • Notificacion: badge en sidebar del asesor                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                 │                                           │
│                                 ▼                                           │
│                    ┌─────────────────────────┐                              │
│                    │   LEADS ASIGNADOS        │                              │
│                    │   (Estado: pendiente)    │                              │
│                    │                         │                              │
│                    │   Visible en:            │                              │
│                    │   Asesor > Dashboard     │                              │
│                    │   Power Dialer           │                              │
│                    └────────────┬────────────┘                              │
└─────────────────────────────────┼──────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CICLO DE LLAMADA (POWER DIALER)                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ASESOR (Pagina: Power Dialer)                                      │   │
│  │                                                                     │   │
│  │  1. Abre Power Dialer → ve primer lead asignado                     │   │
│  │  2. Ve info del cliente:                                            │   │
│  │     • Nombre, DNI, Paquete                                          │   │
│  │     • CIMA: SI/NO, Renove: SI/NO, Ronda actual: 2/5                │   │
│  │     • Lineas del cliente con botones de llamada                     │   │
│  │     • Estados de linea (Hotline, Suspendida, etc.)                  │   │
│  │     • Consumo, permanencia, VAP                                     │   │
│  │     • Campanas comerciales disponibles                              │   │
│  │  3. Click en boton "Llamar" junto al numero                         │   │
│  │                                                                     │   │
│  │  FLUJO TECNICO:                                                     │   │
│  │  Frontend → POST /api/vpbx/originate {from:ext, to:numero, dni}     │   │
│  │  API → VPBX: GET /originatecall/101/622534699                       │   │
│  │  VPBX → Suena telefono del asesor (extension 101)                   │   │
│  │  Asesor descuelga → VPBX marca al cliente                           │   │
│  │  VPBX → Webhook RINGING → POST /api/webhooks/vpbx                   │   │
│  │  CRM → INSERT en cdr_vpbx (call_id, src, dst)                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                 │                                           │
│                    ┌────────────┴────────────┐                              │
│                    ▼                         ▼                              │
│            ┌──────────────┐          ┌──────────────┐                       │
│            │   CONTESTA    │          │  NO CONTESTA  │                       │
│            │  (ANSWERED)   │          │  (HANGUP)     │                       │
│            └──────┬────────┘          └──────┬────────┘                       │
│                   │                         │                                │
│                   ▼                         ▼                                │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐           │
│  │ VPBX → Webhook ANSWERED    │  │ VPBX → Webhook HANGUP       │           │
│  │ CRM → Buscar cliente por   │  │ CRM → sin cliente vinculado │           │
│  │       callerNumber en      │  │        Guardar en cdr_vpbx  │           │
│  │       telefonos_v2         │  │                             │           │
│  │ CRM → Vincular id_cliente  │  │                             │           │
│  │ CRM → Registrar en         │  │                             │           │
│  │       historial            │  │                             │           │
│  └─────────────┬───────────────┘  └──────────────┬──────────────┘           │
│                │                                  │                          │
│                ▼                                  ▼                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   RESULTADO DE LLAMADA                               │   │
│  │                                                                     │   │
│  │  El asesor ve un modal con 4 opciones:                              │   │
│  │                                                                     │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │   │
│  │  │ CONTACTADO │  │NO CONTESTA │  │   BUZON    │  │ EQUIVOCADO │    │   │
│  │  │  (verde)   │  │  (rojo)    │  │  (gris)    │  │  (ambar)   │    │   │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘    │   │
│  │        │               │               │               │           │   │
│  │        ▼               ▼               ▼               ▼           │   │
│  │   Pipeline:        Pipeline:       Pipeline:       Pipeline:       │   │
│  │   contactado       no_contesta     pendiente       pendiente       │   │
│  │                    (con callback)  (misma ronda)   (misma ronda)   │   │
│  │   Se abre          No cuenta       Se puede        Se puede        │   │
│  │   modal de         como ronda      llamar al       llamar al       │   │
│  │   TIPIFICACION     nueva           sig. numero     sig. numero     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     TIPIFICACION (POST-LLAMADA)                              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ESTADOS PRINCIPALES (desde tipificaciones_config, dinamicos)       │   │
│  │                                                                     │   │
│  │  ┌──────────┐ ┌───────────┐ ┌───────┐ ┌──────────┐ ┌───────────┐  │   │
│  │  │INTERESADO│ │NEGOCIACION│ │ VENTA │ │NO INTERES│ │NO CONTESTA│  │   │
│  │  │ (azul)   │ │ (purpura) │ │(verde)│ │  (rojo)  │ │  (ambar)  │  │   │
│  │  └──────────┘ └───────────┘ └───┬───┘ └────┬─────┘ └─────┬─────┘  │   │
│  │                                 │          │             │         │   │
│  │                                 ▼          ▼             ▼         │   │
│  │                           ┌─────────────────────────────────────┐  │   │
│  │                           │     SUB-ESTADOS (dinamicos)         │  │   │
│  │                           │                                     │  │   │
│  │                           │ Para "No Interesa":                 │  │   │
│  │                           │   • Proceso de Portabilidad         │  │   │
│  │                           │     → campo: fin_permanencia        │  │   │
│  │                           │                                     │  │   │
│  │                           │ Para "No Contesta":                 │  │   │
│  │                           │   • Volver a Llamar                 │  │   │
│  │                           │     → campo: callback_at            │  │   │
│  │                           │                                     │  │   │
│  │                           │ Generales:                          │  │   │
│  │                           │   • Agrego otro numero               │  │   │
│  │                           │   • Confirmo su numero              │  │   │
│  │                           │   • No llamar mas (→ lista negra)   │  │   │
│  │                           │   • Cliente fallecido (→ lista negra)│  │   │
│  │                           │   • Empresa cerrada (→ lista negra) │  │   │
│  │                           │   • Fuera de cobertura               │  │   │
│  │                           │   • Ya es cliente                   │  │   │
│  │                           └─────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Si sub_estado tiene afecta_calidad=true → TRIGGER PostgreSQL:              │
│    INSERT automatico en listas_negras (telefono, motivo, id_cliente)        │
│    El lead NUNCA mas sera asignado                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CICLO DE VIDA DEL PIPELINE                               │
│                                                                             │
│  ┌──────────┐    ┌───────────┐    ┌───────────┐    ┌──────────┐            │
│  │PENDIENTE │───→│CONTACTADO │───→│INTERESADO │───→│NEGOCIACION│           │
│  └──────────┘    └───────────┘    └───────────┘    └─────┬────┘            │
│       │                                                   │                │
│       │                                                   ▼                │
│       │             ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│       │             │NO INTERES│    │NO CONTEST│    │  VENTA   │          │
│       │             └────┬─────┘    └────┬─────┘    └────┬─────┘          │
│       │                  │              │                │                 │
│       │                  ▼              ▼                ▼                 │
│       │           ┌────────────┐ ┌────────────┐  ┌──────────────┐        │
│       │           │ANALISIS    │ │CALLBACK    │  │BACK OFFICE   │        │
│       │           │PERDIDOS    │ │AUTOMATICO  │  │(Tramitacion) │        │
│       │           └────────────┘ └─────┬──────┘  └──────┬───────┘        │
│       │                                │                │                 │
│       │                                ▼                ▼                 │
│       │                         ┌────────────┐  ┌──────────────┐        │
│       │                         │Vuelve a    │  │ACTIVADO      │        │
│       │                         │PENDIENTE   │  │(Cliente      │        │
│       │                         │(auto)      │  │activo en     │        │
│       │                         └────────────┘  │Orange)       │        │
│       │                                         └──────────────┘        │
│       │                                                                   │
│       ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                  SISTEMA DE RONDAS                               │    │
│  │                                                                  │    │
│  │  Ronda 1: asesor llama a todos los numeros del lead              │    │
│  │          (622, 911, 965) → 3 llamadas = 1 ronda                  │    │
│  │                                                                  │    │
│  │  ⏳ Cooldown 48h                                                  │    │
│  │                                                                  │    │
│  │  Ronda 2: asesor vuelve a intentar                               │    │
│  │          ...                                                      │    │
│  │                                                                  │    │
│  │  Ronda 5: si todas fallaron → CIERRE AUTOMATICO                  │    │
│  │           → INSERT en analisis_perdidos                           │    │
│  │           → estado = no_contesta                                  │    │
│  │                                                                  │    │
│  │  Liberacion automatica (CRON 2AM):                                │    │
│  │    • Reactiva leads con callback_at vencido                       │    │
│  │    • Cierra leads con 5+ rondas fallidas                          │    │
│  │    • Libera leads nunca contactados tras N dias                   │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘

---

## 2. Flujo de WhatsApp

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUJO WHATSAPP (META CLOUD API)                        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    CONFIGURACION INICIAL                         │   │
│  │                                                                 │   │
│  │  1. Admin crea app en Meta Developers                           │   │
│  │  2. Verifica numero de telefono de la empresa                    │   │
│  │  3. Configura webhook: {URL_CRM}/api/webhooks/whatsapp          │   │
│  │  4. Obtiene token de acceso permanente                          │   │
│  │  5. Crea plantillas en Meta (aprobadas)                         │   │
│  │  6. Configura plantillas en CRM > Config > Plantillas WhatsApp  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    ENVIO DE WHATSAPP                             │   │
│  │                                                                 │   │
│  │  Power Dialer → Boton WhatsApp (icono verde)                    │   │
│  │       │                                                         │   │
│  │       ▼                                                         │   │
│  │  Seleccionar plantilla (solo plantillas, sin texto libre)       │   │
│  │       │                                                         │   │
│  │       ▼                                                         │   │
│  │  POST /api/whatsapp/send {to, template, params}                 │   │
│  │       │                                                         │   │
│  │       ▼                                                         │   │
│  │  Verificacion: cliente.whatsapp_opt_in === true                 │   │
│  │       │                                                         │   │
│  │       ├── SI → Meta Cloud API → entrega al cliente              │   │
│  │       │         → Guardar en whatsapp_mensajes (saliente)       │   │
│  │       │                                                        │   │
│  │       └── NO → Error: cliente no dio consentimiento             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    RECEPCION DE WHATSAPP                         │   │
│  │                                                                 │   │
│  │  Cliente envia mensaje al numero de la empresa                   │   │
│  │       │                                                         │   │
│  │       ▼                                                         │   │
│  │  Meta → POST /api/webhooks/whatsapp (JSON)                      │   │
│  │       │                                                         │   │
│  │       ▼                                                         │   │
│  │  parseIncoming() → extraer from, text, timestamp                │   │
│  │       │                                                         │   │
│  │       ▼                                                         │   │
│  │  Buscar cliente por telefono en CRM (telefonos + telefonos_v2)  │   │
│  │       │                                                         │   │
│  │       ├── Encontrado → Guardar en whatsapp_mensajes (entrante)  │   │
│  │       │                → Vincular al pipeline del cliente       │   │
│  │       │                                                        │   │
│  │       └── No encontrado → Guardar como contacto desconocido     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    RENOVE AUTOMATICO                             │   │
│  │                                                                 │   │
│  │  Bot extrae datos → detecta Renove en alguna linea               │   │
│  │       │                                                         │   │
│  │       ▼                                                         │   │
│  │  Backend verifica:                                               │   │
│  │    • cliente.whatsapp_opt_in === true                            │   │
│  │    • cliente.whatsapp_numero !== null                            │   │
│  │    • Renove es nuevo (no estaba en extraccion anterior)          │   │
│  │       │                                                         │   │
│  │       └── SI → Enviar plantilla "Info Renove" automaticamente   │   │
│  │                → Registrar envio en historial                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Flujo de Re-analisis (Motor de Re-extraccion)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CICLO DE RE-ANALISIS                                   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  El bot procesa TODOS los DNIs en cola, no solo los nuevos       │   │
│  │                                                                 │   │
│  │  1. Coordinator lanza workers                                   │   │
│  │  2. Worker: GET /api/bot/next-dni → siguiente DNI pendiente      │   │
│  │  3. Worker: extrae datos actualizados de Orange                  │   │
│  │  4. Worker: POST /api/internal/bot-sync → guarda datos          │   │
│  │                                                                 │   │
│  │  En bot-sync:                                                    │   │
│  │    • UPSERT en clientes_proyectos.datos                          │   │
│  │    • detectarCambios() compara vs extraccion anterior            │   │
│  │    • Si hay cambios → INSERT en detecciones                      │   │
│  │    • Si nuevo Renove → disparar WhatsApp (si opt-in)             │   │
│  │    • Si nueva CIMA → priorizar en scoring                        │   │
│  │    • Si cambio de permanencia → actualizar pipeline              │   │
│  │                                                                 │   │
│  │  El estado vuelve a "pendiente" para futuras re-extracciones     │   │
│  │  (reset manual via API o automatico cada N dias)                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Tasa de reutilizacion = AVG(dias entre extracciones del mismo lead)    │
│  Si es < 7 dias: base fresca. Si > 30 dias: base estancada.            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Flujo de Calidad y Supervision

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MONITOREO Y CALIDAD                                    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    SUPERVISOR                                    │   │
│  │                                                                 │   │
│  │  Dashboard Supervisor:                                          │   │
│  │    • LivePanel: estados en vivo de asesores (desde VPBX)        │   │
│  │    • Tabla de rendimiento: pendientes, contactados, QA          │   │
│  │    • Drill-down: ver leads de cualquier asesor                   │   │
│  │    • Reasignar: mover leads entre asesores                      │   │
│  │                                                                 │   │
│  │  Estadisticas:                                                  │   │
│  │    • KPIs: contactabilidad, conversion, tiempos                 │   │
│  │    • Graficos: actividad por dia, por franja horaria            │   │
│  │    • Tabla por asesor con % exito                                │   │
│  │    • Export CSV                                                 │   │
│  │                                                                 │   │
│  │  Alertas:                                                       │   │
│  │    • Leads sin asignar                                          │   │
│  │    • Leads por vencer (callback vencido)                        │   │
│  │    • Maquinas offline                                           │   │
│  │    • Base agotandose (< 50 pendientes)                          │   │
│  │                                                                 │   │
│  │  Config > Codificaciones:                                       │   │
│  │    • Agregar/quitar estados y sub-estados                       │   │
│  │    • Marcar cuales afectan calidad (van a lista negra)          │   │
│  │    • Cambiar colores y etiquetas                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    AUDITOR DE CALIDAD (QA)                       │   │
│  │                                                                 │   │
│  │  Dashboard Calidad:                                             │   │
│  │    • Seleccionar asesor a evaluar                               │   │
│  │    • Escuchar grabacion de llamada (desde VPBX)                 │   │
│  │    • Evaluar con rubrica 5 criterios (1-5 estrellas):           │   │
│  │       1. Speech: claridad, tono, profesionalismo                │   │
│  │       2. Objeciones: manejo, argumentacion                      │   │
│  │       3. Cierre: tecnica, concrecion                             │   │
│  │       4. Compliance: normativa, RGPD, guiones                   │   │
│  │       5. Empatia: escucha activa, adaptacion                    │   │
│  │    • Puntaje total automatico: suma / 25                        │   │
│  │    • Visible en dashboard supervisor y jefe                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    JEFE DE AREA                                  │   │
│  │                                                                 │   │
│  │  Dashboard Jefe:                                                │   │
│  │    • Pipeline Funnel: completados → sin asignar → ventas        │   │
│  │    • Comparativa por equipo                                     │   │
│  │    • Salud de base: porcentaje de registros limpios             │   │
│  │    • Tasa de conversion global                                  │   │
│  │    • Estado del bot: workers, cola, proxies                     │   │
│  │    • Parametros operativos (editables, desde BD)                │   │
│  │                                                                 │   │
│  │  Infraestructura > Listas Negras (descargar CSV):               │   │
│  │    • Filtrar por motivo: Robinson, no_llamar, fallecidos...     │   │
│  │    • Descargar reporte para auditoria externa                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Ciclo de Vida Completo de un Lead — Ejemplo Real

```
DIA 1 — ENTRADA
  Bot extrae DNI 75238036E de Orange
  Datos: ROCIO MARTINEZ, Love Empresa Smart, 2 lineas
  CIMA: SI, Renove: Renove mixto max descuento
  → clientes_proyectos.datos guardado
  → detectarCambios: 2 linea_nueva (primera extraccion)
  → Estado: completado

DIA 1 — ASIGNACION
  Jefe ve 152 leads disponibles en pool
  Selecciona 50, equipo Peru, round-robin
  → DNI 75238036E asignado a Ana Asesora Peru
  → pipeline: estado=pendiente, asesor_id=Ana, ronda_actual=1

DIA 2 — PRIMERA LLAMADA
  Ana abre Power Dialer, ve a ROCIO
  Click en "Llamar" → suena su telefono
  Contesta → conversacion de 4 minutos
  Ana tipifica: INTERESADO, notas "Quiere fibra, tiene permanencia hasta 2028"
  → pipeline: estado=interesado

DIA 3 — SEGUNDA LLAMADA
  Ana vuelve a llamar (ya paso cooldown 48h? NO → no puede)
  Espera...

DIA 5 — SEGUNDA RONDA
  (pasaron 48h → ronda_actual sube a 2)
  Ana llama de nuevo
  Cliente: "Estoy de viaje, llamame en 1 semana"
  Ana tipifica: NO CONTESTA, sub_estado=volver_a_llamar, callback_at=12/06/2026
  → pipeline: estado=no_contesta, callback_at=2026-06-12

DIA 12 — CALLBACK AUTOMATICO
  CRON 2AM detecta callback_at vencido
  → pipeline: estado=pendiente (reactivado automaticamente)
  Ana ve el lead de nuevo en su dashboard

DIA 12 — TERCERA RONDA
  Ana llama, cliente interesado pero quiere pensarlo
  Ana envia WhatsApp con plantilla "Seguimiento"
  → whatsapp_mensajes: saliente, template=seguimiento

DIA 15 — CUARTA RONDA
  Ana llama → ¡VENTA! Contrata fibra + 2 moviles
  Ana tipifica: VENTA
  → pipeline: estado=venta
  → Back Office notificado

DIA 16 — TRAMITACION
  Back Office verifica documentos
  Click en "Activar"
  → pipeline: estado=activado
  → Cliente activo en Orange
  → Comision para Ana registrada

RESULTADO: Lead procesado en 15 dias, 4 rondas, 1 venta.
```

---

## 6. Panel de Control del Bot

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTROL DE BOTS                                │
│                                                                 │
│  Jefe/Supervisor > Bots:                                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Maquina: [localhost ▾]  Workers: [5]                    │   │
│  │                                                         │   │
│  │  [▶ Iniciar]  [⏸ Pausar]  [⏹ Detener]                   │   │
│  │                                                         │   │
│  │  Estado: 5 workers activos en localhost                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Frontend → POST /api/bot/command {comando:iniciar, workers:5}  │
│  → INSERT en comandos_bot (estado=pendiente)                    │
│                                                                 │
│  Coordinator (poll cada 5s):                                    │
│  → GET /api/bot/command?maquina=localhost                       │
│  → Recibe comando "iniciar"                                     │
│  → spawn_workers(5)                                             │
│  → Cada worker: Playwright + proxy + login Orange                │
│  → Comienza a procesar DNIs                                     │
│                                                                 │
│  Heartbeat cada 30s:                                            │
│  → PATCH /api/maquinas {workers_activos: 5}                     │
│  → Visible en dashboard Jefe: "5 workers activos"              │
└─────────────────────────────────────────────────────────────────┘
```
