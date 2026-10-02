FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS build
WORKDIR /app
ENV CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run db:generate && npm run typecheck:server && npm run build:spares

FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6
WORKDIR /app
ENV CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist-spares ./dist-spares
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/src/spares ./src/spares
COPY --from=build --chown=node:node /app/src/repairs ./src/repairs
COPY --from=build --chown=node:node /app/src/rex ./src/rex
COPY --from=build --chown=node:node /app/src/config ./src/config
COPY --from=build --chown=node:node /app/src/utils ./src/utils
COPY --from=build --chown=node:node /app/src/maintenance/domain ./src/maintenance/domain
COPY --from=build --chown=node:node /app/src/maintenance/data ./src/maintenance/data
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/scripts/start-container.mjs ./scripts/start-container.mjs
USER node
EXPOSE 3001
CMD ["node", "scripts/start-container.mjs"]
