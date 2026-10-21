# Chuyassi Emmanuel CE

Music & video streaming platform — React Native (Expo) mobile app with an Express REST API, built as a Turborepo monorepo.

## Business model

- **Page subscription — 2 500 FCFA/month.** Users subscribe to the artist's page to unlock the app.
- **Download royalty — 1 FCFA/month per downloaded track**, paid to the artist under the cover of the page subscription (accrued server-side in `download_royalties`, idempotent per month).
- **Offline playback.** Downloaded tracks are stored on-device and played back without a network connection; downloading requires an active subscription (403 `SUBSCRIPTION_REQUIRED` otherwise).

Key endpoints: `POST /api/v1/subscriptions` (subscribe/renew), `GET /api/v1/subscriptions/me`, `DELETE /api/v1/subscriptions/me`, `GET /api/v1/subscriptions/royalties/mine`, `GET /api/v1/subscriptions/royalties/earnings` (artist).

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

## Demo accounts

Created by `pnpm db:seed`. Canonical login: `user@gmail.com` / `password` (auditeur) and `artist@gmail.com` / `password` (créateur). Secondary demo accounts use `phoenix123`.

| Email | Role |
|---|---|
| `user@gmail.com` | Regular user — the full test account (library, chats, orders, payments, ads, …) |
| `artist@gmail.com` | Creator — Aurora Waves |
| `solaris@phoenix.local` | Creator — The Solaris Band |
| `celeste@phoenix.local` | Creator — Celeste Moreau |
| `kaya@phoenix.local` | Creator — Kaya Sound System |
| `nadia@phoenix.local`, `brickz@phoenix.local`, … (8 more creators) | Creator — extra catalog artists |
| `marie@phoenix.local`, `david@phoenix.local`, `grace@phoenix.local`, `imran@phoenix.local` | Friends of the test user (chats, groups, calls) |

The seed fully stocks the test account: every user-scoped table has ≥ 10 rows
for `user@gmail.com` (favorites, playlists, downloads, subscriptions,
conversations, messages, calls, orders, transactions, prayers, sermons,
sheet-music jobs, ad campaigns, …). Re-running `pnpm db:seed` wipes and
rebuilds that data deterministically. The seed also fills the Chuyassi
Emmanuel Pay catalog (school fees, utilities, …), the boutique
categories/products and demo catalog media (SoundHelix MP3s, Google sample
videos, local `/thumbnails` images).

## Connecting a device

`EXPO_PUBLIC_API_URL` (in `apps/mobile/.env`) is baked in at bundle time —
restart the Expo dev server after changing it.

- Android emulator: `http://10.0.2.2:4000`
- iOS simulator: `http://localhost:4000`
- Physical device: `http://<your-LAN-IP>:4000` (same Wi-Fi), and set
  `CORS_ORIGIN` in `apps/api/.env` accordingly if you restrict it.

## Testing

API suite (16 files: auth, artists, favorites, playlists, downloads,
subscriptions, events, conversations, calls/realtime, payments, marketplace,
uploads, push). Tests run against a dedicated `phoenix_test` database — derived
from `DATABASE_URL` by swapping the database name — so the dev database in
Docker must be up:

```sh
pnpm --filter api test          # full suite
pnpm --filter api test:watch    # watch mode
```

Payments use a simulated provider in dev: after initiating a payment in the app
(boutique checkout or a Pay service form), a **"Confirmer le paiement (démo)"**
button appears — it calls `POST /api/v1/payments/:reference/dev-confirm`,
which is disabled in production. WebRTC calls work device-to-device on the same
network without extra setup; symmetric-NAT scenarios need the TURN settings in
`apps/api/.env.example`.

Manual smoke path: register or log in as `user@gmail.com` → play a
song → favorite it → subscribe on the Premium screen → download a track →
airplane-mode playback → boutique add-to-cart → checkout → dev-confirm →
orders screen → Pay flow → messages/voice note → call between two devices →
studio (as `artist@gmail.com`) publish a song.

## Deploying the API

The API deploys to Google Cloud Run as the `phoenix-api` service — see
[infra/gcp/README.md](infra/gcp/README.md). Short version, from the repo root:

```sh
CORS_ORIGIN="https://your-web-app.example.com" \
DATABASE_URL="postgresql://…" \
  ./infra/gcp/deploy.sh
```

The script builds the image (Cloud Build + `apps/api/Dockerfile`), stores
secrets in Secret Manager and wires `CORS_ORIGIN` through all three
CORS-sensitive layers (Express `cors`, Socket.IO, better-auth) — the runbook
explains what belongs in `CORS_ORIGIN` and how to verify it with curl.

