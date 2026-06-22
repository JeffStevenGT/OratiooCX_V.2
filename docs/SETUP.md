# SETUP.md — Guía de Instalación y Configuración

## Requisitos previos

| Dependencia | Versión | Notas |
|-------------|---------|-------|
| Node.js | ≥ 18 | LTS recomendado |
| Python | ≥ 3.11 | Solo para el bot |
| PostgreSQL | ≥ 14 | Base de datos principal |
| Chromium | ≥ 120 | Para Playwright (instalado automáticamente) |
| Redis | ≥ 7 | Opcional (fallback automático sin Redis) |

---

## 1. Clonar e instalar dependencias

```bash
git clone <repo-url> OratiooCX_V.2
cd OratiooCX_V.2

# Frontend + API (Next.js)
npm install

# Bot Python
cd bot
pip install -r requirements.txt
playwright install chromium
cd ..
```

---

## 2. Variables de entorno (`.env`)

Crea un archivo `.env` en la raíz del proyecto:

```env
# ── Base de datos ──
DATABASE_URL=postgresql://usuario:password@localhost:5432/oratioo_cx

# ── NextAuth ──
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=genera-un-secret-de-32-chars

# ── Bot (OBLIGATORIAS) ──
BOT_API_KEY=clave-secreta-que-comparten-bot-y-api
BOT_API_URL=http://localhost:3000

# ── Credenciales Pangea Orange ──
ORANGE_USER=usuario-pangea
ORANGE_PASS=password-pangea

# ── Headless (opcional) ──
# BOT_HEADLESS=0   # Descomenta para debug visual del navegador

# ── VPBX (opcional) ──
VPBX_API_URL=https://api.vpbx.com
VPBX_API_KEY=clave-vpbx

# ── WhatsApp (opcional) ──
META_WHATSAPP_TOKEN=token-meta
META_WHATSAPP_PHONE_ID=id-telefono

# ── Redis (opcional) ──
REDIS_URL=redis://localhost:6379
```

**Importante:** `BOT_API_KEY` no tiene valor por defecto. Si no está definida, tanto el bot como la API lanzarán `RuntimeError` al arrancar.

---

## 3. Base de datos

```bash
# Crear la base de datos
createdb oratioo_cx

# Ejecutar migraciones en orden
psql $DATABASE_URL -f migrations/001_cumpleanos_anuncios.sql
psql $DATABASE_URL -f migrations/002_indices_rendimiento.sql
```

Las migraciones usan `IF NOT EXISTS` y son idempotentes. Puedes ejecutarlas repetidamente sin riesgo.

---

## 4. Arranque en desarrollo

### Frontend + API

```bash
npm run dev
# → http://localhost:3000
```

### Bot (en otra terminal)

```bash
# Coordinator daemon
cd bot
python coordinator_loop.py --machine-name localhost --workers 3

# O worker standalone para testing
python worker_structured.py --dni 12345678A
```

---

## 5. Arranque en producción

### Build del frontend

```bash
npm run build
npm start
```

### Bot como servicio systemd

```ini
# /etc/systemd/system/oratioo-bot.service
[Unit]
Description=Oratioo Bot Coordinator
After=network.target

[Service]
Type=simple
User=oratioo
WorkingDirectory=/opt/oratioo/bot
EnvironmentFile=/opt/oratioo/.env
ExecStart=/usr/bin/python3 coordinator_loop.py --machine-name vps-espana-1 --workers 5
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable oratioo-bot
sudo systemctl start oratioo-bot
```

---

## 6. Proxies (configuración del bot)

Crea `bot/proxies.txt` con una línea por proxy:

```
# Formato: ip:puerto:usuario:contraseña
192.168.1.100:8080:proxyuser:proxypass
192.168.1.101:8080:proxyuser:proxypass
```

Cada worker toma un proxy distinto vía round-robin. Sin proxies, Pangea Orange **no acepta conexiones desde IPs no españolas**.

---

## 7. Headless y debugging

Por defecto, Chromium corre en modo **headless** (sin interfaz gráfica). Para depuración visual:

```bash
# En .env
BOT_HEADLESS=0

# O al ejecutar el worker standalone
python worker_structured.py --dni 12345678A
# (worker_structured usa el flag --dni y abre navegador visible)
```

---

## 8. Verificación

```bash
# Healthcheck de la API
curl http://localhost:3000/api/health
# → { "status": "ok", "timestamp": "..." }

# Estado del bot
curl -H "x-bot-api-key: $BOT_API_KEY" http://localhost:3000/api/bot/next-dni
# → { "dni": "DNI_12345678A" } o { "dni": null }

# Usuario admin por defecto
# Crea el primer usuario vía API o directamente en PostgreSQL:
# INSERT INTO usuarios (email, nombre, password_hash, rol) VALUES (...);
```

---

## Solución de problemas comunes

| Problema | Causa probable | Solución |
|----------|---------------|----------|
| `BOT_API_KEY no definida` | Falta en `.env` | Añadir `BOT_API_KEY=...` al `.env` |
| `MaxSessionsError` en Pangea | Demasiadas sesiones abiertas | El worker espera 5 min y reintenta automáticamente |
| `Module not found: @/lib/db` | Path alias no resuelto | Solo ocurre con `tsc` standalone. Usa `npm run dev` o `npm run build` |
| Chromium no abre | Falta `playwright install` | Ejecutar `playwright install chromium` |
| Proxy no funciona | IP no española o proxy caído | Verificar `proxies.txt` y conectividad |
