# 🤖 Bot — Automatización Orange Pangea

Bot en Python con Playwright que automatiza el login en la plataforma Pangea de Orange España, busca clientes por DNI y extrae toda su información comercial (CIMA, Renove, líneas, pestañas).

---

## 📁 Estructura

```
bot/
├── coordinator.py       → Orquestador multi-worker
├── worker.py            → Worker individual
├── login.py             → Login + extracción Orange
├── browser_setup.py     → Config navegador + proxy
├── supabase_client.py   → Cliente REST Supabase
├── agente.py            → Agente remoto (comandos vía Supabase)
├── asesor_agent.py      → Agente para asesores (Abrir Orange)
├── navegador_asesor.py  → Navegador para asesor
├── main.py              → Entry point (modo individual / pruebas)
├── proxies.txt          → Lista de proxies (gitignored)
├── numeros.txt          → DNIs de prueba (gitignored)
└── requirements.txt     → Dependencias Python
```

---

## 🚀 Uso

### Coordinator (producción multi-worker)

```bash
cd bot
$env:PYTHONIOENCODING='utf-8'
python coordinator.py
```

Pregunta interactivamente cuántos workers iniciar.

### Modo prueba individual

```bash
python main.py --local --headless
```

---

## 🔄 Flujo del Bot

### 1. Login en Orange

```
1. Navegar a https://pangea.orange.es/
2. Esperar input[name='temp-username'] (hasta 20s)
3. Escribir usuario con _escribir_como_humano() (delay 50-150ms por letra + Tab)
4. Escribir contraseña en input[name='temp-password']
5. Click en #submit-button
6. Esperar .brands (hasta 30s)
7. Click en a.orange-box
8. Esperar #orange-container (hasta 30s)
9. Click "Nuevo acto comercial"
10. Click "Tarifas"
11. Click último "Crear"
12. Esperar button[title='Cambiar cliente'] (hasta 30s)
```

### 2. Búsqueda por DNI

```
1. Click button[title='Cambiar cliente']
2. Esperar input[name='document'] (hasta 10s)
3. Click, fill(vacío), fill(DNI)
4. Disparar eventos input + change para Angular
5. Click último "Buscar cliente"
6. Esperar que modal se cierre (hasta 10s)
7. Si aparece "No se han encontrado datos para este cliente" → no_cliente
8. Esperar .mod-barclient__container-data (hasta 50s)
```

### 3. Detección de etiquetas (CIMA, TV, Principal)

```python
heading = bloque.locator(".client-tariff-heading")
labels = heading.locator("span.label")
etiquetas = [labels.nth(k).inner_text().strip() for k in range(labels.count())]
es_cima = "CIMA" in etiquetas
tiene_tv = "TV" in etiquetas
es_principal = "Principal" in etiquetas
activo_desde = re.search(r'Activo desde\s+(\d{2}/\d{2}/\d{4})', texto_completo)
```

El flag `cima` se determina por presencia de la etiqueta "CIMA" en el array.

### 4. Extracción de datos

```
Cabecera:
  - Nombre:     .tooltip-text.name strong
  - DNI:        span.font-xxs.p-r-10
  - Dirección:  .tooltip-text.address
  - Seg Fijo:   div.font-xxs:has-text('Seg. Fijo:') strong
  - Seg Móvil:  div.font-xxs:has-text('Seg. Móvil:') strong
  - Paquete:    .client-tariff-title .font-lg

Líneas (paginación):
  - Cada línea: .client-tariff-flex
  - Número:     .line-section .color-primary strong
  - Pestañas:   button.Title.text (Destacadas, Renove, etc.)
  - Contenido:  .card-tariff-info-text

Paginación:
  - Siguiente:  button.ocs-pagination-next
```

### 5. Guardado en Supabase (UPSERT)

```python
1. GET /lineas?select=id&dni=eq.{dni}&limit=1
2. Si existe → PATCH /lineas?id=eq.{id}
3. Si no existe → POST /lineas
```

---

## 🎯 Detección de Renove Mixto

En la pestaña "Renove", se busca en el texto extraído si contiene alguna de estas variantes (en orden de prioridad):

| Prioridad | Variante | Color |
|---|---|---|
| 1 | Renove Mixto al Mejor Precio con Máximo Descuento | 🟢 |
| 2 | Renove Mixto al Mejor Precio con Descuento | 🔵 |
| 3 | Renove Mixto al Mejor Precio | 🟠 |
| 4 | Renove Mixto (básico) | 🟡 |

Se guarda la variante más específica (más larga) en `atributos_dinamicos.renove_mixto_variante`.

---

## 🔌 Proxies

### Formato en `proxies.txt`

```
ip:puerto:usuario:contraseña
```

### Asignación

El `coordinator.py` asigna **1 proxy exclusivo por worker**:
1. Carga todos los proxies de `proxies.txt`
2. Los mezcla aleatoriamente
3. Asigna los primeros N a los N workers
4. Cada worker tiene su propio proxy que nadie más usa

Si hay más workers que proxies, los workers extra van sin proxy.

---

## 🤖 Coordinator

El orquestador multi-worker:

- Lanza N workers como procesos hijos
- Cada worker tiene su propio proxy dedicado
- Monitorea heartbeats cada 30s
- Watchdog: si un worker deja de reportar >2min, lo marca como caído
- Encola DNIs de la tabla `lineas` con estado `pendiente`
- Soporta pausa/reanudación de workers individuales

---

## 📱 Agente Remoto

El `agente.py` es un proceso que corre en la máquina del bot y escucha comandos desde Supabase (tabla `comandos_bot`):

- **Abrir navegador**: lanza Orange en modo asesor con su proxy asignado
- **Estado**: reporta heartbeat, workers activos, recursos del sistema
- **Watchdog**: monitorea que los workers sigan activos

---

## 📊 Rendimiento

| Workers | DNIs/día aprox | RAM estimada |
|---|---|---|
| 1 | ~650-800 | ~1 GB |
| 2 | ~1,300-1,600 | ~2 GB |
| 3 | ~2,000-2,400 | ~3 GB |
| 4-5 | ~3,000+ | ~4-5 GB |

---

## 🔧 Troubleshooting

### Error: "modal de búsqueda se quedó atascado"
- Posible: Orange cambió el selector del input
- Verificar: `input[name='document']` sigue siendo el campo correcto

### Error: "Fallo en login"
- Verificar credenciales en `.env`
- Probar login manual en https://pangea.orange.es/

### Error: "Supabase 401 Unauthorized"
- `SUPABASE_SERVICE_KEY` no es válida o expiró
- Regenerar en Supabase Dashboard > Settings > API

### Workers se caen solos
- Posible: falta de RAM (cada worker ~500MB-1GB)
- Reducir número de workers
- Verificar proxies
