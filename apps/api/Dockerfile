# Phoenix API — production image (built from the repo root as build context):
#   docker build -f apps/api/Dockerfile -t phoenix-api .
# The pnpm workspace manifests are copied first so dependency install is
# cached independently of source changes.

# --- deps: full workspace install with the frozen lockfile ----------------
FROM node:24-slim AS deps
RUN npm install -g pnpm@11.25.0
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY patches ./patches
# Manifests only: pnpm needs every workspace importer to exist for a
# frozen-lockfile install, but none of their sources yet.
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

# --- build: prisma generate + tsc (generated client compiles into dist/) --
FROM deps AS build
COPY apps/api apps/api
RUN pnpm --filter api db:generate && \
    pnpm --filter api build

# --- prod-deps: fresh api-only production install ---------------------------
# pnpm deploy/--legacy would pull the whole workspace store (Next.js et al.),
# so instead re-install only the api package's production dependencies and
# keep the standard workspace layout: node_modules symlinks are relative and
# resolve unchanged in the runtime stage.
FROM node:24-slim AS prod-deps
RUN npm install -g pnpm@11.25.0
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY patches ./patches
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile --prod --filter api

# --- runtime ---------------------------------------------------------------
FROM node:24-slim AS runtime
LABEL org.opencontainers.image.title="phoenix-api"
ENV NODE_ENV=production \
    PORT=8080 \
    THUMBNAILS_DIR=/app/thumbnails \
    UPLOADS_DIR=/app/data/uploads \
    DIGITAL_FILES_DIR=/app/data/digital-files
# Migrations ship with the image so `prisma migrate deploy` can run from a
# one-off container or a local shell against the same environment.
COPY --from=prod-deps --chown=node:node /app /app
COPY --from=build --chown=node:node /app/apps/api/dist /app/apps/api/dist
COPY --chown=node:node apps/api/prisma /app/apps/api/prisma
COPY --chown=node:node apps/api/prisma.config.ts /app/apps/api/
RUN mkdir -p /app/thumbnails /app/data/uploads /app/data/digital-files && \
    chown -R node:node /app/data /app/thumbnails
WORKDIR /app/apps/api
USER node
EXPOSE 8080
ENTRYPOINT ["node", "dist/server.js"]
