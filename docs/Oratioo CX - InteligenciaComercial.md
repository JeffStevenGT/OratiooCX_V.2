# Oratioo CX — Inteligencia Comercial

> **Propósito:** Convertir los datos del CRM en decisiones de negocio accionables
> **Alcance:** Scoring de leads, métricas de operadores, predicción de ventas, gamificación, calidad de base
> **Depende de:** Fases 1-6 del Roadmap (CRM Core + VPBX + Calidad)

---

## 1. Visión General

El módulo de Inteligencia Comercial transforma los datos crudos del CRM en información estratégica para:

- **Priorizar** qué leads llamar primero (scoring)
- **Medir** el rendimiento real de cada operador (métricas)
- **Predecir** cuántas ventas se harán hoy (forecast)
- **Motivar** al equipo con gamificación (cinturones)
- **Alertar** cuando algo va mal (notificaciones automáticas)
- **Conocer** la salud real de la base de datos (calidad)

---

## 2. Scoring de Leads (Clasificación A+ a E)

### 2.1 Definición de Niveles

| Nivel | Nombre | Criterios | Prioridad |
|---|---|---|---|
| **A+** | Cliente VIP | Contacto decisor + Responde teléfono + Responde WhatsApp + Compra recurrente (2+ compras) | 🔴 Máxima |
| **A** | Cliente Nuevo | Contacto decisor + Responde teléfono + Responde WhatsApp + Primera compra | 🟠 Alta |
| **B** | Prospecto Calificado | Contacto decisor + Responde teléfono + No ha comprado aún | 🟡 Media |
| **C** | Prospecto Frío | Contacto de empresa + Sin intentos de contacto previos (virgen) | 🟢 Baja |
| **D** | Difícil Contacto | Contacto de empresa + 1-3 rondas sin respuesta | ⚪ Muy Baja |
| **E** | Casi Descartado | Contacto de empresa + 3+ rondas sin respuesta | ⚫ Último recurso |

### 2.2 Cálculo Automático

```sql
-- Trigger o función que recalcula al cambiar pipeline
CREATE OR REPLACE FUNCTION calcular_scoring() RETURNS TRIGGER AS $$
DECLARE
    total_compras INT;
    total_intentos INT;
BEGIN
    -- Contar compras históricas del cliente
    SELECT COUNT(*) INTO total_compras FROM compras WHERE id_cliente = NEW.id_cliente;
    
    -- Contar rondas de contacto
    SELECT ronda_actual INTO total_intentos FROM pipeline WHERE id = NEW.id;
    
    -- Asignar nivel según criterios
    IF total_compras >= 2 THEN
        NEW.scoring = 'A+';
    ELSIF total_compras >= 1 THEN
        NEW.scoring = 'A';
    ELSIF NEW.estado = 'contactado' AND total_intentos <= 2 THEN
        NEW.scoring = 'B';
    ELSIF total_intentos = 0 THEN
        NEW.scoring = 'C';
    ELSIF total_intentos <= 3 THEN
        NEW.scoring = 'D';
    ELSE
        NEW.scoring = 'E';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2.3 Visualización en el Frontend

- **Tabla de Clientes:** columna "Score" con badge de color
- **Asignar Leads:** ordenar por score (A+ primero)
- **Power Dialer:** badge visible en la tarjeta del lead
- **Dashboard Jefe:** gráfico de distribución de scores en la base

### 2.4 Predicción de Ventas Diarias

```
VentasEstimadas = Σ(leads_por_nivel × tasa_conversion_nivel)

Donde:
  tasa_conversion_A+ = 0.40  (40% de A+ compran)
  tasa_conversion_A  = 0.25
  tasa_conversion_B  = 0.10
  tasa_conversion_C  = 0.03
  tasa_conversion_D  = 0.01
  tasa_conversion_E  = 0.00
```

Las tasas se ajustan automáticamente con datos históricos reales (machine learning simple: media móvil de últimas 4 semanas).

---

## 3. Métricas de Operadores

### 3.1 Métricas Individuales

| Métrica | Fórmula | Fuente de Datos |
|---|---|---|
| **Contactabilidad** | `llamadas_contestadas / intentos_totales × 100` | `historial` (tipo=llamada) + `cdr_vpbx` |
| **Conversaciones Efectivas** | `llamadas_con_billsec_>_5s / intentos_totales × 100` | `cdr_vpbx.billsec > 5` |
| **Conversión Contacto → Venta** | `ventas / contactados × 100` | `pipeline` (estado=venta) |
| **Conversión Registro → Venta** | `ventas / leads_asignados × 100` | `pipeline` |
| **Intentos por Registro** | `total_intentos / total_leads` | `pipeline.ronda_actual` |
| **Tiempo Medio de Llamada** | `AVG(cdr_vpbx.duration)` | `cdr_vpbx` por asesor |
| **Tiempo Post-Llamada (Wrap-up)** | `AVG(intervalo_entre_hangup_y_siguiente_originate)` | `cdr_vpbx` ordenado por created |
| **Ocupación** | `sum(billsec) / tiempo_conectado × 100` | `cdr_vpbx` + VPBX agent status |

### 3.2 Métricas de Equipo

| Métrica | Fórmula | Visualización |
|---|---|---|
| **Ventas por Hora del Grupo** | `COUNT(ventas) GROUP BY HOUR(ultimo_cambio)` | Gráfico de barras horario |
| **Ventas por Operador** | `COUNT(ventas) GROUP BY asesor_id` | Ranking en tabla |
| **Efectividad del Equipo** | `AVG(conversion_contacto_venta) por equipo` | Comparativa entre equipos |

### 3.3 Dashboard de Rendimiento

El dashboard muestra para cada operador:

```
┌─────────────────────────────────────────────────────────────┐
│  Ana Asesora Perú                          🟣 Cinturón Azul │
│─────────────────────────────────────────────────────────────│
│  📞 Contactabilidad:  34%   (media equipo: 28%)     ▲ +6%  │
│  💬 Efectivas:        28%   (media: 22%)             ▲ +6%  │
│  💰 Conv. Contacto:   18%   (media: 12%)             ▲ +6%  │
│  📊 Conv. Registro:   8%    (media: 5%)              ▲ +3%  │
│  ⏱  Tiempo medio:    4:32  (media: 5:10)            ▼ -38s │
│  🔄 Wrap-up:          1:15  (media: 2:00)            ▼ -45s │
│  📅 Hoy: 45 llamadas | 15 contactos | 3 ventas              │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Sistema de Cinturones (Gamificación)

### 4.1 Niveles y Criterios

| Cinturón | Color | Criterio de Ascenso |
|---|---|---|
| **Blanco** | ⬜ | Nuevo operador o < 100 llamadas totales acumuladas |
| **Azul** | 🟦 | Contactabilidad > 25% sostenida 2 semanas |
| **Marrón** | 🟫 | Conversión contacto→venta > 12% + QA promedio > 18/25 |
| **Faixa Preta** | ⬛ | Conversión > 20% + QA > 22/25 + > 1000 llamadas totales |

### 4.2 Lógica de Ascenso/Descenso

- Se evalúa cada **viernes** al cierre de la semana
- Para ascender: cumplir el criterio **2 semanas consecutivas**
- Para descender: **2 semanas consecutivas** por debajo del umbral del nivel actual
- Los ascensos se anuncian en el dashboard del equipo
- Cada cinturón tiene un badge visible en el perfil y sidebar

### 4.3 Visualización

- **Sidebar:** icono de cinturón junto al nombre del operador
- **Dashboard Supervisor:** columna de cinturón en tabla de equipo
- **Ranking (Metas):** filtro por cinturón, comparativa
- **Perfil del operador:** historial de cinturones, fecha de obtención

---

## 5. Notificaciones y Alertas Automáticas

### 5.1 Umbrales Configurados

| Alerta | Condición | Destinatario |
|---|---|---|
| **Operador bajo rendimiento** | Contactabilidad < media_equipo - 15% | Supervisor |
| **Base agotándose** | Leads pendientes < 50 para todo el equipo | Jefe de Área |
| **Contactabilidad bajando** | Promedio diario < promedio semanal - 15% | Supervisor |
| **Conversión bajando** | Promedio diario < promedio semanal - 20% | Jefe de Área |
| **Máquina offline** | Coordinator sin heartbeat > 5 minutos | IT |
| **Lead urgente** | callback_at vencido sin contactar | Asesor asignado |
| **Venta grande** | Venta con 4+ líneas | Jefe de Área |

### 5.2 Canales de Notificación

| Canal | Tipo de Alerta | Prioridad |
|---|---|---|
| Badge en sidebar | Lead urgente, sin asignar | Alta |
| Página Alertas | Todas las alertas | Media |
| Email (futuro) | Máquina offline, base agotándose | Alta |
| SSE en tiempo real | Venta grande, operador bajo rendimiento | Media |

---

## 6. Calidad de Base de Datos

### 6.1 Ratio de Salud

```
Salud = (registros_limpios / registros_totales) × 100

Donde registros_limpios = total - robinson - fallecidos - empresa_cerrada - no_llamar
```

### 6.2 Clasificación de Calidad

| Ratio | Calificación | Acción |
|---|---|---|
| > 90% | 🟢 Excelente | Sin acción |
| 80-90% | 🟡 Buena | Revisar fuentes de datos |
| 70-80% | 🟠 Regular | Investigar causa de descarte |
| < 70% | 🔴 Mala | Detener carga, auditar proveedor |

### 6.3 Métricas de Abandono

| Métrica | Descripción | Fuente |
|---|---|---|
| Tasa de Robinson | `COUNT(robinson) / total × 100` | `listas_negras` |
| Tasa de No Llamar | `COUNT(no_llamar) / total × 100` | `listas_negras` |
| Tasa de Fallecidos | `COUNT(fallecido) / total × 100` | `listas_negras` |
| Tasa de Empresas Cerradas | `COUNT(empresa_cerrada) / total × 100` | `listas_negras` |
| Tasa de Duplicados | `COUNT(duplicados) / total × 100` | Detección en carga |
| Tasa de Inválidos | `COUNT(telefono_invalido) / total × 100` | Validación de formato |

### 6.4 Tasa de Reutilización

```
Reutilización = AVG(días_entre_extracciones) para leads con 2+ extracciones

Mide cada cuánto tiempo en promedio un lead vuelve a ser analizado por el bot.
Un valor bajo (< 7 días) indica que la base se está refrescando frecuentemente.
Un valor alto (> 30 días) indica que la base está estancada.
```

---

## 7. Futuras Implementaciones

### 7.1 Machine Learning

| Iniciativa | Descripción | Complejidad |
|---|---|---|
| **Predicción de conversión** | Modelo ML que predice probabilidad de venta por lead basado en features (CIMA, Renove, antigüedad, consumo, permanencia) | Alta |
| **Clustering de clientes** | Segmentación no supervisada para descubrir patrones de compra | Alta |
| **Detección de fraude** | Identificar patrones de llamadas sospechosas | Media |
| **Optimización de horarios** | ML para determinar mejores horas/días para llamar según perfil del lead | Media |

### 7.2 Automatización Avanzada

| Iniciativa | Descripción |
|---|---|
| **Discador Predictivo** | Llamar automáticamente a N×1.5 leads por agente disponible |
| **Bot de Voz IA** | Agente conversacional que atiende llamadas entrantes, califica y transfiere |
| **Chatbot WhatsApp IA** | Respuestas automáticas a consultas frecuentes por WhatsApp |
| **Análisis de sentimiento** | Procesar transcripciones de llamadas para detectar tono emocional |

### 7.3 Integraciones Futuras

| Integración | Propósito |
|---|---|
| **Google Sheets** | Exportar reportes automáticamente a hojas de cálculo |
| **Slack/Teams** | Notificaciones de ventas en tiempo real al canal del equipo |
| **Power BI / Metabase** | Dashboards avanzados para dirección |
| **API pública** | Permitir a partners consultar estado de leads |
