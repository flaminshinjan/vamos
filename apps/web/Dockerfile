# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
WORKDIR /app
COPY apps/web/package.json ./package.json
# Use npm for portability — no lockfile needed since we resolve on install
RUN npm install --omit=dev --no-audit --no-fund || true
RUN npm install --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web/ ./
# NEXT_PUBLIC_* vars are baked into the client bundle at build time.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=4247

RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public

USER app
EXPOSE 4247
CMD ["node", "server.js"]
