# Install dependencies only when needed
# Stage 0
FROM node:16.15.1 AS deps
WORKDIR /app

COPY package.json ./
COPY /prisma ./prisma

RUN yarn install --frozen-lockfile
#############################################


# Rebuild the source code only when needed
# Stage 1
FROM node:16.15.1 AS builder
WORKDIR /app

COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN yarn build 
#############################################


# Production image, copy only production files
# Stage 2
FROM node:16.15.1 AS prod

USER node

WORKDIR /app

COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/.env ./.env
COPY --chown=node:node --from=builder /app/prisma ./prisma
RUN chown -R node:node /app



EXPOSE 4001

CMD ["yarn", "start:migrate:prod"]
#############################################
