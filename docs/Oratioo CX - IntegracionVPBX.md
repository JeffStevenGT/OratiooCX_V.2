# Oratioo CX — Integracion VPBX (Siptize)

> Documento tecnico-operativo completo de la integracion con la centralita VoIP
> Plataforma: VPBX (Siptize) | API Base: https://vpbx.me/api | Documentacion: https://doc.vpbx.me/admin/
> Estado: 15 endpoints implementados, pagina de gestion VPBX, libreria completa, pendiente API key para activacion

---

## 1. Arquitectura de Integracion

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         VPBX (SIPTIZE)                                         │
│                                                                              │
│  Es una centralita VoIP en la nube que proporciona:                          │
│  • Extensiones SIP para cada asesor (101, 102, 103...)                       │
│  • Numeros publicos para recibir llamadas entrantes                          │
│  • Click2Call: el CRM inicia llamadas salientes                              │
│  • Webhooks: notifica eventos de llamada en tiempo real                      │
│  • CDR: registro historico de todas las llamadas                             │
│  • Grabaciones: audio MP3 de cada llamada                                    │
│  • Colas: gestion de llamadas entrantes en espera                            │
│  • Agentes: estado en tiempo real de cada extension                          │
│  • TTS: voces Amazon Polly para locuciones                                   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    INTEGRACION CRM ↔ VPBX                             │    │
│  │                                                                     │    │
│  │  CRM → VPBX (llamadas salientes):                                   │    │
│  │    POST /api/vpbx/originate  →  VPBX GET /originatecall/101/numero  │    │
│  │                                                                     │    │
│  │  VPBX → CRM (eventos de llamada):                                   │    │
│  │    VPBX webhook  →  POST /api/webhooks/vpbx                         │    │
│  │    (RINGING, ANSWERED, HANGUP)                                       │    │
│  │                                                                     │    │
│  │  CRM → VPBX (consulta de datos):                                    │    │
│  │    GET /api/vpbx/agents  →  VPBX GET /agent                         │    │
│  │    GET /api/vpbx/cdr/... →  VPBX POST /cdr                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Configuracion Inicial

### Paso 1: Obtener API Key

1. El administrador de VPBX genera una API Key en el panel de administracion
2. Seccion: Configuracion > Claves API
3. Permisos necesarios:
   - Generar llamadas (Click2Call)
   - Acceso a registros de llamadas (CDR)
   - Obtener grabaciones
   - Acceso a agentes y extensiones
4. Guardar en `.env`:
```
VPBX_API_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx
VPBX_API_URL=https://vpbx.me/api
```

### Paso 2: Configurar Webhook en VPBX

1. En el panel de VPBX, seccion Eventos > Notificacion de eventos
2. Configurar URL: `https://tudominio.com/api/webhooks/vpbx`
3. La URL debe ser accesible publicamente (no localhost)
4. Para desarrollo: usar ngrok `ngrok http 3000` → URL temporal
5. VPBX enviara eventos POST a esta URL por cada llamada

### Paso 3: Asignar Extensiones a Usuarios

1. En el panel de VPBX, crear extensiones para cada asesor (101, 102, 103...)
2. En el CRM, ir a la pagina **VPBX** (seccion Administracion del sidebar)
3. Disponible para: supervisor, jefe_area, desarrollador, it
4. La pagina VPBX ofrece dos tabs:
   - **Extensiones**: tabla con todas las extensiones de la VPBX + operador asignado. Permite asignar, cambiar o desasignar operadores con un selector desplegable. Busca extensiones por numero o nombre de operador.
   - **Agentes**: monitoreo en vivo del estado de cada agente (Disponible, En llamada, Pausa, Offline) con tarjetas resumen y codigo de colores. Cruza automaticamente con los operadores asignados del CRM.
5. Cada usuario tiene campo `extension_vpbx` con su numero de extension
6. El LivePanel cruza usuarios del CRM con agentes de VPBX por este campo
7. Gestion desde: API `PATCH /api/usuarios {id, extension_vpbx}` o desde la UI de VPBX

---

## 3. Libreria de Integracion (`src/lib/vpbx.ts`)

### 14 Funciones Implementadas

```typescript
// ═══════════════════════════════════════════
// LLAMADAS SALIENTES (Click2Call)
// ═══════════════════════════════════════════

// Llamar desde extension a numero externo
originateCall(from: string, to: string, timeout?: number)
  → GET /originatecall/{from}/{to}?timeout=30

// Llamar desde numero externo a destino interno
originateExternal(from: string, to: string)
  → GET /c2cexternal/{from}/{to}

// ═══════════════════════════════════════════
// REGISTROS DE LLAMADAS (CDR)
// ═══════════════════════════════════════════

// Consultar una llamada especifica
getCallDetail(callId: string) → GET /cdr/{callId}

// Listar llamadas con filtros (fecha, origen, destino, paginacion)
listCalls(filters) → POST /cdr

// Contar llamadas (para paginacion)
countCalls(filters) → POST /cdrcount

// Relacionar callId temporal de Click2Call con CDR real
getCdrFromC2c(callId: string) → GET /cdrc2c/{callId}

// Escribir datos del CRM en el CDR de VPBX (vinculacion bidireccional)
updateCallVars(callId, {var1, vaVPBX (almacena 1 a�o nativo), var3, var4, var5})
  → POST /cdr/{callId}/updatevars

// ═══════════════════════════════════════════
// AGENTES Y ESTADOS
// ═══════════════════════════════════════════

// Listar agentes con su estado actual
listAgents() → GET /agent
  // Respuesta: [{extension:"100", name:"a100", status:"AVAILABLE", breakType:null}]

// Obtener historial de cambios de estado
getAgentStatusChanges(filters) → POST /agent/status
  // Body: {start, end, statuses, agents, offset, limit}

// Contar cambios de estado (para paginacion)
countAgentStatusChanges(filters) → POST /agent/statuscount

// ═══════════════════════════════════════════
// COLAS
// ═══════════════════════════════════════════

// Tiempo medio de espera en cola
getQueueWaitTime(queueNumber) → GET /queue/{n}/waittime

// Estado en vivo de la cola (llamadas en espera, atendiendo)
getQueueState(queueNumber) → GET /queue/{n}/state

// ═══════════════════════════════════════════
// EXTENSIONES
// ═══════════════════════════════════════════

listExtensions() → GET /extension
getExtension(extensionId) → GET /extension/{id}
findExtensionByUsername(username) → GET /extension/findbyusername/{user}
updateExtension(extensionId, outboundId) → POST /extension/{id}

// ═══════════════════════════════════════════
// GRABACIONES
// ═══════════════════════════════════════════

getRecordingUrl(callId) → GET /recording/{callId}  // MP3

// ═══════════════════════════════════════════
// TTS (Text-to-Speech)
// ═══════════════════════════════════════════

getVoices() → GET /voiceengine  // 120+ voces Amazon Polly
```

---

## 4. Flujo Operativo — Click2Call (Llamada Saliente)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     FLUJO COMPLETO DE UNA LLAMADA SALIENTE                     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  PASO 1: ASESOR INICIA LLAMADA                                       │    │
│  │                                                                     │    │
│  │  Power Dialer:                                                      │    │
│  │  Asesor ve lead, hace click en boton verde "Llamar"                 │    │
│  │  junto al numero 622534699                                          │    │
│  │                                                                     │    │
│  │  Frontend verifica rate limiting:                                    │    │
│  │    • ultima llamada de esta extension hace > 3 segundos?            │    │
│  │    • SI → continuar                                                 │    │
│  │    • NO → mostrar "Espera 3 segundos entre llamadas"                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  PASO 2: CRM ENVIA PETICION A VPBX                                   │    │
│  │                                                                     │    │
│  │  POST /api/vpbx/originate                                           │    │
│  │  Body: { from: "101", to: "622534699", dni: "DNI_75238036E" }       │    │
│  │                                                                     │    │
│  │  API → vpbx.ts → originateCall("101", "622534699")                  │    │
│  │                                                                     │    │
│  │  GET https://vpbx.me/api/originatecall/101/622534699?timeout=30     │    │
│  │  Header: X-Api-Key: sk_live_xxxx                                     │    │
│  │                                                                     │    │
│  │  VPBX responde:                                                     │    │
│  │  {                                                                  │    │
│  │    "success": true,                                                 │    │
│  │    "message": "Call originated",                                    │    │
│  │    "method": "originatecall",                                       │    │
│  │    "variables": {                                                   │    │
│  │      "from": "101", "to": "622534699",                              │    │
│  │      "timeout": "30", "autoAnswer": "false",                        │    │
│  │      "callId": "8e09b9c9-42e6-46ef-9b83-4187b0c2312c"              │    │
│  │    }                                                                │    │
│  │  }                                                                  │    │
│  │                                                                     │    │
│  │  CRM registra:                                                      │    │
│  │  INSERT INTO historial (id_cliente, tipo, descripcion, datos)       │    │
│  │  VALUES ('DNI_75238036E', 'llamada',                                │    │
│  │    'Click2Call iniciado',                                           │    │
│  │    '{"from":"101","to":"622534699","callId":"8e09b9c9-..."}')       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  PASO 3: VPBX EJECUTA LA LLAMADA                                     │    │
│  │                                                                     │    │
│  │  1. VPBX hace sonar el telefono del asesor (extension 101)          │    │
│  │  2. Asesor ve "Llamada entrante" en su telefono                     │    │
│  │  3. Asesor descuelga                                                │    │
│  │  4. VPBX marca al cliente (622534699)                               │    │
│  │  5. Cliente contesta (o no)                                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                    ┌─────────────────┴─────────────────┐                    │
│                    ▼                                   ▼                    │
│  ┌─────────────────────────────┐     ┌─────────────────────────────┐      │
│  │  CLIENTE CONTESTA           │     │  CLIENTE NO CONTESTA         │      │
│  │  (ANSWERED)                 │     │  (HANGUP sin ANSWERED)       │      │
│  └─────────────┬───────────────┘     └─────────────┬───────────────┘      │
│                │                                    │                      │
│                ▼                                    ▼                      │
│  ┌─────────────────────────────┐     ┌─────────────────────────────┐      │
│  │  VPBX → Webhook ANSWERED   │     │  VPBX → Webhook HANGUP      │      │
│  │  POST /api/webhooks/vpbx   │     │  POST /api/webhooks/vpbx    │      │
│  │  {                          │     │  {                           │      │
│  │    eventType: "ANSWERED",   │     │    eventType: "HANGUP",     │      │
│  │    variables: {             │     │    variables: {             │      │
│  │      callId: "8e09...",     │     │      callId: "8e09...",    │      │
│  │      callerNumber: "622...",│     │      callerNumber: "622...",│      │
│  │      callerName: "Cliente", │     │      callerName: "Cliente",│      │
│  │      calleeNumber: "101",   │     │      calleeNumber: "101",  │      │
│  │      did: "965428888"       │     │      did: "965428888"      │      │
│  │    }                        │     │    }                        │      │
│  │  }                          │     │  }                           │      │
│  └─────────────────────────────┘     └─────────────────────────────┘      │
│                                                                              │
│  CRM procesa ANSWERED:                                                      │
│    1. Buscar cliente por callerNumber en telefonos + telefonos_v2           │
│    2. Si encuentra → UPDATE cdr_vpbx SET id_cliente = ...                   │
│    3. INSERT en historial: "Llamada contestada"                             │
│                                                                              │
│  CRM procesa HANGUP:                                                        │
│    1. UPDATE cdr_vpbx SET raw_data = ..., sincronizado = now()              │
│    2. Frontend → Power Dialer muestra modal "Resultado de llamada"          │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Webhooks VPBX — Detalle de Eventos

### Endpoint: `POST /api/webhooks/vpbx`

VPBX envia 3 tipos de eventos durante el ciclo de vida de una llamada:

#### RINGING — Empieza a sonar una extension
```json
{
  "eventType": "RINGING",
  "variables": {
    "callId": "62397e2e-7cfc-4c64-ade1-0b833ee3f10a",
    "callerNumber": "915631789",
    "callerName": "Cliente 1",
    "calleeNumber": "115",
    "did": "965428888"
  }
}
```
**Accion CRM:** INSERT en cdr_vpbx (ON CONFLICT DO NOTHING — evita duplicados)

#### ANSWERED — Extension descuelga
```json
{
  "eventType": "ANSWERED",
  "variables": {
    "callId": "62397e2e-...",
    "callerNumber": "915631789",
    "callerName": "Cliente 1",
    "calleeNumber": "115",
    "did": "965428888"
  }
}
```
**Accion CRM:**
1. Buscar cliente por `callerNumber` en ambas columnas de telefonos
2. Si encuentra → vincular `id_cliente` al CDR
3. Registrar en historial

#### HANGUP — Llamada finalizada
```json
{
  "eventType": "HANGUP",
  "variables": {
    "callId": "62397e2e-...",
    "callerNumber": "915631789",
    "callerName": "Cliente 1",
    "calleeNumber": "115",
    "did": "965428888"
  }
}
```
**Accion CRM:** Actualizar raw_data y marcar sincronizado

**IMPORTANTE:** El webhook SIEMPRE retorna HTTP 200, incluso en error. Si VPBX recibe un codigo de error, reintenta la notificacion, lo que generaria duplicados.

---

## 6. Flujo de Monitoreo en Vivo (LivePanel)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     LIVE PANEL — SUPERVISOR DASHBOARD                          │
│                                                                              │
│  El componente LivePanel consulta cada 15 segundos:                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  PASO 1: OBTENER ESTADOS DE VPBX                                     │    │
│  │                                                                     │    │
│  │  GET /api/vpbx/agents                                                │    │
│  │    → GET https://vpbx.me/api/agent                                   │    │
│  │    → Header: X-Api-Key: sk_live_xxxx                                 │    │
│  │                                                                     │    │
│  │  Respuesta VPBX:                                                    │    │
│  │  [                                                                  │    │
│  │    {"extension":"100","name":"a100","status":"AVAILABLE",            │    │
│  │     "breakType":null},                                               │    │
│  │    {"extension":"101","name":"a101","status":"IN_CALL",              │    │
│  │     "breakType":null},                                               │    │
│  │    {"extension":"102","name":"a102","status":"ON_BREAK",             │    │
│  │     "breakType":"Almuerzo"}                                         │    │
│  │  ]                                                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  PASO 2: CRUZAR CON USUARIOS DEL CRM                                 │    │
│  │                                                                     │    │
│  │  GET /api/usuarios?rol=asesor                                        │    │
│  │                                                                     │    │
│  │  Para cada usuario, buscar su extension_vpbx en los datos de VPBX:  │    │
│  │                                                                     │    │
│  │  Ana Asesora Peru → extension_vpbx = "100" → VPBX status: AVAILABLE │    │
│  │  Luis Asesor Peru → extension_vpbx = "101" → VPBX status: IN_CALL   │    │
│  │  Carmen Asesora → extension_vpbx = "102" → VPBX status: ON_BREAK    │    │
│  │                                                                     │    │
│  │  Mapeo de estados VPBX → UI:                                        │    │
│  │    AVAILABLE → disponible (verde, dot animado)                      │    │
│  │    IN_CALL   → activo (azul, dot animado)                           │    │
│  │    RINGING   → activo (azul, dot animado)                           │    │
│  │    ON_BREAK  → pausa (ambar, dot fijo)                              │    │
│  │    OFFLINE   → sin conexion (gris)                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  PASO 3: RENDERIZAR                                                  │    │
│  │                                                                     │    │
│  │  ┌────────────────────────────────────────────────────────────┐     │    │
│  │  │  Resumen:                                                   │     │    │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │     │    │
│  │  │  │    1     │  │    1     │  │    1     │                  │     │    │
│  │  │  │Disponible│  │En llamada│  │ En Pausa │                  │     │    │
│  │  │  └──────────┘  └──────────┘  └──────────┘                  │     │    │
│  │  │                                                            │     │    │
│  │  │  Tarjetas individuales:                                     │     │    │
│  │  │  ┌────────────┐ ┌────────────┐ ┌────────────┐              │     │    │
│  │  │  │Ana Asesora │ │Luis Asesor │ │Carmen Ases.│              │     │    │
│  │  │  │🟢 disponible│ │🔵 activo   │ │🟡 pausa    │              │     │    │
│  │  │  │15 contactos│ │8 contactos │ │3 contactos │              │     │    │
│  │  │  │5 pendientes│ │2 pendientes│ │7 pendientes│              │     │    │
│  │  │  │Ext. 100    │ │Ext. 101    │ │Ext. 102    │              │     │    │
│  │  │  └────────────┘ └────────────┘ └────────────┘              │     │    │
│  │  └────────────────────────────────────────────────────────────┘     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  CASO: VPBX NO CONECTADO (sin API key o error de red)                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Banner amarillo: "VPBX no conectado — datos reales no disponibles"  │    │
│  │  Todos los contadores en 0                                            │    │
│  │  Todos los estados: "sin conexion"                                    │    │
│  │  Sin simulacion, sin datos inventados                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Sincronizacion de CDR (Registro de Llamadas)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     SINCRONIZACION DE CDR                                     │
│                                                                              │
│  El CRM puede sincronizar el historial completo de llamadas desde VPBX:     │
│                                                                              │
│  Flujo manual/periodico:                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  1. CRM → POST https://vpbx.me/api/cdr                              │    │
│  │     Body: { from: timestamp_inicio, to: timestamp_fin, start:0,     │    │
│  │             stop: 50 }                                               │    │
│  │                                                                     │    │
│  │  2. VPBX responde con array de CDRs:                                │    │
│  │     [{ callId, created, duration, billsec, hangupCause,             │    │
│  │        src, dst, recording, queueId, queueWaitTime, queueAgent }]   │    │
│  │                                                                     │    │
│  │  3. CRM INSERT o UPDATE en cdr_vpbx                                 │    │
│  │                                                                     │    │
│  │  4. Si hay mas paginas, repetir con start=50, start=100, etc.       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Vinculacion bidireccional:                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Despues de cada llamada, el CRM escribe datos en el CDR de VPBX:   │    │
│  │                                                                     │    │
│  │  POST https://vpbx.me/api/cdr/{callId}/updatevars                   │    │
│  │  Body: {                                                            │    │
│  │    var1: "DNI_75238036E",       // ID del cliente                    │    │
│  │    vaVPBX (almacena 1 a�o nativo): "venta",               // Estado del pipeline               │    │
│  │    var3: "Ana Asesora Peru",    // Nombre del asesor                 │    │
│  │    var4: "Orange",              // Proyecto                          │    │
│  │    var5: "2026-06-05"           // Fecha                             │    │
│  │  }                                                                  │    │
│  │                                                                     │    │
│  │  Asi, en el panel de VPBX tambien se ve a que cliente corresponde   │    │
│  │  cada llamada.                                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. API Endpoints del CRM para VPBX

| Metodo | Ruta | Auth | Descripcion |
|---|---|---|---|
| POST | `/api/vpbx/originate` | Session | Iniciar Click2Call. Body: `{from, to, dni}`. Rate limit: 3s |
| GET | `/api/vpbx/agents` | Session | Estados en vivo de agentes VPBX |
| GET | `/api/vpbx/extensions` | Session (supervisor+) | Extensiones VPBX + usuarios asignados del CRM. Fusiona datos de la VPBX con `usuarios.extension_vpbx` |
| POST | `/api/vpbx/cdr/[callId]/vars` | Session | Escribir variables en CDR de VPBX |
| POST | `/api/webhooks/vpbx` | Publico | Recibir eventos RINGING/ANSWERED/HANGUP |

---

## 9. Variables de Entorno

```env
# VPBX (Siptize)
VPBX_API_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx
VPBX_API_URL=https://vpbx.me/api
```

---

## 10. Tablas de Base de Datos para VPBX

### `cdr_vpbx`
```sql
CREATE TABLE cdr_vpbx (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    call_id TEXT UNIQUE NOT NULL,
    id_cliente TEXT REFERENCES clientes(id_cliente),
    asesor_id BIGINT REFERENCES usuarios(id),
    created TIMESTAMPTZ NOT NULL,
    duration INT DEFAULT 0,
    billsec INT DEFAULT 0,
    hangup_cause TEXT,
    src TEXT,
    dst TEXT,
    recording BOOLEAN DEFAULT false,
    raw_data JSONB DEFAULT '{}',
    sincronizado TIMESTAMPTZ DEFAULT now()
);
```

### Campo en `usuarios`
```sql
ALTER TABLE usuarios ADD COLUMN extension_vpbx TEXT;
```

---

## 11. Pagina de Gestion VPBX (`/vpbx`)

> Nueva pagina del dashboard para gestionar extensiones SIP y monitorear agentes.
> Acceso: Sidebar > Administracion > VPBX
> Roles: supervisor, jefe_area, desarrollador, it

### Tab Extensiones
- Tabla con todas las extensiones de la VPBX (via `GET /api/vpbx/extensions`)
- Muestra: numero de extension, nombre, operador asignado (con avatar, nombre, equipo, rol)
- Buscador: filtra por numero de extension o nombre de operador
- Boton "Asignar": abre un selector con los operadores disponibles (solo asesores y supervisores sin extension o con esa misma)
- Boton "Cambiar": reasigna la extension a otro operador
- Desasignar: opcion "— Desasignar —" en el selector
- Si la VPBX no esta configurada, muestra un mensaje informativo con instrucciones para configurar `VPBX_API_KEY`

### Tab Agentes
- Monitoreo en vivo del estado de agentes VPBX (via `GET /api/vpbx/agents`)
- Tarjetas resumen: Disponibles (verde), En llamada (ambar), Pausa (gris), Offline (rojo)
- Tabla con: nombre del agente, extension, estado con icono de color, operador vinculado del CRM
- Estados detectados: Disponible (available/idle/ok/ready), En llamada (ring/call/busy/inuse), Pausa (pause/break), Offline (offline/unavailable/logged)

### Flujo de Asignacion
```
1. Admin crea extensiones en panel VPBX (101, 102, 103...)
2. Supervisor/jefe entra a /vpbx > Tab Extensiones
3. Ve la lista de extensiones (datos de VPBX) + operadores asignados (datos del CRM)
4. Hace click en "Asignar" en una extension sin operador
5. Selecciona un asesor del dropdown
6. El CRM hace PATCH /api/usuarios {id, extension_vpbx: "101"}
7. La tabla se actualiza automaticamente
8. El operador ya puede usar DIT UC o el softphone configurado con esa extension
```
