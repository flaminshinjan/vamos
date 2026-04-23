# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
WORKDIR /app

# ── Dependencies ────────────────────────────────────────────────────
FROM base AS deps
COPY apps/web/package.json ./package.json
RUN npm install --no-audit --no-fund

# ── Build ────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web/ ./
# NEXT_PUBLIC_* vars get baked into the client bundle at build time.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=8080

# Copy what `next start` needs at runtime
COPY --from=builder /app/package.json    ./package.json
COPY --from=builder /app/node_modules    ./node_modules
COPY --from=builder /app/.next           ./.next
COPY --from=builder /app/public          ./public
COPY --from=builder /app/next.config.js  ./next.config.js

EXPOSE 8080
# -H binds to 0.0.0.0 so Fly's proxy can reach the process.
# -p 8080 matches fly.toml internal_port.
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "8080"]
