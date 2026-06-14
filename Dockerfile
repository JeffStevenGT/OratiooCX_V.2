# Oratioo CX — Dockerfile
# Next.js 15 standalone output + Node 22

FROM node:22-alpine AS base

# ---- Build Stage ----
FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copiar standalone output desde el builder
COPY --from=builder /app/.next/standalone ./
# Copiar archivos estáticos generados
COPY --from=builder /app/.next/static ./.next/static
# Copiar carpeta public (si existe)
COPY --from=builder /app/public ./public

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
