# syntax=docker/dockerfile:1

# --- deps: install dependencies (needs a compiler for better-sqlite3's native build) ---
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
ENV HUSKY=0
COPY package.json package-lock.json ./
RUN npm ci

# --- builder: compile the Next.js standalone server ---
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- runner: minimal runtime image ---
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV OPAL_DATA_DIR=/data
ENV OSC_PORT=9000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN mkdir -p /data && chown node:node /data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000
EXPOSE 9000/udp

VOLUME ["/data"]

CMD ["node", "server.js"]
