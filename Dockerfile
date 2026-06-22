# Oratioo CX — Dockerfile
# Multi-stage: build Next.js → standalone production image

FROM node:22-alpine AS base

# ── Build Stage ──
FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && cp -R node_modules /prod_node_modules
RUN npm ci
COPY . .
RUN npm run build

# ── Production Stage ──
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copiar standalone + static + public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Copiar node_modules de produccion (prisma, pg, bcrypt, etc.)
COPY --from=builder /prod_node_modules ./node_modules

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
