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
    PORT=4247

RUN addgroup -S app && adduser -S app -G app

# Copy what `next start` needs at runtime
COPY --from=builder --chown=app:app /app/package.json    ./package.json
COPY --from=builder --chown=app:app /app/node_modules    ./node_modules
COPY --from=builder --chown=app:app /app/.next           ./.next
COPY --from=builder --chown=app:app /app/public          ./public
COPY --from=builder --chown=app:app /app/next.config.js  ./next.config.js

USER app
EXPOSE 4247
CMD ["node_modules/.bin/next", "start", "-p", "4247"]
