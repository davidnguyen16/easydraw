# syntax=docker/dockerfile:1
#
# EasyDraw API. The server depends on workspace packages, so build from the
# repository root:
#
#   docker build -f server/Dockerfile --target runtime -t easydraw-api .
#   docker build -f server/Dockerfile --target migrate -t easydraw-api:migrate .
#
# Both targets install from the root package-lock.json. `runtime` serves the
# API; `migrate` runs `prisma migrate deploy` once per release, before the
# service rolls over, and exits.

ARG NODE_IMAGE=node:24-alpine

# ---- Build: locked install, workspace packages, Prisma client, Nest --------
FROM ${NODE_IMAGE} AS build
WORKDIR /app

# Every workspace manifest, so `npm ci` can check the lockfile against them.
COPY package.json package-lock.json tsconfig.base.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/diagram-schema/package.json packages/diagram-schema/
COPY packages/diagram-import/package.json packages/diagram-import/
COPY packages/objects-3d/package.json packages/objects-3d/
COPY packages/pack-whiteboard/package.json packages/pack-whiteboard/
RUN npm ci --ignore-scripts --no-audit --no-fund \
      -w backend -w @easydraw/shared-types -w @easydraw/diagram-schema

COPY packages/shared-types packages/shared-types
COPY packages/diagram-schema packages/diagram-schema
RUN npm run build -w @easydraw/shared-types && npm run build -w @easydraw/diagram-schema

COPY server server
RUN npm exec -w backend -- prisma generate && npm run build -w backend

# ---- Migrate: one-off task, same revision as the API ------------------------
FROM build AS migrate
# Prisma's schema engine needs OpenSSL, and is fetched by the install script
# that the locked install above skipped.
RUN apk add --no-cache openssl && npm rebuild prisma @prisma/engines
ENV NODE_ENV=production
WORKDIR /app/server
USER node
CMD ["npx", "--no-install", "prisma", "migrate", "deploy"]

# ---- Runtime: production dependencies and compiled output only -------------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/diagram-schema/package.json packages/diagram-schema/
COPY packages/diagram-import/package.json packages/diagram-import/
COPY packages/objects-3d/package.json packages/objects-3d/
COPY packages/pack-whiteboard/package.json packages/pack-whiteboard/
# `devOptional` packages are optional in production and needed only in
# development: here the Prisma CLI, Studio and TypeScript, pulled in as
# optional peers of @prisma/client. `--omit=optional` would also drop sharp's
# platform binary, so remove exactly those instead.
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
      -w backend -w @easydraw/shared-types -w @easydraw/diagram-schema \
    && node -e 'const fs = require("fs"); for (const [path, entry] of Object.entries(require("./package-lock.json").packages)) if (entry.devOptional) fs.rmSync(path, { recursive: true, force: true })' \
    && npm cache clean --force

COPY --from=build /app/packages/shared-types/dist packages/shared-types/dist
COPY --from=build /app/packages/diagram-schema/dist packages/diagram-schema/dist
COPY --from=build /app/server/dist server/dist
# Amazon RDS root CAs for ap-southeast-2; see docs/cloud-release.md.
COPY server/certs server/certs

WORKDIR /app/server
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
