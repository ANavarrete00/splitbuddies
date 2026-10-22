
# syntax=docker/dockerfile:1

# Shared base for consistent Node.js and Linux environments.
FROM node:22-bookworm-slim AS base
WORKDIR /app

# Install all dependencies and build the app.
FROM base AS build

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Install only production dependencies.
# Native modules are compiled here using the same base image.
FROM base AS production-deps

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force

# Final runtime image: no compiler toolchain or dev dependencies.
FROM base AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATABASE_PATH=/data/splitbuddies.sqlite

COPY package.json ./
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server

RUN mkdir -p /data \
    && chown -R node:node /app /data

USER node

EXPOSE 3000
VOLUME ["/data"]

CMD ["sh", "-c", "node dist-server/db/migrate.js && exec node dist-server/index.js"]
