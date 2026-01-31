# Install dependencies
FROM oven/bun:alpine AS deps
WORKDIR /app

COPY package.json ./

RUN bun install


# Build
FROM oven/bun:alpine AS builder
WORKDIR /app

COPY . .
COPY --from=deps /app/node_modules ./node_modules

ENV STANDALONE=1
RUN bun run build


# Production
FROM oven/bun:alpine AS prod
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/.env ./.env

ENV DOCKER=true
ENV NODE_ENV=production

CMD ["bun", "start"]
