# Install dependencies
FROM oven/bun:alpine AS deps
WORKDIR /app

COPY package.json ./
COPY /prisma ./prisma

RUN bun install


# Build
FROM oven/bun:alpine AS builder
WORKDIR /app

COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN bun run build


# Production
FROM oven/bun:alpine AS prod
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.env ./.env
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

ENV DOCKER=true

CMD ["bun", "start"]
