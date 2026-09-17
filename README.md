# Phoenix

Music & video streaming platform — React Native (Expo) mobile app with an Express REST API, built as a Turborepo monorepo.

## Structure

```
apps/
├── api/       Express + TypeScript + Prisma + PostgreSQL + Better Auth (REST, /api/v1)
└── mobile/    Expo (SDK 57) + expo-router + Better Auth client
```

## Prerequisites

- Node.js >= 24
- pnpm 11 (`packageManager` is pinned in the root `package.json`)
- Docker (for the local PostgreSQL) or your own PostgreSQL 16+

## Getting started

```sh
pnpm install

# start the dev database
docker compose up -d

# configure the API
cp apps/api/.env.example apps/api/.env
# generate a secret: openssl rand -base64 32

# create the schema and seed demo content
pnpm db:migrate
pnpm db:seed
```

## Development

```sh
pnpm dev          # API (http://localhost:4000) + Expo dev server
pnpm build        # build all workspaces
pnpm test         # run workspace tests
pnpm typecheck    # tsc across workspaces
pnpm lint         # eslint across workspaces
```

API-only commands:

```sh
pnpm --filter api dev         # watch mode
pnpm --filter api db:migrate  # prisma migrate dev
pnpm --filter api db:seed     # seed demo artists/songs/videos
pnpm --filter api db:studio   # prisma studio
```

The Expo app expects `EXPO_PUBLIC_API_URL` (see `apps/mobile/.env.example`), which defaults to `http://localhost:4000` for the Android emulator / iOS simulator.

## Health check

```
GET http://localhost:4000/health
```
