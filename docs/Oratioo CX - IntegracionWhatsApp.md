# Oratioo CX — Integracion WhatsApp (Meta Cloud API)

> Documento tecnico-operativo completo de la integracion con WhatsApp Business
> Plataforma: Meta Cloud API v21.0 | Estado: Disenado, libreria implementada, pendiente de activacion en produccion

---

## 1. Arquitectura de Integracion

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         META CLOUD PLATFORM                                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    META BUSINESS ACCOUNT                             │    │
│  │                                                                     │    │
│  │  • Registro en business.facebook.com                                │    │
│  │  • Verificacion de empresa (documentos legales)                     │    │
│  │  • Numero de telefono verificado (SMS o llamada)                    │    │
│  │  • Token de acceso permanente (System User)                         │    │
│  │  • Webhook configurado → https://{dominio}/api/webhooks/whatsapp    │    │
│  │  • Webhook verify token: configurado en .env                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    PLANTILLAS DE MENSAJE                             │    │
│  │                                                                     │    │
│  │  Las plantillas deben ser APROBADAS por Meta antes de usarse.       │    │
│  │  Categorias: Marketing, Utility, Authentication, Service.           │    │
│  │                                                                     │    │
│  │  Plantillas configuradas:                                           │    │
│  │  ┌──────────────┬──────────────────────────────────────────────┐   │    │
│  │  │ bienvenida   │ "Hola {{nombre}}, soy {{asesor}} de Oratioo. │   │    │
│  │  │              │  Te contacto para ofrecerte..."              │   │    │
│  │  ├──────────────┼──────────────────────────────────────────────┤   │    │
│  │  │ info_renove  │ "Hola {{nombre}}, tienes disponible un       │   │    │
│  │  │              │  {{producto}} con condiciones especiales..."  │   │    │
│  │  ├──────────────┼──────────────────────────────────────────────┤   │    │
│  │  │ seguimiento  │ "Hola {{nombre}}, quedamos en hablar el      │   │    │
│  │  │              │  {{fecha}}. Estoy a tu disposicion."         │   │    │
│  │  ├──────────────┼──────────────────────────────────────────────┤   │    │
│  │  │ oferta       │ "Hola {{nombre}}, tenemos un {{descuento}}   │   │    │
│  │  │              │  de descuento especial para ti..."           │   │    │
│  │  └──────────────┴──────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    LIMITES Y RESTRICCIONES                           │    │
│  │                                                                     │    │
│  │  • Numeros de prueba: 5 destinatarios maximo                        │    │
│  │  • Numeros verificados: 1K destinatarios/dia (escalable)            │    │
│  │  • Ventana de 24h: solo plantillas pre-aprobadas fuera de ventana   │    │
│  │  • Dentro de ventana 24h: texto libre permitido                     │    │
│  │  • Tasa de mensajes: 80 mensajes/segundo (escalable)                │    │
│  │  • Tamano maximo: texto 4096 chars, media 64MB                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Configuracion Inicial — Paso a Paso

### Paso 1: Crear App en Meta Developers

1. Ir a `developers.facebook.com`
2. Crear nueva app tipo "Business"
3. Agregar producto "WhatsApp"
4. Seleccionar Business Account existente o crear nueva
5. Anotar:
   - `WHATSAPP_PHONE_NUMBER_ID` (ID del numero)
   - `WHATSAPP_BUSINESS_ACCOUNT_ID`
   - `WHATSAPP_ACCESS_TOKEN` (token temporal, luego permanente)

### Paso 2: Configurar Webhook

1. En la app de Meta, ir a WhatsApp > Configuration
2. Webhook URL: `https://tudominio.com/api/webhooks/whatsapp`
3. Verify token: generar un string aleatorio (ej: `oratioo-whatsapp-verify-2026`)
4. Seleccionar campos: `messages`, `message_deliveries`, `message_reads`
5. Verificar y suscribir

### Paso 3: Token Permanente

1. Crear System User en Business Settings
2. Asignar permisos: `whatsapp_business_messaging`, `whatsapp_business_management`
3. Generar token sin expiracion
4. Guardar en `.env`:
```
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_BUSINESS_ACCOUNT_ID=987654321
WHATSAPP_ACCESS_TOKEN=EAAx...
WHATSAPP_VERIFY_TOKEN=oratioo-whatsapp-verify-2026
```

### Paso 4: Crear Plantillas en Meta

1. En WhatsApp Manager > Message Templates
2. Crear plantilla para cada tipo (bienvenida, info_renove, seguimiento, oferta)
3. Definir variables con doble llave: `{{nombre}}`, `{{asesor}}`, `{{producto}}`
4. Enviar a revision (Meta aprueba en 1-24h)
5. Una vez aprobadas, configurar en CRM > Config > Plantillas WhatsApp

---

## 3. Libreria de Integracion (`src/lib/whatsapp.ts`)

```typescript
const WHATSAPP_API = 'https://graph.facebook.com/v21.0';
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const TOKEN = proces…CESS_TOKEN || '';

async function whatsappFetch(endpoint: string, body: any) {
  const res = await fetch(`${WHATSAPP_API}/${PHONE_ID}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`WhatsApp ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json();
}

// Enviar texto (solo dentro de ventana 24h)
export async function sendText(to: string, text: string) {
  return whatsappFetch('/messages', {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text },
  });
}

// Enviar plantilla (siempre disponible, incluso fuera de ventana 24h)
export async function sendTemplate(to: string, templateName: string, params: string[]) {
  return whatsappFetch('/messages', {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'es' },
      components: [{
        type: 'body',
        parameters: params.map(p => ({ type: 'text', text: p })),
      }],
    },
  });
}

// Parsear mensaje entrante del webhook
export function parseIncoming(payload: any) {
  const entry = payload?.entry?.[0];
  const change = entry?.changes?.[0];
  const message = change?.value?.messages?.[0];
  if (!message) return null;
  return {
    from: message.from,
    text: message.text?.body || '',
    timestamp: message.timestamp,
    messageId: message.id,
  };
}

// Verificar webhook (Meta envia GET con challenge)
export function verifyWebhook(mode: string, token: string, challenge: string): string | null {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || '';
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return challenge;
  }
  return null;
}
```

---

## 4. Flujo Operativo — Envio de WhatsApp

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     FLUJO DE ENVIO DE WHATSAPP                                 │
│                                                                              │
│  INICIO: Asesor esta en Power Dialer viendo un lead                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  PASO 1: ASESOR INICIA CONTACTO                                      │    │
│  │                                                                     │    │
│  │  Power Dialer muestra:                                              │    │
│  │  ┌─────────────────────────────────────────────────────────────┐   │    │
│  │  │  ROCIO MARTINEZ MARTINEZ                    Ronda 2/5        │   │    │
│  │  │  DNI: 75238036E                                             │   │    │
│  │  │                                                            │   │    │
│  │  │  [CIMA ✓]  [Renove ✓]  [WhatsApp 💬]                       │   │    │
│  │  │                                                            │   │    │
│  │  │  Lineas:                                                    │   │    │
│  │  │  950045499  [Llamar]                                       │   │    │
│  │  │  684211783  [Llamar]  ⭐                                    │   │    │
│  │  └─────────────────────────────────────────────────────────────┘   │    │
│  │                                                                     │    │
│  │  Asesor hace click en boton WhatsApp (icono verde 💬)              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  PASO 2: VERIFICACION DE OPT-IN                                      │    │
│  │                                                                     │    │
│  │  SELECT whatsapp_opt_in, whatsapp_numero FROM clientes              │    │
│  │  WHERE id_cliente = 'DNI_75238036E'                                 │    │
│  │                                                                     │    │
│  │  ┌─ SI: whatsapp_opt_in = true AND whatsapp_numero != null          │    │
│  │  │   → Continuar al paso 3                                          │    │
│  │  │                                                                  │    │
│  │  └─ NO: whatsapp_opt_in = false OR whatsapp_numero = null           │    │
│  │      → Mostrar mensaje: "Cliente no autorizo WhatsApp"              │    │
│  │      → No enviar                                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │ (SI)                                  │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  PASO 3: SELECCION DE PLANTILLA                                      │    │
│  │                                                                     │    │
│  │  Se abre panel de chat (WhatsAppChat):                              │    │
│  │  ┌─────────────────────────────────────────────────────────────┐   │    │
│  │  │  Chat con ROCIO MARTINEZ MARTINEZ                           │   │    │
│  │  │  📱 950045499                                               │   │    │
│  │  │                                                            │   │    │
│  │  │  Plantilla: [Bienvenida ▾]                                  │   │    │
│  │  │                                                            │   │    │
│  │  │  Variables:                                                 │   │    │
│  │  │    {{nombre}}: ROCIO                                       │   │    │
│  │  │    {{asesor}}: Ana Asesora Peru                            │   │    │
│  │  │                                                            │   │    │
│  │  │  [Enviar]  [Cancelar]                                      │   │    │
│  │  └─────────────────────────────────────────────────────────────┘   │    │
│  │                                                                     │    │
│  │  SOLO se pueden enviar plantillas pre-aprobadas.                    │    │
│  │  NO se permite texto libre (cumplimiento politica Meta).            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  PASO 4: ENVIO A META                                                │    │
│  │                                                                     │    │
│  │  POST /api/whatsapp/send                                            │    │
│  │  Body: {                                                            │    │
│  │    to: "34684211783",                                               │    │
│  │    template: "bienvenida",                                          │    │
│  │    params: ["ROCIO", "Ana Asesora Peru"]                           │    │
│  │  }                                                                  │    │
│  │                                                                     │    │
│  │  API → whatsapp.ts → sendTemplate()                                 │    │
│  │  POST https://graph.facebook.com/v21.0/{PHONE_ID}/messages          │    │
│  │  Headers: Authorization: Bearer {TOKEN}                             │    │
│  │  Body: {                                                            │    │
│  │    messaging_product: "whatsapp",                                   │    │
│  │    to: "34684211783",                                               │    │
│  │    type: "template",                                                │    │
│  │    template: {                                                      │    │
│  │      name: "bienvenida",                                            │    │
│  │      language: { code: "es" },                                      │    │
│  │      components: [{ type: "body", parameters: [...] }]             │    │
│  │    }                                                                │    │
│  │  }                                                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  PASO 5: RESPUESTA Y REGISTRO                                        │    │
│  │                                                                     │    │
│  │  Meta responde: { messaging_product: "whatsapp",                    │    │
│  │                   contacts: [{ input: "...", wa_id: "..." }],        │    │
│  │                   messages: [{ id: "wamid.xxx..." }] }              │    │
│  │                                                                     │    │
│  │  CRM registra:                                                      │    │
│  │  INSERT INTO whatsapp_mensajes (                                    │    │
│  │    id_cliente, proyecto_id, direccion,                              │    │
│  │    tipo, contenido, metadata, whatsapp_message_id                   │    │
│  │  ) VALUES (                                                         │    │
│  │    'DNI_75238036E', 1, 'saliente',                                 │    │
│  │    'bienvenida',                                                    │    │
│  │    '{"to":"34684211783","params":["ROCIO","Ana Asesora Peru"]}',    │    │
│  │    'wamid.xxx...'                                                   │    │
│  │  )                                                                  │    │
│  │                                                                     │    │
│  │  INSERT INTO historial (id_cliente, tipo, descripcion, datos)       │    │
│  │  VALUES ('DNI_75238036E', 'whatsapp',                               │    │
│  │    'WhatsApp enviado: plantilla bienvenida',                        │    │
│  │    '{"template":"bienvenida"}')                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Flujo Operativo — Recepcion de WhatsApp

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                   FLUJO DE RECEPCION DE WHATSAPP                               │
│                                                                              │
│  INICIO: Cliente envia un mensaje al numero de WhatsApp de la empresa        │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  PASO 1: META RECIBE Y REENVIA                                       │    │
│  │                                                                     │    │
│  │  Cliente escribe "Hola, me interesa la oferta"                      │    │
│  │  desde su telefono +34684211783                                     │    │
│  │                                                                     │    │
│  │  Meta → POST https://tudominio.com/api/webhooks/whatsapp            │    │
│  │                                                                     │    │
│  │  Body:                                                              │    │
│  │  {                                                                  │    │
│  │    "object": "whatsapp_business_account",                           │    │
│  │    "entry": [{                                                      │    │
│  │      "id": "123456",                                                │    │
│  │      "changes": [{                                                  │    │
│  │        "value": {                                                   │    │
│  │          "messaging_product": "whatsapp",                           │    │
│  │          "metadata": { "phone_number_id": "..." },                  │    │
│  │          "contacts": [{ "profile": {"name":"ROCIO"}, "wa_id":"..." }],│
│  │          "messages": [{                                             │    │
│  │            "from": "34684211783",                                   │    │
│  │            "id": "wamid.xxx...",                                    │    │
│  │            "timestamp": "1717600000",                               │    │
│  │            "type": "text",                                          │    │
│  │            "text": { "body": "Hola, me interesa la oferta" }        │    │
│  │          }]                                                         │    │
│  │        }                                                            │    │
│  │      }]                                                             │    │
│  │    }]                                                               │    │
│  │  }                                                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  PASO 2: CRM PROCESA                                                 │    │
│  │                                                                     │    │
│  │  POST /api/webhooks/whatsapp recibe el JSON                         │    │
│  │                                                                     │    │
│  │  1. Verificar que es un mensaje (no status/delivery)                │    │
│  │  2. parseIncoming(payload) → {from, text, timestamp, messageId}     │    │
│  │                                                                     │    │
│  │  3. Buscar cliente por telefono:                                     │    │
│  │     SELECT id_cliente FROM clientes                                 │    │
│  │     WHERE telefonos @> '["34684211783"]'                            │    │
│  │        OR EXISTS (SELECT 1 FROM jsonb_array_elements(telefonos_v2)  │    │
│  │                   WHERE value->>'num' = '34684211783')              │    │
│  │     LIMIT 1                                                         │    │
│  │                                                                     │    │
│  │  4. Guardar mensaje:                                                │    │
│  │     INSERT INTO whatsapp_mensajes (                                 │    │
│  │       id_cliente, direccion, tipo, contenido,                       │    │
│  │       whatsapp_message_id, metadata                                 │    │
│  │     ) VALUES (                                                      │    │
│  │       'DNI_75238036E', 'entrante', 'texto',                         │    │
│  │       'Hola, me interesa la oferta',                                │    │
│  │       'wamid.xxx...',                                               │    │
│  │       '{"from":"34684211783","timestamp":"1717600000"}'             │    │
│  │     )                                                               │    │
│  │                                                                     │    │
│  │  5. Registrar en historial:                                         │    │
│  │     INSERT INTO historial (id_cliente, tipo, descripcion, datos)    │    │
│  │     VALUES ('DNI_75238036E', 'whatsapp',                             │    │
│  │       'Mensaje WhatsApp recibido',                                  │    │
│  │       '{"texto":"Hola, me interesa la oferta"}')                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  PASO 3: NOTIFICACION (FUTURO)                                       │    │
│  │                                                                     │    │
│  │  Si el lead tiene un asesor asignado, se podria notificar:          │    │
│  │  • Badge en sidebar del asesor                                      │    │
│  │  • SSE (Server-Sent Events) para notificacion en tiempo real        │    │
│  │  • Email al supervisor si el cliente es VIP                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Flujo de Verificacion de Webhook (Meta → CRM)

```
Meta GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=XXX&hub.verify_token=YYY

CRM verifica:
  1. hub.mode === 'subscribe'
  2. hub.verify_token === process.env.WHATSAPP_VERIFY_TOKEN
  3. Si OK → responde 200 con hub.challenge como texto plano
  4. Si NO → responde 403

Este flujo ocurre UNA vez al configurar el webhook en Meta Developers.
```

---

## 7. Gestion de Plantillas en el CRM

### CRUD de Plantillas

```
┌─────────────────────────────────────────────────────────────────┐
│  Config > Plantillas WhatsApp                                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  + Nueva plantilla                                       │   │
│  │                                                         │   │
│  │  Nombre interno: [bienvenida________]                    │   │
│  │  Titulo visible: [Bienvenida al cliente]                 │   │
│  │                                                         │   │
│  │  Mensaje:                                                │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │ Hola {{nombre}}, soy {{asesor}} de Oratioo.     │    │   │
│  │  │ Te contacto para ofrecerte informacion sobre    │    │   │
│  │  │ nuestros productos de telecomunicaciones.       │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │                                                         │   │
│  │  Variables (separadas por coma): [nombre, asesor]       │   │
│  │                                                         │   │
│  │  [Crear plantilla]                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Plantillas existentes:                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 🔵 bienvenida    "Hola {{nombre}}, soy {{asesor}}..."    │  │
│  │ 🔵 info_renove   "Hola {{nombre}}, tienes disponible..." │  │
│  │ 🔵 seguimiento   "Hola {{nombre}}, quedamos en hablar..."│  │
│  │ ⚪ oferta        (inactiva)                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  NOTA: La plantilla DEBE existir y estar aprobada en Meta.     │
│  El CRM solo la referencia por nombre.                         │
│  La creacion en Meta es manual (portal developers.facebook.com)│
└─────────────────────────────────────────────────────────────────┘
```

### API Endpoints

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/whatsapp/plantillas` | Listar plantillas activas del proyecto |
| GET | `/api/whatsapp/plantillas?todas=true` | Listar todas (incluye inactivas) |
| POST | `/api/whatsapp/plantillas` | Crear o actualizar plantilla |
| POST | `/api/whatsapp/send` | Enviar mensaje (solo plantillas) |

---

## 8. Renove Automatico por WhatsApp

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUJO AUTOMATICO                                                │
│                                                                 │
│  Bot extrae datos de Orange                                     │
│       │                                                         │
│       ▼                                                         │
│  detectarCambios() encuentra renove_nuevo                        │
│       │                                                         │
│       ▼                                                         │
│  Verificar condiciones:                                         │
│    1. cliente.whatsapp_opt_in === true                           │
│    2. cliente.whatsapp_numero NO es null                         │
│    3. cliente.whatsapp_numero es un telefono valido              │
│       │                                                         │
│       ├── TODAS OK → sendTemplate(to, 'info_renove', params)    │
│       │              → INSERT en whatsapp_mensajes              │
│       │              → INSERT en historial                      │
│       │                                                        │
│       └── ALGUNA FALLA → No enviar                             │
│                          → Log: "Cliente sin opt-in WhatsApp"   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Variables de Entorno Requeridas

```env
# WhatsApp Meta Cloud API
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_BUSINESS_ACCOUNT_ID=987654321098765
WHATSAPP_ACCESS_TOKEN=EAAx...token_largo...
WHATSAPP_VERIFY_TOKEN=oratioo-whatsapp-verify-2026
```

---

## 10. Tablas de Base de Datos

### `whatsapp_mensajes`
```sql
CREATE TABLE whatsapp_mensajes (
    id BIGSERIAL PRIMARY KEY,
    id_cliente TEXT REFERENCES clientes(id_cliente),
    proyecto_id BIGINT REFERENCES proyectos(id) DEFAULT 1,
    direccion TEXT NOT NULL CHECK (direccion IN ('entrante', 'saliente')),
    tipo TEXT NOT NULL,                -- 'texto', 'plantilla', 'imagen', 'documento'
    contenido TEXT,                    -- texto del mensaje o nombre de plantilla
    metadata JSONB DEFAULT '{}',       -- {to, params, template_name}
    whatsapp_message_id TEXT,          -- wamid.xxx... (ID de Meta)
    leido BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### `whatsapp_plantillas`
```sql
CREATE TABLE whatsapp_plantillas (
    id BIGSERIAL PRIMARY KEY,
    proyecto_id BIGINT REFERENCES proyectos(id) DEFAULT 1,
    nombre TEXT NOT NULL,              -- coincide con el nombre en Meta
    titulo TEXT,                       -- nombre visible en UI
    mensaje TEXT NOT NULL,             -- texto con {{variables}}
    variables JSONB DEFAULT '[]',      -- ["nombre", "asesor"]
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Campos en `clientes`
```sql
ALTER TABLE clientes ADD COLUMN whatsapp_opt_in BOOLEAN DEFAULT false;
ALTER TABLE clientes ADD COLUMN whatsapp_numero TEXT;
ALTER TABLE clientes ADD COLUMN whatsapp_opt_in_fecha TIMESTAMPTZ;
ALTER TABLE clientes ADD COLUMN alertas_fidelizacion BOOLEAN DEFAULT false;
```
