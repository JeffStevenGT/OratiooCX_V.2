# 📞 VPBX — Integración con Centralita VoIP

> Documentación oficial: https://doc.vpbx.me/admin/
> API Base: `https://vpbx.me/api`

---

## 🧭 ¿Qué es VPBX?

Centralita VoIP en la nube. Proporciona telefonía IP para el call center:
- Extensiones SIP para cada asesor
- Click2Call (llamar desde el CRM)
- Registro de llamadas (CDR) con duración, origen, destino, resultado
- Grabación de llamadas
- Notificaciones en tiempo real (RINGING, ANSWERED, HANGUP)
- Colas, IVR, grupos de llamada

---

## 🔐 Autenticación

Todas las peticiones a la API de VPBX deben incluir el header:

```
X-Api-Key: {api_key_generada_en_el_panel}
```

Las API Keys se generan en: Panel Avanzado → Configuración → Claves API

---

## 📋 Endpoints de la API

### 1. Click2Call — Llamar desde el CRM

#### Llamada a extensión interna (asesor → cliente)

```
GET /api/originatecall/{FROM}/{TO}
```

| Parámetro | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `FROM` | numérico | Sí | Extensión del asesor (ej: 120) |
| `TO` | numérico | Sí | Teléfono del cliente (ej: 966261122) |
| `timeout` | numérico | No | Tiempo máximo en segundos (default: 30) |
| `autoAnswer` | booleano | No | Descolgue automático en FROM (default: false) |

**Ejemplo:**
```
GET https://vpbx.me/api/originatecall/120/966261122?timeout=20
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Call originated",
  "method": "originatecall",
  "variables": {
    "from": "120",
    "to": "966261122",
    "timeout": "20",
    "callId": "8e09b9c9-42e6-46ef-9b83-4187b0c2312c"
  }
}
```

#### Llamada desde número externo

```
GET /api/c2cexternal/{FROM}/{TO}
```

Útil cuando el asesor no tiene extensión SIP y se le llama a su móvil primero.

---

### 2. CDR — Registro de Llamadas (lo más importante)

#### Obtener una llamada específica

```
GET /api/cdr/{callId}
```

#### Consultar lista de llamadas con filtros

```
POST /api/cdr
Content-Type: application/json

{
  "src": "2023",                  // Origen (extensión del asesor)
  "dst": "966261122",             // Destino (teléfono del cliente)
  "from": 1717200000000,          // Timestamp desde (ms)
  "to": 1717286400000,            // Timestamp hasta (ms)
  "start": 0,                     // Paginación: desde
  "stop": 50                      // Paginación: hasta
}
```

**Respuesta:**
```json
[
  {
    "callId": "7bb5b023-c67e-471e-9145-7afa3b13faad",
    "created": 1717205669000,
    "duration": 5,
    "billsec": 0,
    "hangupCause": "ORIGINATOR_CANCEL",
    "dst": "966261122",
    "src": "2023",
    "did": null,
    "srcName": "2023",
    "c2c": false,
    "recording": false,
    "queueId": null,
    "queueAgent": null
  }
]
```

**Campos del CDR:**

| Campo | Tipo | Descripción |
|---|---|---|
| `callId` | String | UUID de la llamada |
| `created` | Long | Timestamp (ms desde 1970, GMT) |
| `duration` | Int | Duración total en segundos |
| `billsec` | Int | **Duración descolgado** en segundos (si es 0, no contestó) |
| `hangupCause` | String | Causa de cuelgue |
| `src` | String | Origen (extensión del asesor) |
| `dst` | String | Destino (teléfono del cliente) |
| `recording` | Boolean | Si hay grabación disponible |
| `queueAgent` | String | Agente que atendió (si pasó por cola) |

**Valores de `hangupCause`:**
- `NORMAL_CLEARING` → Llamada normal, ambos colgaron
- `ORIGINATOR_CANCEL` → El que llamó colgó antes de conectar
- `NO_ANSWER` → No contestaron
- `BUSY` → Ocupado
- `CONGESTION` → Error de red
- `CALL_REJECTED` → Rechazada

#### Contar llamadas (para paginación)

```
POST /api/cdrcount
```

---

### 3. Grabaciones

```
GET /api/recording/{callId}
```

Devuelve el archivo de audio MP3 de la llamada.

---

### 4. Estado de Agentes

#### Listar agentes disponibles

```
GET /api/agent
```

**Respuesta:**
```json
[
  { "extension": "100", "name": "a100", "status": "AVAILABLE", "breakType": null },
  { "extension": "200", "name": "a200", "status": "ON_BREAK", "breakType": "1" }
]
```

**Estados posibles:** `AVAILABLE`, `ON_BREAK`, `LOGGED_OFF`

---

### 5. Variables Personalizadas en CDR

Se pueden agregar hasta 5 variables personalizadas a cada registro de llamada:

```
POST /api/cdr/{callId}/updatevars
Content-Type: application/json

{
  "variables": {
    "id_cliente": "DNI_12345678A",
    "proyecto": "orange",
    "resultado": "venta"
  }
}
```

Estas variables se pueden consultar después en el CDR.

---

### 6. Click2Call — Obtener ID real de la llamada

```
GET /api/cdrc2c/{callId}
```

Devuelve el UUID real del CDR generado por un click2call (útil para vincular la llamada con el registro en el CRM).

---

## 🔔 Eventos Webhook (Tiempo Real)

VPBX puede enviar notificaciones HTTP POST a una URL configurada cuando ocurren eventos de llamada.

### RINGING

Cuando una extensión empieza a sonar:

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

### ANSWERED

Cuando la extensión descuelga:

```json
{
  "eventType": "ANSWERED",
  "variables": {
    "callId": "62397e2e-7cfc-4c64-ade1-0b833ee3f10a",
    "callerNumber": "915631789",
    "callerName": "Cliente 1",
    "calleeNumber": "115",
    "did": "965428888"
  }
}
```

### HANGUP

Cuando la extensión cuelga:

```json
{
  "eventType": "HANGUP",
  "variables": {
    "callId": "62397e2e-7cfc-4c64-ade1-0b833ee3f10a",
    "callerNumber": "915631789",
    "callerName": "Cliente 1",
    "calleeNumber": "115",
    "did": "965428888"
  }
}
```

---

## 🔄 Integración con el CRM

### Módulo VPBX en Next.js

```
src/
├── lib/
│   └── vpbx.ts              ← Cliente API VPBX
├── app/
│   ├── api/
│   │   ├── vpbx/
│   │   │   ├── originate/route.ts     ← Click2Call
│   │   │   ├── cdr/route.ts           ← Consultar CDR
│   │   │   ├── recording/route.ts     ← Obtener grabación
│   │   │   └── agents/route.ts        ← Estado de agentes
│   │   └── webhooks/
│   │       └── vpbx/route.ts          ← Webhooks RINGING/ANSWERED/HANGUP
```

### Flujo Click2Call

```
1. Asesor ve lead en Power Dialer
2. Click "Llamar" → PATCH /api/pipeline (lock exclusivo)
3. Frontend llama POST /api/vpbx/originate
4. API llama GET /api/originatecall/{ext}/{telefono}
5. VPBX: suena el teléfono del asesor
6. Asesor descuelga → VPBX llama al cliente
7. Webhook ANSWERED → API guarda en historial
8. Webhook HANGUP → API actualiza CDR con variables
9. Frontend muestra resultado en tiempo real
```

### Almacenamiento de llamadas en BD

```sql
-- Tabla para sincronizar CDR de VPBX
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

CREATE INDEX idx_cdr_asesor ON cdr_vpbx (asesor_id, created DESC);
CREATE INDEX idx_cdr_cliente ON cdr_vpbx (id_cliente);
```

---

## 📊 Datos que Aporta VPBX al CRM

| Dato | ¿Cómo se obtiene? | ¿Para qué sirve? |
|---|---|---|
| ¿El asesor llamó? | CDR `src` = extensión del asesor + `dst` = teléfono del lead | Re-análisis inteligente |
| ¿Contestaron? | `billsec > 0` | Saber si la llamada fue efectiva |
| ¿Cuánto duró? | `billsec` | Calidad de la llamada |
| ¿Por qué terminó? | `hangupCause` | Detectar problemas |
| ¿Hay grabación? | `recording = true` | Auditoría y formación |
| Estado del agente | `GET /api/agent` | Disponibilidad en tiempo real |

---

## 🧠 Lógica de Re-Análisis (cruza CDR + Pipeline)

```typescript
// lib/reanalysis.ts
type Decision = 'ahora' | '7dias' | '3meses' | 'nunca';

function decidirReanalisis(cdr: CDR, pipeline: Pipeline): Decision {
  const llamo = cdr && cdr.billsec > 0;
  const contesto = llamo && cdr.hangupCause === 'NORMAL_CLEARING';
  
  if (!llamo && pipeline.estado === 'pendiente') return 'ahora'; // ni lo intentó
  if (!llamo && pipeline.estado === 'venta') return 'nunca'; // 🚩 posible fraude
  
  if (contesto && pipeline.estado === 'venta') return '3meses';
  if (contesto && pipeline.estado === 'no_interesa') return 'nunca';
  if (contesto && pipeline.estado === 'no_contesta') return '7dias';
  
  if (!contesto) return '7dias'; // no contestó, reintentar
  
  return '7dias';
}
```

---

## ⚙️ Configuración Necesaria en VPBX

Para que la integración funcione, se necesita en el Panel Avanzado de VPBX:

1. **Extensiones SIP** para cada asesor del call center
2. **API Key** con permisos de: Click2Call, CDR, agentes, grabaciones
3. **Webhook URL** configurada: `https://{dominio}/api/webhooks/vpbx`
4. **Grabación de llamadas** activada
5. **Variables personalizadas** habilitadas en CDR

---

## 💰 Costos

| Concepto | Costo |
|---|---|
| API VPBX | Incluido en el plan |
| Extensiones SIP | Por asesor |
| Grabaciones | Por minuto |
| Números DID (entrada) | Por número |

Consultar con el administrador de VPBX los precios exactos.
