# 📞 VPBX — Integración con Centralita VoIP (v3.0)

> API Base: `https://vpbx.me/api`
> Documentación oficial: https://doc.vpbx.me/admin/
> Actualizado: 03/06/2026 — Estado de integración en submaster

---

## 🧭 ¿Qué es VPBX?

Centralita VoIP en la nube. Proporciona:
- Extensiones SIP por asesor
- Click2Call desde el CRM
- CDR (registro de llamadas)
- Grabación de llamadas
- Webhooks en tiempo real

---

## 🔐 Autenticación

Header: `X-Api-Key: {api_key}`

---

## ✅ Endpoints Implementados

### Click2Call — `POST /api/vpbx/originate`

Archivo: `src/app/api/vpbx/originate/route.ts`
Cliente: `src/lib/vpbx.ts`

```typescript
// Flujo
Frontend (Power Dialer) → POST /api/vpbx/originate
  { extension: "101", numero: "622534699" }
    → VPBX API: originatecall/{ext}/{num}
    → Suena teléfono del asesor
    → Asesor descuelga → VPBX marca al cliente
```

### Webhooks VPBX — `POST /api/webhooks/vpbx`

Archivo: `src/app/api/webhooks/vpbx/route.ts`

Eventos recibidos:
- `RINGING` — Teléfono del asesor está sonando
- `ANSWERED` — Asesor o cliente descuelga
- `HANGUP` — Llamada finalizada

### CDR Sync — `src/lib/vpbx.ts`

Función para sincronizar registros de llamadas desde VPBX a tabla `cdr_vpbx`.

---

## 🟡 Pendiente

| Tarea | Detalle |
|---|---|
| Redis para webhooks | Responder HTTP 200 en <50ms, procesar cola después |
| Rate limiting | Máximo 1 llamada cada 5s por asesor |
| Power Dialer funcional | Página actual es placeholder |
| Grabaciones → R2 | MP3 con ciclo de vida 6 meses, URLs prefirmadas |
| Motor de re-análisis | Cruzar CDR + pipeline → decisión automática |
| Pruebas reales | Conectar VPBX real, probar Click2Call |

---

## 📊 Tabla `cdr_vpbx` (Ya creada)

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
    src TEXT, dst TEXT,
    recording BOOLEAN DEFAULT false,
    raw_data JSONB DEFAULT '{}',
    sincronizado TIMESTAMPTZ DEFAULT now()
);
```

---

## 🔮 Flujo Completo (Cuando esté Redis)

```
VPBX Webhook → POST /api/webhooks/vpbx
  → Redis LPUSH (inmediato, <50ms)
  → Responder HTTP 200
  → Worker interno: Redis BRPOP → procesar → PostgreSQL
```
