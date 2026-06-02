# Oratioo CX — CRM de Gestión Comercial

Sistema CRM completo para extraer leads de Pangea Orange, gestionar el pipeline de ventas, asignar leads a asesores y monitorear métricas del equipo.

---

## Stack

- **Frontend:** React + Vite + Tailwind + Recharts
- **Automatización:** Python (Playwright) — scraper de Orange Pangea
- **Base de datos:** Supabase (PostgreSQL + JSONB)
- **Autenticación:** Login local con tabla `usuarios`

---

## Microservicios / Módulos

| Módulo | Descripción | Documentación |
|---|---|---|
| 🤖 **Bot** | Scraper automatizado de Orange Pangea. Coordinator multi-worker, login, extracción de datos (CIMA, Renove, líneas), proxy rotativo. | [`docs/bot/`](./bot/) |
| 🌐 **Web** | Dashboard React para visualizar leads, gestionar usuarios, subir documentos, configurar proxies/máquinas/workers. | [`docs/web/`](./web/) |
| 📞 **Discador** | *(próximamente)* Power Dialer para llamar leads con estado rápido y agenda de callbacks. | — |
| 🎓 **Educación** | *(próximamente)* Módulo de formación para asesores. | — |

---

## Arquitectura General

```
┌──────────────────────────────────────────┐
│            FRONTEND (React)              │
│  Dashboard · Clientes · Documentos       │
│  Proxies · Máquinas · Workers · Lotes    │
│  Usuarios · Configurar App               │
└──────────────────┬───────────────────────┘
                   │ anon key + RLS
                   ▼
┌──────────────────────────────────────────┐
│           SUPABASE (PostgreSQL)          │
│  lineas · usuarios · documentos          │
│  lotes · lote_dnis · maquinas            │
│  proxies · config_bots · comandos_bot    │
└──────────────────┬───────────────────────┘
                   │ service_role key
                   ▼
┌──────────────────────────────────────────┐
│          BOT (Python + Playwright)       │
│  Coordinator → Worker 1 (proxy A)       │
│              → Worker 2 (proxy B)        │
│              → Worker N (proxy N)        │
└──────────────────────────────────────────┘
```

---

## Instalación Rápida

### Web

```bash
cd web
npm install
npm run dev
```

### Bot

```bash
cd bot
pip install -r requirements.txt
playwright install chromium
```

### Supabase

Ejecutar en SQL Editor de Supabase:
1. Migración de tablas principales (ver `docs/web/` para esquemas)
2. Crear usuarios iniciales
3. Configurar RLS policies

---

## 👥 Roles del Sistema

| Rol | Acceso principal |
|---|---|
| **Asesor** | Dashboard, Clientes |
| **Back Office** | Dashboard, Clientes, Documentos |
| **IT** | Dashboard, Clientes, Proxies, Máquinas, Workers |
| **Supervisor** | Dashboard, Clientes, Documentos, Usuarios |
| **Jefe Área** | **Todo** el sistema |
| **Desarrollador** | Acceso total |
