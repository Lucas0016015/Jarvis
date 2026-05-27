# ── JARVIS Frontend Dockerfile (web-next context) ────────────────
# Railway ejecuta el build desde web-next/ como root directory.
# Railway inyecta NEXT_PUBLIC_API_URL como build arg automáticamente
# si está declarado como ARG global (antes del primer FROM).

ARG NEXT_PUBLIC_API_URL

FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN ls -la public/models/
RUN npm run build

FROM base AS production
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
RUN ls -la public/models/
RUN chown -R nextjs:nodejs /app
USER nextjs
EXPOSE 8080
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
