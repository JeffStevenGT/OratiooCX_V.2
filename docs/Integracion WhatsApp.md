# 📱 Integración WhatsApp — Meta Cloud API (v1.0)

> Diseño detallado del módulo de mensajería WhatsApp
> Actualizado: 03/06/2026 — Pendiente de implementación

---

## 🧭 Objetivo

Automatizar comunicación con clientes vía WhatsApp usando Meta Cloud API directamente, sin intermediarios como n8n. Cumplimiento RGPD con doble opt-in.

---

## 🗄️ Tablas

### `whatsapp_mensajes` (NUEVA)

```sql
CREATE TABLE whatsapp_mensajes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente),
    direccion TEXT NOT NULL CHECK (direccion IN ('entrante','saliente')),
    tipo TEXT NOT NULL CHECK (tipo IN (
        'opt_in_request','opt_in_response',
        'alerta_renove','manual','respuesta_cliente'
    )),
    mensaje TEXT NOT NULL,
    plantilla_meta TEXT,
    wa_message_id TEXT,
    wa_status TEXT CHECK (wa_status IN ('sent','delivered','read','failed')),
    metadatos JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### Ampliación `clientes` — RGPD

```sql
ALTER TABLE clientes ADD COLUMN whatsapp_opt_in BOOLEAN DEFAULT false;
ALTER TABLE clientes ADD COLUMN whatsapp_numero TEXT;
ALTER TABLE clientes ADD COLUMN whatsapp_opt_in_fecha TIMESTAMPTZ;
ALTER TABLE clientes ADD COLUMN alertas_fidelizacion BOOLEAN DEFAULT false;
```

---

## 📡 Endpoints

| Ruta | Método | Descripción |
|---|---|---|
| /api/whatsapp/opt-in-request | POST | Dispara plantilla de opt-in al cliente |
| /api/whatsapp/send | POST | Envío manual de mensaje desde el CRM |
| /api/webhooks/whatsapp | POST | Webhook entrante de Meta (respuestas) |
| /api/whatsapp/mensajes | GET | Historial de chat por id_cliente |
| /api/whatsapp/plantillas | GET | Lista plantillas disponibles en Meta |

---

## 🔄 Flujo 1: Doble Opt-In

```
Asesor activa switch "Alertas de Fidelización" en ficha del cliente
  → Ingresa número WhatsApp
  → Click "Enviar Opt-In"
       │
       ▼
POST /api/whatsapp/opt-in-request
  → Valida número español
  → Guarda alertas_fidelizacion = true, whatsapp_numero
  → Inserta whatsapp_mensajes (tipo: opt_in_request)
  → Dispara Plantilla Meta 1:
      "Hola {nombre}, ¿autorizas recibir alertas de fidelización
       de Orange por WhatsApp? Responde SI para aceptar."
       │
       ▼
Cliente responde "SI"
  → Webhook Meta → POST /api/webhooks/whatsapp
  → Detecta keyword "SI"
  → Actualiza clientes: whatsapp_opt_in = true, fecha = now()
  → Inserta whatsapp_mensajes (tipo: opt_in_response)
  → Responde: "¡Confirmado! Te avisaremos."
```

**Revocación:** Si el cliente responde "BAJA" → `whatsapp_opt_in = false`

---

## 🔄 Flujo 2: Alerta Renove Automática

```
Bot extrae Orange → detecta línea con variante_renove
  → POST /api/internal/bot-sync
       │
       ▼
Backend recibe datos
  → Lee: lineas[].tiene_renove === true
  → Cruza BD: SELECT whatsapp_opt_in, alertas_fidelizacion
              FROM clientes WHERE id_cliente = $1
  → SI opt_in = true AND alertas = true:
      → Dispara Plantilla Meta 2:
          "{nombre}, detectamos que tu línea {numero}
           tiene {variante_renove}. ¿Te llamamos?"
      → Inserta whatsapp_mensajes (tipo: alerta_renove)
      → Inserta historial (tipo: whatsapp)
  → SI NO → solo guarda datos, no dispara nada
```

---

## 🔄 Flujo 3: WhatsApp Entrante

```
Cliente envía mensaje → Meta webhook → POST /api/webhooks/whatsapp
  → Busca cliente por whatsapp_numero
  → Inserta whatsapp_mensajes (tipo: respuesta_cliente)
  → Empuja a frontend vía Pusher/SSE:
      { tipo: 'whatsapp_entrante', id_cliente, mensaje }
       │
       ▼
Frontend: toast + panel flotante (Zustand chat store)
```

---

## 🎨 UI: Switch en Ficha del Cliente

```
┌──────────────────────────────────────────────┐
│ Alertas de Fidelización    [========○] OFF    │
│                                              │
│ Cuando ON:                                   │
│   WhatsApp: [ +34 612 345 678          ]     │
│   Estado: ✅ Confirmado / ⏳ Pendiente        │
│                                              │
│   [ Enviar solicitud Opt-In ]                │
└──────────────────────────────────────────────┘
```

---

## 🎨 Panel de Chat Flotante

```typescript
// stores/chat-store.ts (Zustand)
interface ChatState {
  abierto: boolean;
  clienteActual: string | null;
  mensajes: Mensaje[];
  noLeidos: number;
}
```

- Esquina inferior derecha, estilo WhatsApp Web
- Accesible desde cualquier página del CRM
- Botones de copiado directo (DNI, teléfono)
- Diseño unificado con modal de Tramitación

---

## 🛡️ Cumplimiento RGPD

- Doble opt-in obligatorio (cliente debe responder "SI")
- Revocación inmediata con "BAJA"
- `whatsapp_opt_in_fecha` registra fecha de consentimiento
- Trigger de auditoría registra cambios en `alertas_fidelizacion`
- Plantillas Meta incluyen texto legal
- Solo se envía WhatsApp si AMBAS condiciones: `opt_in = true` AND `alertas_fidelizacion = true`

---

## 🔧 Configuración Meta Cloud API

1. Crear app en Meta Developers
2. Configurar webhook URL → `https://{dominio}/api/webhooks/whatsapp`
3. Obtener token de acceso permanente
4. Crear plantillas:
   - `opt_in_request` — Solicitud de consentimiento
   - `alerta_renove` — Notificación de renovación
5. Variables de entorno:
   ```
   META_WHATSAPP_TOKEN=xxx
   META_PHONE_NUMBER_ID=xxx
   META_VERIFY_TOKEN=xxx
   ```
