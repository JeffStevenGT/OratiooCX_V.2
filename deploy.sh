#!/usr/bin/env bash
# ============================================================
# Oratioo CX — Deploy Script para VPS
# ============================================================
# Uso:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Requisitos: Docker + Docker Compose instalados en el VPS.
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo "========================================"
echo " Oratioo CX — Deploy VPS"
echo "========================================"

# ── 1. Verificar .env.production ──
if [ ! -f .env.production ]; then
    warn "No se encontró .env.production"
    if [ -f .env.production.template ]; then
        cp .env.production.template .env.production
        warn "Creado .env.production desde template."
        echo ""
        echo "  >>> EDITA .env.production AHORA con tus valores reales <<<"
        echo "  >>> Luego vuelve a ejecutar: ./deploy.sh              <<<"
        echo ""
        exit 0
    else
        err "No existe .env.production ni .env.production.template"
    fi
fi

# Verificar variables críticas
source .env.production 2>/dev/null || true
MISSING=""
[ -z "${DATABASE_URL:-}" ] && MISSING="$MISSING DATABASE_URL"
[ -z "${NEXTAUTH_SECRET:-}" ] && MISSING="$MISSING NEXTAUTH_SECRET"
[ -z "${NEXTAUTH_URL:-}" ] && MISSING="$MISSING NEXTAUTH_URL"
[ -z "${BOT_API_KEY:-}" ] && MISSING="$MISSING BOT_API_KEY"
[ -z "${DB_PASSWORD:-}" ] && MISSING="$MISSING DB_PASSWORD"

if [ -n "$MISSING" ]; then
    warn "Faltan variables en .env.production:$MISSING"
    echo "  Edita el archivo y vuelve a ejecutar."
    exit 1
fi
log ".env.production configurado"

# ── 2. Pull y build ──
log "Construyendo imágenes..."
docker compose build --pull

# ── 3. Levantar servicios ──
log "Levantando contenedores..."
docker compose up -d

# ── 3b. Aplicar migraciones (idempotentes) ──
log "Esperando a PostgreSQL..."
for i in $(seq 1 30); do
    if docker compose exec -T db pg_isready -U oratioo -d oratioo_cx > /dev/null 2>&1; then break; fi
    sleep 2
done
log "Aplicando migraciones..."
for f in migrations/*.sql; do
    echo "  → $f"
    docker compose exec -T db psql -v ON_ERROR_STOP=1 -U oratioo -d oratioo_cx < "$f" > /dev/null \
        || warn "Falló $f (revisar manualmente)"
done
log "Migraciones aplicadas"

# ── 4. Esperar a que la app esté lista ──
log "Esperando a que la app responda..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
        log "App lista en http://localhost:3000"
        break
    fi
    sleep 2
done

# ── 5. Verificar estado ──
echo ""
log "Estado de los contenedores:"
docker compose ps

echo ""
echo "========================================"
echo " Deploy completado"
echo ""
echo " La app responde en: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo " Próximos pasos:"
echo "   1. Configurar DNS: tudominio.com → IP del VPS"
echo "   2. Obtener certificado SSL:"
echo "      docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d tudominio.com"
echo "   3. Descomentar sección HTTPS en nginx.conf"
echo "   4. Recargar Nginx: docker compose restart nginx"
echo "   5. En la PC del bot, editar bot/.env con BOT_API_URL=https://tudominio.com"
echo "========================================"
