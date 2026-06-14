# Oratioo CX — Plan de Desarrollo

### Automatización Inteligente para Orange Pangea

> **👤 Autor:** Jeff Steven Gil Toribio
> **📅 Fecha:** 6 de Junio de 2026
> **📋 Propósito:** Documento detallado de todo lo que el sistema va a incluir cuando esté terminado.

---

## 🛠️ Stack Tecnológico

> Las herramientas sobre las que se construye el sistema.

### 🏗️ Arquitectura Híbrida

El sistema usa un modelo **híbrido** por una razón de costo:

```
🖥️ PC LOCAL (Windows)        ☁️ VPS (Hetzner, Alemania)
│                                 │
├─ Bot Python + Playwright        ├─ Next.js (CRM + API)
│  • Entra a Orange Pangea        ├─ PostgreSQL (base de datos)
│  • Usa Chrome automatizado      ├─ Redis (colas)
│  • 20 proxies españoles         ├─ VPBX (grabaciones 1 año nativo)
│  • Extrae datos de DNIs         └─ Nginx + SSL
│
└─ Envía datos vía API ──────────→  Recibe y almacena
```

**¿Por qué el bot en PC local y no en el VPS?**

- Orange Pangea detecta IPs de datacenter y las bloquea. Una IP residencial/local española no levanta sospechas.
- Un VPS con suficiente RAM/CPU para correr Chrome + 5 workers simultáneos costaría 80-150€/mes. Una PC dedicada ya la tienes.
- El bot solo necesita internet y estar encendido. No requiere IP pública ni dominio.
- Si el bot se cae, el CRM sigue funcionando. Si el VPS se cae, el bot sigue extrayendo y guarda en cola local.
- **Costo del bot: 0€额外/mes** (usa una PC existente).

| Capa                   | Tecnología                         | ¿Por qué?                                                          |
| ---------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| **Base de datos**      | PostgreSQL 16                      | Robusta, gratuita, escala a millones de registros                  |
| **Backend + Frontend** | Next.js 15 + TypeScript + Tailwind | Moderno, rápido, seguro. Mismo código para web y API               |
| **Autenticación**      | NextAuth.js v5 + bcrypt            | Login seguro sin depender de servicios externos                    |
| **Bot (PC local)**     | Python 3 + Playwright + Chromium   | Automatiza navegador para entrar a Orange. Corre en PC con Windows |
| **Telefonía**          | VPBX API                           | Click2Call, grabaciones, CDR. Centralita virtual profesional       |
| **Mensajería**         | Meta WhatsApp Business API         | Envío de mensajes y plantillas oficiales de WhatsApp               |
| **Servidor (nube)**    | Hetzner CPX41 (VPS)                | 8 vCPU, 16 GB RAM, 160 GB SSD. ~20€/mes                            |
| **Deploy**             | Plesk + Nginx                    | Despliegue automático, SSL gratuito, backups                       |
| **Almacenamiento**     | VPBX (nativo)                      | Grabaciones y archivos. VPBX retiene 1 año.  |
| **Colas**              | Redis                              | Gestiona trabajos pendientes sin saturar la BD                     |

> Todas las tecnologías son open source o tienen costo muy bajo. Nada de licencias caras.

---

## 📖 Minidiccionario

| Término          | Qué significa                                                       |
| ---------------- | ------------------------------------------------------------------- |
| **Bot**          | Programa que entra solo a Orange y extrae datos de clientes         |
| **Lead**         | Cliente potencial al que vamos a llamar                             |
| **CIMA**         | Cliente premium (los que más gastan en Orange)                      |
| **Renove**       | Oferta de renovación de Orange al cliente                           |
| **Pipeline**     | El camino del lead: asignado → contactado → venta                   |
| **Power Dialer** | Discador: el asesor llama con un clic, sin marcar números           |
| **VPBX**         | Centralita telefónica virtual que gestiona las llamadas             |
| **Dashboard**    | Panel de control con indicadores visuales                           |
| **Scoring**      | El sistema analiza y pone nota a cada lead (A+ = el mejor)          |
| **Forecast**     | Predicción de cuánto se va a vender los próximos días               |
| **Wrap-up**      | Tiempo que tarda el asesor en registrar el resultado de una llamada |
| **CDR**          | Registro de llamadas: quién, a quién, cuánto duró                   |
| **API**          | Forma en que dos sistemas se comunican entre sí                     |
| **Endpoint**     | Una "puerta" del sistema para enviar o recibir datos                |
| **VPS**          | Servidor en la nube donde corre el sistema en producción            |
| **JSONB**        | Formato flexible para guardar datos de distintos tipos              |
| **Proxy**        | Intermediario que simula que el bot está en España                  |

---

## ✅ FASE 1-2 — ENTREGADO: El Bot de Extracción

```
████████████████████░░░░░░░░░░░░░░░░░░░░░░░░  40% completado
```

### Lo que ya funciona

**El bot entra a Orange Pangea automáticamente** y extrae todos los datos de cada DNI sin intervención humana:

- **Búsqueda por DNI** — escribe el documento, pulsa buscar, detecta si el cliente existe
- **Datos de cabecera** — nombre, dirección, teléfono, tipo de cliente
- **Líneas del cliente** — itera todas las líneas, con paginación
- **5 pestañas por línea** — Destacadas, Renove, Bonos y Descuentos, Cambio Tarifa, SVA
- **Detección CIMA** — identifica clientes premium por etiquetas en Orange
- **Detección Renove** — 6 tipos de oferta: Mixto Max Descuento 🟢, Mixto Descuento 🔵, Mixto Mejor Precio 🟠, Mixto 🟡, Multidispositivo ⚪, Pago Único ⚪
- **Estado de línea** — si está activa o inactiva (por color en el sistema)
- **Consumo, permanencia, VAP, facturas** — datos económicos de cada línea

### Infraestructura del bot

- **Multi-máquina** — puede correr en varias PCs simultáneamente
- **20 proxies españoles** — cada worker usa una IP distinta de España
- **Rescate automático** — si un worker se cae, otro toma sus DNIs pendientes
- **Coordinador central** — reparte el trabajo entre máquinas
- **Base de datos PostgreSQL** — todos los datos extraídos se guardan estructurados

**Probado con datos reales de Orange Pangea.**

---

## 📋 FASE 3 — CRM y Dashboards (a construir: 4-5 semanas)

Una vez que el bot extrae los datos, necesitamos un sistema donde los asesores trabajen.

### Pipeline Comercial

- **7 estados** por los que pasa un lead: pendiente → contactado → interesado → negociación → venta → tramitado → activado
- **2 estados negativos** — no_interesa, no_contesta
- **Sub-estados** — no_llamar, fallecido, empresa_cerrada, fuera_cobertura, ya_es_cliente
- **Asignación de leads** — el supervisor reparte leads a su equipo
- **Rondas de llamada** — cada lead se intenta hasta 5 rondas, con múltiples números por ronda
- **Cooldown** — 48 horas entre intentos al mismo lead para no saturar
- **Callback agendado** — el asesor programa una llamada para otra fecha/hora

### Documentos

- Subida de archivos .csv y .txt con DNIs
- Soporte para Excel (.xlsx/.xls)
- Cola de procesamiento: pendientes, en progreso, completados
- Deduplicación automática al subir lotes

### Dashboards

- **Dashboard Asesor** — ve sus leads asignados, su pipeline, su actividad del día
- **Dashboard Supervisor** — panel en vivo de su equipo, estadísticas, ranking
- **Dashboard Jefe de Área** — funnel completo de ventas, comparativa entre equipos (España 🇪🇸 y Perú 🇵🇪)
- **Dashboard Back Office** — gestión de tramitación de ventas
- **Dashboard Admin** — control técnico del sistema

> El sistema está diseñado para operar con múltiples equipos en distintos países. Cada asesor pertenece a un equipo (España o Perú) y los supervisores ven solo a su equipo. El jefe de área ve ambos.

---

## 📞 FASE 4 — Discador Telefónico (a construir: 3 semanas)

### Power Dialer

- **Click2Call** — el asesor llama con un solo clic, sin marcar números
- **Integración con VPBX** — conectado a la centralita telefónica
- **Panel en vivo** — el supervisor ve quién está llamando en tiempo real
- **Grabaciones** — todas las llamadas quedan grabadas
- **Tipificación** — después de cada llamada, el asesor registra el resultado
- **Navegación entre leads** — anterior/siguiente, auto-avance

🔑 _Requiere: acceso a la API de VPBX_

---

## 💬 FASE 5 — WhatsApp Business (a construir: 2-3 semanas)

- **Envío de mensajes** desde el mismo CRM, sin salir a WhatsApp
- **Plantillas pre-aprobadas** de Meta para mensajes comerciales
- **Chat integrado** — historial de conversación dentro del Power Dialer
- **Detección automática** — si el bot encuentra un Renove valioso, el sistema puede mandar WhatsApp automáticamente
- **Campos RGPD** — consentimiento del cliente, fecha de opt-in

🔑 _Requiere: cuenta de Meta Business_

---

## 🧠 FASE 6 — Inteligencia Comercial (a construir: 3-4 semanas)

### Scoring de Leads (A+ a E)

El sistema analizará cada cliente extraído y le pondrá una nota basada en 8 factores:

| Factor                     | Qué evalúa                      | Puntos           |
| -------------------------- | ------------------------------- | ---------------- |
| CIMA                       | Si Orange lo marcó como premium | +25              |
| Renove Mixto Max Descuento | La mejor oferta de renovación   | +30              |
| Renove Mixto Descuento     | Segunda mejor oferta            | +25              |
| Renove Mixto Mejor Precio  | Tercera mejor oferta            | +20              |
| Renove Mixto               | Oferta básica                   | +15              |
| Líneas extra               | Más líneas = más oportunidad    | +2 c/u (max +10) |
| Consumo alto               | +80€/mes gasta                  | +10              |
| Permanencia                | Si está atado a Orange          | -5               |
| Facturas impagadas         | Mal pagador                     | -5 c/u           |

**Resultado:** A+ (90+) → A (75+) → B (55+) → C (35+) → D (15+) → E (0+)

Los asesores siempre llamarán primero a los A+.

#### Doble Sistema de Scoring

Además del scoring de Orange (para leads NUEVOS), el sistema tendrá un **segundo scoring por historial de contacto** (criterios de Yone) para leads ya trabajados:

| Factor                       | Qué evalúa                   | Puntos |
| ---------------------------- | ---------------------------- | ------ |
| Contesta teléfono y WhatsApp | Contactabilidad total        | +40    |
| Compra recurrente (2+ veces) | Cliente fiel                 | +35    |
| Primera compra               | Ya compró una vez            | +25    |
| Persona decisoria            | No es un contacto secundario | +10    |
| 3+ intentos sin respuesta    | No contesta nunca            | -20    |
| 1+ intentos sin respuesta    | Señal negativa               | -5     |

**Resultado:** A+ (75+) → A (55+) → B (35+) → C (15+) → D (<3 intentos, sin contacto) → E (3+ intentos, sin respuesta)

### Métricas de Operadores

- **Rendimiento por asesor** — ventas, contactabilidad, efectividad, tasa de contestación
- **Ocupación** — del tiempo conectado, cuánto está realmente hablando
- **Wrap-up** — tiempo que tarda en registrar después de colgar
- **Tendencias** — comparativa semanal: ¿esta semana mejor o peor que la anterior?

### Gamificación (Cinturones 🥋)

Sistema de niveles para motivar al equipo (diseño de Yone):

- ⚫ **Faixa Preta** — 50+ ventas/mes (élite)
- 🟤 **Marrón** — 30+ ventas/mes (senior)
- 🔵 **Azul** — 15+ ventas/mes (sólido)
- 🥋 **Blanco** — recién empieza

Cada nivel requiere también cumplir mínimos de contactabilidad, efectividad y calidad QA.
El sistema notifica automáticamente al supervisor cuando un asesor sube de cinturón.

### Forecast de Ventas

- Predicción de cuánto se va a vender los próximos 7 días
- Basado en el histórico real de ventas
- Ajuste automático por día de semana (lunes-viernes normal, sábado -20%, domingo -50%)
- Intervalos de confianza (rango mínimo-máximo)

### Reportes

- Reportes en PDF imprimibles con un clic
- Datos completos: ventas, ranking, scoring, actividad diaria
- Listos para imprimir o enviar por email

### Tabla de Compras

- Registro de cada venta: fecha, producto, importe, comisión, asesor
- Trazabilidad del origen (manual, SICA, automático)
- Integración futura con SICA para sincronización bidireccional

---

## 📐 Metodología de Cálculo — Así se calcula cada indicador

> Para que sepas exactamente qué mide cada número y cómo se obtiene.

### 📊 KPIs de Pipeline

#### Contactabilidad

Mide la calidad de los datos. De cada 100 leads que repartes, ¿a cuántos logras contactar?

```
Contactabilidad (%) = (Leads contactados / Leads asignados) × 100

Ejemplo: 150 contactados de 500 asignados = 30% de contactabilidad
Interpretación: < 20% → datos malos | 30-50% → normal | > 50% → excelente
```

#### Efectividad (Tasa de conversión sobre contactados)

Mide la habilidad del asesor. De los que SÍ contestan, ¿cuántos compran?

```
Efectividad (%) = (Ventas / Leads contactados) × 100

Ejemplo: 30 ventas de 150 contactados = 20% de efectividad
Interpretación: < 10% → bajo | 15-25% → normal | > 25% → estrella
```

#### Tasa de Conversión Global

El KPI más importante. De todo lo que entra, ¿cuánto se convierte en venta?

```
Tasa de conversión (%) = (Ventas totales / Leads asignados totales) × 100

Ejemplo: 30 ventas de 500 asignados = 6% de conversión global
```

#### Tasa de Contestación

De todas las llamadas que se hacen, ¿cuántas son contestadas?

```
Tasa de contestación (%) = (Llamadas contestadas / Total de llamadas) × 100

Ejemplo: 200 contestadas de 400 llamadas = 50%
Interpretación: < 30% → horarios malos | 40-60% → normal | > 60% → excelente
```

---

### ⏱️ Métricas de Tiempo

#### Wrap-up (Tiempo de codificación)

Cuánto tarda el asesor en registrar el resultado después de colgar.

```
Wrap-up = timestamp(tipificación) - timestamp(fin de llamada)

Se calcula en segundos. Se promedia para todos los asesores.

Ejemplo:
  - Llamada termina a las 10:05:00
  - Asesor tipifica a las 10:06:30
  - Wrap-up = 90 segundos (1min 30s)

Interpretación: < 60s → eficiente | 60-120s → normal | > 180s → lento
```

#### Tiempo hasta primera llamada

Cuánto pasa desde que se asigna un lead hasta que el asesor lo llama por primera vez.

```
Tiempo 1ª llamada = timestamp(primera llamada) - timestamp(asignación)

Se promedia para todos los leads del período.

Interpretación: < 30min → excelente | 30min-2h → normal | > 4h → lead olvidado
```

---

### 📞 Métricas de Ocupación

#### Ocupación del asesor

Del tiempo que el asesor está conectado a la centralita, ¿cuánto está realmente hablando?

```
Ocupación (%) = (Segundos hablados / Segundos conectado) × 100

Segundos hablados (billsec) = suma de la duración real de todas las llamadas (solo cuando contestan)
Segundos conectado (duration) = suma del tiempo total incluyendo tono de llamada

Ejemplo:
  - Asesor conectado 4 horas (14,400 segundos)
  - Tiempo hablando: 2.5 horas (9,000 segundos)
  - Ocupación = (9,000 / 14,400) × 100 = 62.5%

Interpretación: < 40% → muchas pausas | 50-70% → normal | > 75% → saturado
```

---

### 🎯 Scoring de Leads (cómo se calcula la nota A+ a E)

Cada lead recibe una puntuación de 0 a 100 basada en 8 factores objetivos extraídos de Orange:

| #   | Factor                         | Fuente del dato      | Cómo suma/resta                                  |
| --- | ------------------------------ | -------------------- | ------------------------------------------------ | -------------- |
| 1   | **Base**                       | Todos los leads      | Arrancan con 20 puntos                           |
| 2   | **CIMA**                       | Etiqueta en Orange   | Si lo tiene: **+25 puntos**                      |
| 3   | **Renove Mixto Max Descuento** | Pestaña Renove       | Si lo tiene: **+30 puntos** (máxima prioridad)   |
| 4   | **Renove Mixto Descuento**     | Pestaña Renove       | Si lo tiene: **+25 puntos**                      |
| 5   | **Renove Mixto Mejor Precio**  | Pestaña Renove       | Si lo tiene: **+20 puntos**                      |
| 6   | **Renove Mixto**               | Pestaña Renove       | Si lo tiene: **+15 puntos**                      |
| 7   | **Otro Renove**                | Pestaña Renove       | Si tiene cualquier otro: **+8 puntos**           |
| 8   | **Cantidad de líneas**         | Lista de líneas      | +2 puntos por cada línea extra (máximo +10)      |
| 9   | **Consumo mensual**            | Datos de línea       | > 80€: **+10**                                   | 50-80€: **+5** |
| 10  | **Permanencia**                | Estado de línea      | Si tiene permanencia (está atado): **-5 puntos** |
| 11  | **Facturas impagadas**         | Datos de facturación | -5 puntos por cada factura pendiente             |
| 12  | **Antigüedad**                 | Fecha de alta        | Cliente con > 2 años: **+3 puntos**              |

```
Puntuación final = 20 + CIMA + mejor_tipo_renove + (líneas_extra × 2) + bonus_consumo - penalización_permanencia - (facturas × 5) + bonus_antigüedad

Se ajusta al rango 0-100 (nunca negativo, nunca más de 100).

Clasificación final:
  A+  = 90-100 puntos  →  Llamar INMEDIATAMENTE
  A   = 75-89 puntos   →  Muy alta prioridad
  B   = 55-74 puntos   →  Alta prioridad
  C   = 35-54 puntos   →  Prioridad media
  D   = 15-34 puntos   →  Baja prioridad
  E   = 0-14 puntos    →  No perder tiempo (llamar solo si sobra)
```

**¿De dónde salen los datos?** El bot los extrae directamente de Orange Pangea cuando procesa cada DNI. El scoring se calcula automáticamente y se actualiza cada vez que el bot re-extrae un cliente.

---

### 🔮 Forecast de Ventas (cómo se predice el futuro)

El sistema usa un **modelo basado en pipeline**, no solo en histórico. Esto significa que el forecast se adapta a la realidad operativa: si el bot extrajo muchos DNIs, el forecast sube. Si extrajo pocos, baja.

#### Fórmula principal

```
Forecast diario = Leads_disponibles × Contactabilidad_30d × Efectividad_30d

Donde:
  • Leads_disponibles = leads asignados activos + DNIs extraídos por el bot el día anterior
  • Contactabilidad_30d = media móvil del % de leads contactados (últimos 30 días)
  • Efectividad_30d = media móvil del % de contactados que compran (últimos 30 días)

Ejemplo realista:
  200 leads disponibles × 40% contactabilidad × 20% efectividad = 16 ventas estimadas hoy
```

#### ¿Por qué este modelo es mejor?

A diferencia de un simple promedio histórico, este modelo:

- **Reacciona al bot** — si el bot extrajo el doble de DNIs, el forecast sube proporcionalmente
- **Reacciona a la calidad** — si la contactabilidad cae (datos malos), el forecast baja
- **Usa datos reales del sistema** — leads en pipeline, tasas históricas, no números inventados
- **Se adapta solo** — no necesita ajustes manuales

#### Intervalo de confianza

```
En vez de adivinar, usamos la variabilidad real de los factores:

  Límite inferior = Leads × (Contactab − σ_contactab) × (Efectiv − σ_efectiv)
  Límite superior = Leads × (Contactab + σ_contactab) × (Efectiv + σ_efectiv)

Ejemplo:
  Contactab = 40% ± 8%  |  Efectiv = 20% ± 5%  |  Leads = 200
  → Estimado: 16 ventas  |  Rango: 10 — 24 ventas
```

#### Ajuste por día de la semana

```
Lunes a Viernes → 100% del cálculo (días laborables)
Sábado y Domingo → 0 (no se llama, restricciones legales en España)

Aplica para ambos equipos: España 🇪🇸 y Perú 🇵🇪
```

#### Ejemplo de una semana completa

```
Leads en pipeline: 850  |  Contactabilidad 30d: 42%  |  Efectividad 30d: 19%

  Lun: ~16  |  Mar: ~16  |  Mié: ~16  |  Jue: ~15  |  Vie: ~15  |  Sáb: 0  |  Dom: 0
  Total forecast: ~78 ventas esta semana
  Rango: 54 — 105 ventas
```

> 💡 El forecast se actualiza cada día con los datos reales del sistema. Si el bot extrae más leads, el número sube. Si la contactabilidad mejora, también. No es un número fijo — refleja la realidad operativa.

---

### 🥋 Cinturones (cómo se sube de nivel)

Cada mes, el sistema evalúa a cada asesor en 4 dimensiones y le asigna un cinturón (diseño de Yone):

| Cinturón       | Ventas mínimas/mes | Contactabilidad mínima | Efectividad mínima | Calidad QA mínima |
| -------------- | ------------------ | ---------------------- | ------------------ | ----------------- |
| ⚫ Faixa Preta | 50                 | 70%                    | 35%                | 8.0/10            |
| 🟤 Marrón      | 30                 | 60%                    | 25%                | 7.0/10            |
| 🔵 Azul        | 15                 | 50%                    | 15%                | 5.0/10            |
| 🥋 Blanco      | 0                  | —                      | —                  | —                 |

```
Regla: el asesor obtiene el cinturón MÁS ALTO donde cumple TODOS los requisitos.

Ejemplo: Asesor con 22 ventas, 62% contactabilidad, 28% efectividad, 7.2 calidad
  → Faixa Preta: ❌ (22 < 50)
  → Marrón: ❌ (22 < 30)
  → Azul: ✅ (22 ≥ 15, 62% ≥ 50%, 28% ≥ 15%, 7.2 ≥ 5.0)
  → Cinturón AZUL 🔵
  → Le faltan 8 ventas para subir a Marrón
```

El sistema notifica automáticamente al supervisor cuando un asesor sube de cinturón.

---

### ⭐ QA — Control de Calidad

Cada llamada evaluada recibe una puntuación de 1 a 5 en 5 criterios:

| Criterio       | Qué evalúa                                              | Peso |
| -------------- | ------------------------------------------------------- | ---- |
| **Speech**     | Saludo, presentación, tono de voz, claridad             | 1-5  |
| **Objeciones** | Cómo maneja los "no", "estoy ocupado", "no me interesa" | 1-5  |
| **Cierre**     | Concreta siguiente paso, deja callback, confirma datos  | 1-5  |
| **Compliance** | Cumple normativa, no miente, no promete lo que no puede | 1-5  |
| **Empatía**    | Escucha, se pone en el lugar del cliente, no es robot   | 1-5  |

```
Puntaje total = Speech + Objeciones + Cierre + Compliance + Empatía
Máximo posible: 25 puntos
Mínimo: 5 puntos

Ejemplo: 4 + 3 + 5 + 5 + 4 = 21/25 = 84% de calidad

El promedio de todas las evaluaciones del mes es la "Calidad QA" del asesor.
```

---

### 📈 Dashboard de Rendimiento — KPIs consolidados

El dashboard de rendimiento unifica todos los indicadores en un solo lugar:

```
Período: configurable (7, 15, 30, 90 días)

KPIs globales:
  • Total asignados    → suma de leads repartidos en el período
  • Total contactados  → suma de leads donde hubo contacto
  • Total ventas       → suma de ventas cerradas
  • Contactabilidad    → (contactados / asignados) × 100
  • Efectividad        → (ventas / contactados) × 100
  • Tasa contestación  → (llamadas contestadas / total llamadas) × 100
  • Ocupación          → (segundos hablados / segundos conectado) × 100
  • Calidad promedio   → media de puntuaciones QA del período

Ranking por asesor:
  • Se ordena por ventas (descendente)
  • Incluye todas las métricas individuales
  • Top 3 reciben medalla 🥇🥈🥉
  • Filtrable por equipo (España 🇪🇸 / Perú 🇵🇪)
  • Cada supervisor ve solo su equipo; el jefe ve ambos

Tendencias:
  • Comparación semana actual vs semana anterior
  • Delta (%) = ((semana_actual - semana_anterior) / semana_anterior) × 100
  • Flecha verde ↑ si mejora, roja ↓ si empeora
```

> Todos los indicadores se calculan en tiempo real consultando la base de datos. No hay datos inventados ni hardcodeados. Si un día hay 0 ventas, el dashboard muestra 0.

---

## 🔒 FASE TRANSVERSAL — Calidad y Seguridad

### Sistema QA (Control de Calidad)

- Rúbrica de 5 criterios para evaluar llamadas: Speech, Objeciones, Cierre, Compliance, Empatía
- Puntaje automático de 1 a 25
- Dashboard de calidad por asesor

### Seguridad

- Contraseñas seguras (mínimo 8 caracteres, 1 mayúscula, 1 número)
- Cada rol ve solo lo que le corresponde
- Auditoría de toda la actividad en el sistema
- Protección de datos personales (RGPD)

---

## 🚀 FASE 7 — Producción (a construir: 3 semanas)

- Contratación de servidor VPS Hetzner (~20€/mes) para el CRM, BD y API
- El bot se queda en PC local (no migra al VPS — más barato y evita bloqueos de Orange)
- Instalación de PostgreSQL + Redis en el VPS
- Deploy de la aplicación web con dominio y SSL
- Backups automáticos diarios
- Sistema de colas Redis para trabajos pendientes
- Almacenamiento de grabaciones en VPBX (1 año nativo)
- Pruebas de carga: simular 10+ workers y 50+ usuarios simultáneos
- Capacitación a los equipos de asesores y supervisores
- Documentación final y entrega

---

## ⏱️ Cronograma Completo

```
FASE 1-2  ✅  BOT               ████████   YA ENTREGADO
FASE 3    ⬜  CRM Y DASHBOARDS   ██████     4-5 semanas
FASE 4    ⬜  DISCADOR VPBX      ████       3 semanas
FASE 5    ⬜  WHATSAPP           ███        2-3 semanas
FASE 6    ⬜  INTELIGENCIA       ██████     3-4 semanas
FASE 7    ⬜  PRODUCCIÓN         ████       3 semanas
```

```
Barra de progreso:

YA LISTO     ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  40%
PRÓXIMA      ████████████████████████░░░░░░░░░░░░░░░░░░  60%
FINAL        ████████████████████████████████████████████  100%

Tiempo total estimado hasta producción: ~3 meses
```

---

## 🔑 Lo que se necesita

| Recurso                      | Para qué                              | Estado    |
| ---------------------------- | ------------------------------------- | --------- |
| API de VPBX                  | Construir el discador (Fase 4)        | Pendiente |
| Cuenta Meta Business         | Integrar WhatsApp (Fase 5)            | Pendiente |
| VPS (~20€/mes)               | Servidor para CRM + BD + API (Fase 7) | Pendiente |
| PC local con Windows         | Ejecutar el bot (ya disponible)       | ✅ Listo  |
| Proxies españoles (~15€/mes) | Para que el bot aparezca en España    | Pendiente |

---

## 👥 Roles del Sistema — Qué puede hacer cada persona

> Cada rol ve SOLO lo que necesita. Nadie accede a datos que no le corresponden.

---

### 🎧 ASESOR — El que llama y vende

**Dashboard Asesor** (pantalla principal al entrar)

- Ve sus leads asignados con contadores: pendientes, en gestión, finalizados
- Cards de resumen: Mis Leads, CIMA detectados, Renove disponibles, Contactados hoy
- Actividad del día: timeline de cambios de estado que hizo hoy
- Alerta de "leads arrastrados" — si tiene leads sin tocar hace +3 días
- Filtros de período: Hoy, 7 días, Este mes, Trimestre, 6 meses

**Power Dialer** (su herramienta principal de trabajo)

- Lista de leads asignados con orden de prioridad (scoring)
- Click2Call: hace clic en un botón y el sistema llama automáticamente
- Ve los datos clave del lead antes de llamar: nombre, CIMA, Renove, consumo
- Si el lead tiene múltiples teléfonos, puede elegir cuál marcar
- Panel expandible con detalle de líneas: producto, estado, permanencia, consumo
- Después de cada llamada, ventana para tipificar el resultado
- Botones de acción rápida: Contactado, Interesado, Negociación, Venta, No Interesa, No Contesta
- Botón "Agendar callback" — programa fecha y hora para volver a llamar
- Botón de WhatsApp si el cliente tiene número
- Navegación entre leads: anterior/siguiente, auto-avance al tipificar

**Agenda**

- Callbacks agrupados por día: Hoy, Mañana, fechas específicas
- Cada callback muestra: nombre del cliente, teléfono, hora programada
- Vencidos en rojo con minutos de retraso
- Botones de estado rápido para actualizar sin salir de la agenda
- "No Contesta" NO elimina el callback (el lead sigue en agenda para reintentar)
- Badge en menú lateral con el número de callbacks de hoy

**Wikiratioo** (formación)

- 8 módulos de formación: Ventas, Productos, Objeciones, Técnico, Compliance, Onboarding, Procesos, FAQ
- Videos de YouTube integrados
- Búsqueda por texto en todos los módulos
- Navegación por categorías
- Seguimiento de progreso (qué módulos completó)

**Ranking** (solo ve su posición)

- Su posición en el ranking del equipo
- Comparación: sus ventas vs el promedio del equipo

**Metas** (sus propios objetivos)

- Ve su meta de ventas y contactos del mes
- Barra de progreso visual
- Comparación con el objetivo

**Alertas**

- Ve sus propias alertas: leads CIMA sin gestionar, Renove sin contactar
- Agrupadas: Críticas (+7d), Pendientes (3-7d), Recientes (1-3d)

**Perfil**

- Cambiar su contraseña

> El asesor NUNCA ve leads de otros asesores. Solo ve lo que le asignó su supervisor.

---

### 👁️ SUPERVISOR — Gestiona su equipo

**Dashboard Supervisor** (pantalla principal)

- **LivePanel** — panel en vivo: qué asesor está llamando, quién está en pausa, quién desconectado
- Drill-down por asesor: clic en un asesor → ve sus leads y actividad
- Reasignación rápida de leads entre asesores
- KPIs del equipo en tiempo real

**Rendimiento** (métricas del equipo)

- Tabla de ranking con todos los asesores a su cargo
- Columnas: posición, nombre, ventas, contactados, contactabilidad%, efectividad%, tasa de contestación%, ocupación%, wrap-up, tiempo hasta 1ª llamada, calidad QA
- Medallas 🥇🥈🥉 para el top 3
- **Cinturones** 🥋 — ve qué cinturón tiene cada asesor y cuánto le falta para el siguiente
- **Tendencias** — gráficos de ventas diarias, contactos, comparativa semanal (delta ↑↓)
- **Heatmap** — actividad por hora del día
- Export CSV de todos los datos
- Filtros por fecha y por equipo (si supervisa varios)

**Estadísticas**

- KPIs agregados: total asignados, contactados, ventas, efectividad, contactabilidad
- Tiempos operativos: wrap-up promedio, hasta 1ª llamada
- Llamadas: total, contestadas, no contestan, buzón
- Gráfico de actividad por día
- Tabla de rendimiento por asesor con % de éxito
- Export CSV

**Power Dialer**

- Puede ver los leads de TODO su equipo, no solo los propios
- Filtro por asesor específico
- Puede escuchar grabaciones de llamadas

**Agenda**

- Ve los callbacks de todo su equipo
- Puede reasignar callbacks entre asesores

**Clientes**

- Tabla completa con todos los clientes procesados por el bot
- Columnas: nombre, DNI, tipo, líneas, CIMA, Renove, fecha de extracción
- Filtros: por fecha, por CIMA (sí/no), por tipo Renove
- Fila expandible: clic en un cliente → ve sus líneas, consumo, permanencia
- Export CSV / Excel

**Asignar Leads**

- Ve los clientes extraídos que aún no tienen asesor
- Selección múltiple con checkboxes
- Asignación a uno o varios asesores (round-robin automático)
- Filtro por equipo (España / Perú)

**Auditoría**

- Timeline de toda la actividad del equipo
- Filtros: por fecha, por tipo (llamada, tipificación, asignación), por asesor
- Solo ve clientes procesados (no ruido de "no cliente")

**Metas**

- Tabla con todos los asesores del equipo
- Columnas: posición (#), nombre, ventas, meta de ventas, contactos, progreso con barra
- Top performer destacado con trofeo 🏆
- Filtro por equipo

**Alertas**

- Ve todas las alertas de su equipo
- Agrupadas por urgencia: Críticas 🔴, Pendientes 🟡, Recientes
- Badge en menú lateral con contador
- Recibe notificaciones automáticas cuando:
  - Un asesor no vende en todo el día
  - Un asesor no hace llamadas (pasado el mediodía)
  - Un asesor tiene demasiados "No Interesa" (>40%)
  - Un asesor se recupera (vende después de un mal día)
  - Un asesor sube de cinturón 🏅
  - 📉 La contactabilidad del equipo cae más del 15% vs la semana anterior
  - 📉 La conversión (contacto→venta) cae más del 20% vs la semana anterior

**Calidad (QA)**

- Dashboard de evaluaciones de su equipo
- Puede evaluar grabaciones de llamadas
- Rúbrica de 5 criterios (Speech, Objeciones, Cierre, Compliance, Empatía)
- Resumen por asesor con puntuación promedio

**Ranking**

- Ranking completo de su equipo ordenable por ventas, contactados, tasa
- Su posición resaltada

**Perfil**

- Cambiar su contraseña

> El supervisor ve SOLO a los asesores que tiene asignados. Si supervisa España, no ve Perú (a menos que sea supervisor de ambos).

---

### 📊 JEFE DE ÁREA — Visión estratégica

**Dashboard Jefe** (pantalla principal)

- **Funnel de pipeline** — visual: completados → sin asignar → asignados → contactados → ventas
- **Forecast de ventas** — predicción de ventas próxima semana laboral con barras y estimado total
- **Scoring de leads** — distribución A+ a E, cuántos leads top tiene la base
- **Salud de base de datos** — % de datos limpios, aviso si hay degradación
- **Comparativa por equipo** — tabla: España vs Perú, asesores, pendientes, contactados, ventas, efectividad, QA
- **Estado del bot** — workers activos, cola pendiente, máquinas online
- Acceso rápido: botones para Asignar Leads, Estadísticas, Auditoría
- **Parámetros operativos** — puede cambiar metas de ventas, contactos, cooldown, intentos máximos, días de liberación. Un solo lugar, aplica a todo el sistema.

**Rendimiento**

- Misma vista que el supervisor pero con TODOS los equipos
- Filtro por equipo (España, Perú, ambos)
- Cinturones de todos los asesores de la empresa
- Tendencias globales
- Export CSV

**Estadísticas**

- KPIs globales de toda la operación
- Filtro por equipo
- Gráficos, export CSV

**Clientes**

- Ve TODOS los clientes de todos los equipos
- Mismos filtros que el supervisor
- Export CSV

**Asignar Leads**

- Puede asignar a cualquier asesor de cualquier equipo
- Vista de "sin asignar" global

**Proyectos**

- CRUD de proyectos: puede crear, editar, desactivar proyectos
- Cada proyecto tiene sus propios clientes, pipeline, configuraciones
- Ejemplo: Orange Pangea, Repsol Luz y Gas

**Metas** 🎯

- Puede establecer metas diferentes para España y Perú
- Ve el progreso de todos los equipos

**Alertas**

- Ve alertas de toda la empresa
- Puede configurar thresholds de alertas

**Calidad (QA)**

- Dashboard de calidad global
- Ve evaluaciones de todos los equipos

**Usuarios**

- CRUD de usuarios: crear, editar, desactivar
- Asignar roles, equipos, supervisores, extensión VPBX

**Auditoría**

- Timeline completo de toda la actividad en el sistema

**Perfil**

- Cambiar su contraseña

> El jefe de área ve todo, pero no tiene acceso a infraestructura técnica (bots, proxies, máquinas). Eso es solo para IT.

---

### 📋 BACK OFFICE — Tramitación de ventas

**Dashboard Back Office**

- Resumen de ventas pendientes de tramitar
- Contadores: pendientes, en proceso, completadas
- Acceso rápido a tramitación

**Tramitación**

- Lista de ventas cerradas por los asesores
- Cada venta tiene un workflow: pendiente de documentación → en revisión → enviado a Orange → activado
- Puede subir documentos requeridos por Orange para activar la línea
- Historial de cada trámite

**Clientes** (solo lectura)

- Puede consultar datos de clientes para verificar documentación
- No puede modificar datos

**Agenda** (solo lectura)

- Ve callbacks relacionados con ventas en trámite

**Wikiratioo**

- Módulos de formación sobre procesos de tramitación

**Perfil**

- Cambiar su contraseña

> Back office NO llama, NO asigna leads, NO ve estadísticas. Solo tramita.

---

### 🔧 IT — Infraestructura técnica

**Dashboard Admin**

- Estado de todas las máquinas conectadas
- Workers activos por máquina
- Proxies en uso
- Errores del bot

**Infraestructura**

- **Proxies** — agregar, eliminar, copiar proxies. Formato webshare: ip:puerto:usuario:contraseña
- **Máquinas** — registrar nuevas PCs, asignar workers por máquina, ver estado (online/offline)
- **Workers** — monitorear workers activos, ver logs
- Importación masiva de proxies

**Bots (Apps)**

- Control remoto de bots: iniciar, detener, pausar, reanudar
- Comandos por máquina destino
- Historial de comandos enviados
- Cola de DNIs: pendientes, en progreso, completados

**Documentos**

- Subida de archivos .csv/.txt/.xlsx con DNIs para procesar
- Parseo automático con detección de columna DNI
- Cola de procesamiento con estadísticas en tiempo real
- Historial de lotes subidos (expandible por día)
- Eliminación de lotes
- Deduplicación automática de DNIs

**Configuración**

- Parámetros globales del sistema: metas, cooldown, intentos máximos, días de liberación
- Pool de credenciales de Pangea (para el bot)
- URLs de API, tokens

**Usuarios** (solo lectura)

- Puede ver la lista de usuarios pero no modificar (eso es del jefe)

**Perfil**

- Cambiar su contraseña

> IT NO ve datos comerciales (ventas, pipeline, scoring). Solo infraestructura.

---

### 🎓 AUDITOR DE CALIDAD — Evalúa llamadas

**Dashboard Calidad (QA)**

- Lista de evaluaciones realizadas
- Resumen por asesor: promedio, tendencias
- Llamadas pendientes de evaluar

**Evaluación**

- Escucha grabaciones de llamadas
- Rúbrica de 5 criterios (1-5 cada uno):
  - Speech — saludo, tono, claridad
  - Objeciones — manejo de "no", "no me interesa"
  - Cierre — concreta siguiente paso
  - Compliance — cumple normativa
  - Empatía — escucha activa
- Puntaje automático de 5 a 25
- Notas y observaciones
- Historial de evaluaciones por asesor

**Perfil**

- Cambiar su contraseña

> El auditor de calidad SOLO evalúa. No ve pipeline, no ve ventas, no asigna leads.

---

### 👨‍💻 DESARROLLADOR — Acceso total

- Ve absolutamente todo: todas las páginas de todos los roles
- Acceso a configuración avanzada
- Útil para debugging y mantenimiento

---

### 📱 Resumen visual de accesos

| Página          | Asesor        | Supervisor  | Jefe        | BO  | IT  | Auditor |
| --------------- | ------------- | ----------- | ----------- | --- | --- | ------- |
| Dashboard       | ✅ (suyo)     | ✅ (equipo) | ✅ (global) | ✅  | ✅  | ✅      |
| Power Dialer    | ✅            | ✅ (equipo) | —           | —   | —   | —       |
| Agenda          | ✅            | ✅          | —           | 👁️  | —   | —       |
| Rendimiento     | —             | ✅          | ✅          | —   | —   | —       |
| Estadísticas    | —             | ✅          | ✅          | —   | —   | —       |
| Clientes        | —             | ✅ (equipo) | ✅ (todos)  | 👁️  | —   | —       |
| Asignar Leads   | —             | ✅          | ✅          | —   | —   | —       |
| Auditoría       | —             | ✅          | ✅          | —   | —   | —       |
| Metas           | ✅ (suyas)    | ✅ (equipo) | ✅ (todos)  | —   | —   | —       |
| Alertas         | ✅ (suyas)    | ✅ (equipo) | ✅ (todos)  | —   | —   | —       |
| QA / Calidad    | —             | ✅          | ✅          | —   | —   | ✅      |
| Ranking         | ✅ (posición) | ✅ (equipo) | ✅ (todos)  | —   | —   | —       |
| Tramitación     | —             | —           | —           | ✅  | —   | —       |
| Proyectos       | —             | —           | ✅          | —   | —   | —       |
| Wikiratioo      | ✅            | ✅          | ✅          | ✅  | —   | —       |
| Usuarios        | —             | —           | ✅          | —   | 👁️  | —       |
| Infraestructura | —             | —           | —           | —   | ✅  | —       |
| Bots / Apps     | —             | —           | —           | —   | ✅  | —       |
| Documentos      | —             | —           | —           | —   | ✅  | —       |
| Configuración   | —             | —           | —           | —   | ✅  | —       |
| Perfil          | ✅            | ✅          | ✅          | ✅  | ✅  | ✅      |

> ✅ = acceso completo · 👁️ = solo lectura

---

## 📊 Beneficios esperados

| Hoy (proceso manual)                    | Con Oratioo CX                            |
| --------------------------------------- | ----------------------------------------- |
| Copiar datos de Orange a mano           | Bot automático 24/7                       |
| Excel + papel                           | Todo centralizado en un sistema           |
| Sin visibilidad de qué hace cada asesor | Panel en vivo en tiempo real              |
| Leads sin priorizar (al azar)           | Scoring automático: los A+ primero        |
| Sin predicción de resultados            | Forecast de ventas a 7 días               |
| Proceso lento y difícil de escalar      | Escalable: funciona con 10 o 100 asesores |

---

---

## 💰 Presupuesto Estimado

> Costos mensuales una vez en producción. No incluye desarrollo (ya cubierto).

### Infraestructura (costo fijo mensual)

| Concepto                                     | Proveedor              | Costo/mes     |
| -------------------------------------------- | ---------------------- | ------------- |
| Servidor VPS (8 vCPU, 16 GB RAM, 160 GB SSD) | Hetzner CPX41          | ~20 €         |
| Base de datos PostgreSQL                     | incluido en VPS        | 0 €           |
| Almacenamiento grabaciones (500 GB estimado) | VPBX (nativo 1 año)   | Incluido       |
| Proxies españoles (20 unidades, para el bot) | Webshare               | ~15 €         |
| PC para el bot                               | **PC local existente** | **0 €**       |
| Dominio + SSL                                | incluido en Plesk    | 0 €           |
| **Total infraestructura**                    |                        | **~42 €/mes** |

> 💡 El bot corre en una PC local con Windows, no en el VPS. Esto ahorra 60-130€/mes que costaría un VPS con suficiente RAM/CPU para Chrome + Playwright. La PC solo necesita estar encendida y conectada a internet.

### APIs y servicios externos

| Servicio               | Costo    | Nota                                                              |
| ---------------------- | -------- | ----------------------------------------------------------------- |
| VPBX (centralita)      | Variable | Depende del plan contratado con el proveedor de telefonía         |
| Meta WhatsApp Business | ~0 €     | Conversaciones iniciadas por la empresa: primeras 1000/mes gratis |

### Costos únicos (solo una vez)

| Concepto                           | Costo estimado   |
| ---------------------------------- | ---------------- |
| Configuración inicial del servidor | 0 € (lo hago yo) |
| Deploy y puesta en marcha          | 0 € (lo hago yo) |
| Capacitación a equipos             | 0 € (lo hago yo) |

### Resumen

```
Costo mensual en producción:  ~42 €/mes (unos 45-50 € con holgura)
Costo único de arranque:      0 €

La PC del bot es local (0 €).
El VPS solo corre el CRM, la BD y la API (20 €).
Los proxies son para que el bot aparezca en España (15 €).

Para un equipo de 10 asesores: ~4 €/mes por asesor
Para un equipo de 50 asesores: ~0.80 €/mes por asesor
```

> 💡 El costo es prácticamente fijo. Si duplicas los asesores, el costo no se duplica. Escala solo.

---

**Oratioo CX — 06 de Junio 2026**