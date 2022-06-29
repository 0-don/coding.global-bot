# Install dependencies only when needed
# Stage 0
FROM node:16-alpine AS deps
WORKDIR /app

COPY package.json ./
RUN yarn install --frozen-lockfile
#############################################


# Rebuild the source code only when needed
# Stage 1
FROM node:16-alpine AS builder
WORKDIR /app

COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN yarn build 
#############################################


# Production image, copy only production files
# Stage 2
FROM node:16-alpine AS prod
WORKDIR /app


RUN addgroup -g 1001 -S nodejs
RUN adduser -S server -u 1001


COPY --from=builder --chown=server:nodejs /app/dist ./dist
# COPY --from=builder --chown=server:nodejs /app/verifyFiles ./verifyFiles
RUN chown -R server:nodejs /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.env ./.env


USER server
EXPOSE 4001

CMD ["yarn", "start"]
#############################################
