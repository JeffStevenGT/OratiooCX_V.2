# ORATIOO CX — WhatsApp, Notificaciones y Flujo Renove

> Diseño detallado del módulo omnicanal de mensajería
> Actualizado: 03/06/2026

---

## 📱 Objetivo

Automatizar la comunicación con clientes que tienen dispositivos en renovación,
cumpliendo con RGPD (doble opt-in) y usando Meta Cloud API directamente (sin n8n).

---

## 🗄️ Tablas

### `whatsapp_mensajes` (NUEVA)

```sql
CREATE TABLE whatsapp_mensajes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente),
    direccion TEXT NOT NULL CHECK (direccion IN ('entrante','saliente')),
    tipo TEXT NOT NULL,
        CHECK (tipo IN ('opt_in_request','opt_in_response',
                        'alerta_renove','manual','respuesta_cliente')),
    mensaje TEXT NOT NULL,
    plantilla_meta TEXT,               -- Nombre de la plantilla de Meta
    wa_message_id TEXT,                 -- ID devuelto por Meta API
    wa_status TEXT,                     -- sent, delivered, read, failed
    metadatos JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### Ampliación `clientes` — Campos RGPD

```sql
ALTER TABLE clientes ADD COLUMN whatsapp_opt_in BOOLEAN DEFAULT false;
ALTER TABLE clientes ADD COLUMN whatsapp_numero TEXT;
ALTER TABLE clientes ADD COLUMN whatsapp_opt_in_fecha TIMESTAMPTZ;
ALTER TABLE clientes ADD COLUMN alertas_fidelizacion BOOLEAN DEFAULT false;
```

---

## 🔄 Flujo 1: Doble Opt-In

```
Asesor en CRM
  │
  ├─ Ve ficha del cliente (desplegable)
  ├─ Activa switch "Alertas de Fidelización"
  ├─ Ingresa número de WhatsApp (+34 6XX XXX XXX)
  └─ Click "Enviar Opt-In"
       │
       ▼
  POST /api/whatsapp/opt-in-request
       │
       ├─ Valida número español (+34, 9 dígitos)
       ├─ Guarda: alertas_fidelizacion = true, whatsapp_numero = X
       ├─ Inserta whatsapp_mensajes: tipo = 'opt_in_request'
       └─ Dispara Plantilla Meta API 1:
            "Hola {nombre}, ¿autorizas recibir alertas de fidelización
             de Orange por WhatsApp? Responde SI para aceptar."
                 │
                 ▼
  Cliente responde "SI" por WhatsApp
       │
       ▼
  POST /api/webhooks/whatsapp (Meta envía)
       │
       ├─ Detecta keyword "SI" en respuesta a plantilla opt_in
       ├─ Actualiza: whatsapp_opt_in = true, whatsapp_opt_in_fecha = now()
       ├─ Inserta: tipo = 'opt_in_response'
       └─ Responde: "¡Confirmado! Te avisaremos cuando detectemos
            oportunidades de renovación."
```

**Si el cliente responde "BAJA":** `whatsapp_opt_in = false` y se anota en historial.

---

## 🔄 Flujo 2: Alerta Renove Automática

```
Bot extrae datos de Orange
  │
  ├─ Detecta línea con variante_renove != "N/A"
  └─ Envía JSON con tiene_renove = true, variante_renove = "..."
       │
       ▼
  POST /api/internal/bot-sync
       │
       ├─ Backend recibe los datos
       ├─ Lee: datos.lineas[].tiene_renove === true
       ├─ Cruza con BD:
       │   SELECT whatsapp_opt_in, whatsapp_numero, alertas_fidelizacion
       │   FROM clientes WHERE id_cliente = $1
       │
       ├─ SI opt_in = true AND alertas_fidelizacion = true:
       │   │
       │   ├─ Dispara Plantilla Meta API 2 (Alerta Renove):
       │   │   "{nombre}, hemos detectado que tu línea {numero}
       │   │    tiene disponible un {variante_renove}.
       │   │    ¿Quieres que te llamemos para aprovecharlo?"
       │   │
       │   ├─ Inserta whatsapp_mensajes: tipo = 'alerta_renove'
       │   └─ Inserta historial: tipo = 'whatsapp',
       │        descripcion = 'Alerta Renove enviada automáticamente'
       │
       └─ SI NO tiene opt-in → no hace nada, solo guarda datos
```

---

## 🔄 Flujo 3: WhatsApp Entrante

```
Cliente envía mensaje por WhatsApp
       │
       ▼
  POST /api/webhooks/whatsapp (Meta webhook)
       │
       ├─ Busca cliente por whatsapp_numero
       ├─ Inserta whatsapp_mensajes: tipo = 'respuesta_cliente'
       └─ Empuja evento a frontend vía Pusher/SSE:
            { tipo: 'whatsapp_entrante', id_cliente, mensaje }
                 │
                 ▼
  Frontend (Zustand chat store)
       │
       ├─ Toast: "Nuevo mensaje de {nombre}"
       └─ Panel flotante se actualiza en tiempo real
```

---

## 🔄 Flujo 4: Tipificación con Opt-In

```
Asesor en Power Dialer
  │
  ├─ Click2Call → habla con cliente
  └─ Al colgar → modal de tipificación:
       │
       ├─ ¿Contactó?:  SI / NO (buzón, no contesta)
       ├─ Estado:       Interesado / No Interesa / Callback
       ├─ Notas:        [textarea]
       ├─ ¿Alertas Fidelización? [switch]
       │    └─ Si ON → [input WhatsApp +34...]
       └─ Guardar
            │
            ▼
       PATCH /api/pipeline
            │
            ├─ Actualiza pipeline.estado
            ├─ Inserta historial (trigger automático)
            ├─ Si callback → agenda en callback_at
            └─ Si switch ON → dispara flujo Opt-In
```

---

## 🎨 UI Design

### Switch en Desplegable de Cliente

```
┌──────────────────────────────────────────────┐
│ Alertas de Fidelización    [========○] OFF    │
│                                              │
│ Cuando está ON:                              │
│   WhatsApp: [ +34 612 345 678          ]     │
│   Estado Opt-In: ✅ Confirmado               │
│                o ⏳ Pendiente de respuesta    │
│                o ❌ No autorizado             │
│                                              │
│   [ Enviar solicitud Opt-In ]                │
└──────────────────────────────────────────────┘
```

### Panel de Chat Flotante (Zustand)

```typescript
// stores/chat-store.ts
interface ChatState {
  abierto: boolean;
  clienteActual: string | null;
  mensajes: Mensaje[];
  noLeidos: number;
  abrirChat: (idCliente: string) => void;
  cerrarChat: () => void;
  recibirMensaje: (msg: Mensaje) => void;
}
```

- Aparece en esquina inferior derecha
- Diseño tipo modal premium (mismo estilo que Tramitación)
- Botones de copiado directo (DNI, teléfono, WhatsApp)
- Accesible desde cualquier página del CRM

---

## 🔔 Tipos de Notificación

| Tipo | Disparador | Canal | Destino |
|---|---|---|---|
| Alerta Renove | Bot detecta renove + opt-in activo | WhatsApp (Meta) | Cliente |
| Opt-In Request | Asesor activa switch | WhatsApp (Meta) | Cliente |
| Lead Asignado | Supervisor asigna lead | In-App (Pusher/SSE) | Asesor |
| Callback Pendiente | Agenda programa callback | In-App + Toast | Asesor |
| Cliente Responde | Meta webhook entrante | In-App (Pusher/SSE) | Asesor asignado |
| Bot Error | Worker muere / proxy falla | In-App (Admin) | Admin/IT |

---

## 📡 Endpoints (Pendientes de Implementar)

| Ruta | Método | Descripción |
|---|---|---|
| /api/whatsapp/opt-in-request | POST | Dispara plantilla de opt-in |
| /api/whatsapp/send | POST | Envía mensaje manual |
| /api/webhooks/whatsapp | POST | Recibe mensajes de Meta |
| /api/whatsapp/mensajes | GET | Historial por cliente |
| /api/whatsapp/plantillas | GET | Lista plantillas Meta disponibles |

---

## 🛡️ Cumplimiento RGPD

- Doble opt-in obligatorio: el cliente debe responder "SI" explícitamente
- Revocación: responder "BAJA" anula el opt-in inmediatamente
- El trigger de auditoría registra cada cambio de `alertas_fidelizacion`
- Las plantillas Meta incluyen texto legal de protección de datos
- `whatsapp_opt_in_fecha` registra cuándo se dio el consentimiento
