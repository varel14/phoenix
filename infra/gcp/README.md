# Phoenix API on Google Cloud Run

The API ships as a container (`apps/api/Dockerfile`, built from the repo root)
running on **Cloud Run**. One command provisions everything that can be
derived automatically:

```bash
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require" \
  ./infra/gcp/deploy.sh
```

The script is idempotent: it enables the needed APIs, creates the Artifact
Registry repository, creates + IAM-grants the Secret Manager secrets, builds
the image with Cloud Build, deploys the service, and points
`BETTER_AUTH_URL` at the resulting service URL.

Environment variables: `PROJECT`, `REGION` (default `europe-west1`),
`SERVICE` (default `phoenix-api`), `IMAGE_TAG` (default `latest`),
`MIN_INSTANCES`/`MAX_INSTANCES` (default `0`/`1` — scale-to-zero), `SKIP_BUILD=1`
to redeploy the existing image without a rebuild. Optional app config (`R2_*`,
`TURN_*`, `EXPO_PUSH_ACCESS_TOKEN`, `MAX_UPLOAD_MB`, `RING_TIMEOUT_MS`) is
forwarded to the service when set.

`infra/gcp/cloudbuild.yaml` is also usable standalone (e.g. from a git
trigger); the Cloud Run deployment step lives in `deploy.sh` so it runs with
operator credentials instead of the Cloud Build service account.

## CORS — how it is wired

There are **three** CORS-sensitive layers in the API, and all three read the
same `CORS_ORIGIN` env var (comma-separated, see
`apps/api/src/config/env.ts`), so a single deploy variable configures them all:

| Layer | Where | What it uses |
|---|---|---|
| REST (Express) | `apps/api/src/app.ts` `cors()` middleware | origin allow-list, `credentials: true`, handles `OPTIONS` preflights (mounted before better-auth) |
| WebSocket (Socket.IO) | `apps/api/src/lib/realtime.ts` handshake | same origin list for browser `engine.io` connections |
| Auth (better-auth) | `apps/api/src/lib/auth.ts` `trustedOrigins` | same list (CSRF origin check; baseURL trusts itself) |

### Rules the deploy script enforces

1. `CORS_ORIGIN` is **optional for a mobile-only deployment** — native apps
   send no `Origin` header, so CORS never applies to them and an empty list
   (every browser origin blocked) is the correct strict default. Set it as
   soon as any web client needs access.
2. `*` is **rejected** unless `ALLOW_WILDCARD_CORS=1`. The API answers with
   `Access-Control-Allow-Credentials: true`, and the `cors` middleware
   reflects the request origin when set to `*` — that combination lets any
   website read authenticated responses with the user's cookies.
3. Every entry must be a scheme + origin (`https://app.example.com`) — no
   paths, no trailing slash (the script normalizes trailing slashes away).

### What to put in CORS_ORIGIN

- **Native iOS/Android (Expo) clients need nothing** — they send no `Origin`
  header, so CORS never applies to them. (better-auth's CSRF check is already
  disabled for the same reason, see `apps/api/src/lib/auth.ts`.)
- **Web builds / admin dashboards**: list each exact origin, e.g.
  `CORS_ORIGIN="https://app.example.com,https://admin.example.com"`.
- **Custom domains**: if you map a custom domain to the service, keep both the
  run.app URL (until retired) and the custom domain origins listed.
- The script warns if the deployed run.app URL is not in the list — that only
  matters once a *browser* is served from it.

Cloud Run itself is CORS-transparent: it adds no headers and strips nothing,
so the app's responses (including preflights) reach the browser unchanged. If
you later put API Gateway or a load balancer in front, revisit this — those
can mangle or duplicate CORS headers.

### Verifying CORS after deploy

```bash
API="https://phoenix-api-xxxx-ew.a.run.app"
# Preflight from an allowed origin → 204 with echoed origin + credentials:
curl -sik -X OPTIONS "$API/api/v1/artists" \
  -H "Origin: https://your-web-app.example.com" \
  -H "Access-Control-Request-Method: GET" | grep -i "access-control"
# Same request from a non-allowed origin → no access-control-* headers:
curl -sik -X OPTIONS "$API/api/v1/artists" \
  -H "Origin: https://evil.example.com" \
  -H "Access-Control-Request-Method: GET" | grep -i "access-control"
```

Changing origins is a redeploy of the env var, no rebuild needed:

```bash
CORS_ORIGIN="…" SKIP_BUILD=1 ./infra/gcp/deploy.sh
```

## Before the first deploy

- **Database**: `DATABASE_URL` must point at a Postgres reachable from Cloud
  Run — the docker-compose database is not. Easiest: a managed Postgres
  (Neon, Supabase) or Cloud SQL. For Cloud SQL, pass
  `CLOUDSQL_INSTANCE=PROJECT:REGION:INSTANCE` to `deploy.sh`: it attaches the
  instance to the service and grants `roles/cloudsql.client`, and you store
  the unix-socket URL as the secret (keep the Cloud SQL **public IP disabled**
  to avoid the ~$7/month IP charge):
  `postgresql://USER:PASS@/phoenix?host=/cloudsql/PROJECT:REGION:INSTANCE`
- **Using Neon** (true scale-to-zero, free tier): copy the **pooled**
  connection string (host contains `-pooler`) from the Neon dashboard for the
  `DATABASE_URL` secret. Run migrations against the **direct** (non-pooler)
  host — `pnpm --filter api db:deploy` — since PgBouncer's transaction pooling
  is unsuitable for them. Both strings already carry `?sslmode=require`,
  which the pg driver in the API honors. Expect a short wake-up (~0.5 s) on
  the first request after the ~5 min idle suspend; `curl $URL/health` should
  report `database: up` once wired.
- **Migrations**: the image ships `prisma/migrations`, but run
  `pnpm --filter api db:deploy` (from a machine/CI with dev dependencies)
  against the production `DATABASE_URL` before routing traffic to a fresh
  database.
- **Secrets** (created automatically; rotate with
  `echo -n <value> | gcloud secrets versions add <name> --data-file=-`):
  - `phoenix-api-database-url` — from your `DATABASE_URL`
  - `phoenix-api-better-auth-secret` — auto-generated
  - `phoenix-api-payment-webhook-secret` — auto-generated

## Runtime notes on Cloud Run

- **Single instance by default** (`--max-instances=1`): Socket.IO rooms and
  the online-presence check are in-memory. Scaling past one instance without
  the `@socket.io/redis-adapter` would silently split chat/call delivery.
  Raise `MAX_INSTANCES` only after adding the Redis adapter.
- **`--session-affinity` + `--timeout 3600`**: Socket.IO's long-polling
  handshake must stick to one instance, and WebSocket connections ride on the
  request timeout — the default 5 min would drop idle sockets far too early.
- **Uploads are ephemeral**: `/app/data/*` lives on the instance's
  memory-backed filesystem — files disappear on restart/deploy and are not
  shared across instances. Configure the R2 object-storage variables for
  anything that must persist (then only presigned/small temp files touch
  disk). Keep `MAX_UPLOAD_MB` ≤ 32 (Cloud Run request size limit).
- **Health endpoints**: `/api/v1/health` (process-only) backs the startup and
  liveness probes; `/health` also reports database status for humans.
- **Custom domain**: `gcloud beta run domain-mappings create --service phoenix-api …`,
  then redeploy with `BETTER_AUTH_URL=https://<custom-domain>` so better-auth
  issues cookies/links against it, and include the new origin in
  `CORS_ORIGIN` if a browser talks to it.

## Cost options

First, the terminology trap: **Cloud SQL is not serverless.** It has no
scale-to-zero mode — an instance bills 24/7 whether or not anything connects.
The serverless part of this stack is already Cloud Run. What that means in
practice (approximate, us/europe regions — check the
[pricing calculator](https://cloud.google.com/products/calculator)):

| Piece | Always-on cost | Can it go to zero? |
|---|---|---|
| Cloud Run, `MIN_INSTANCES=0` (**default**) | $0 when nobody is connected | Yes — cold start (seconds) on first connect |
| Cloud Run, `MIN_INSTANCES=1` (opt-in) | ~$15–27/mo for the warm idle instance | No — that's what min-instances means |
| Cloud SQL `db-f1-micro` + 10 GB SSD | ~$11–13/mo, always | No — always-on by design |
| Cloud SQL public IP | ~$7/mo extra | Avoid: use the unix socket (above) |
| Neon / Supabase free tier | $0 | Yes — true scale-to-zero Postgres |

Two caveats when chasing the minimum:

1. **Realtime keeps instances alive.** Socket.IO connections are billable
   requests for their whole lifetime — once any user has the app open, an
   instance runs (and bills) regardless of `MIN_INSTANCES`. Scale-to-zero
   only saves money in periods where *nobody* is connected. It also means the
   first user after an idle gap waits for a cold start (a few seconds with
   this image, plus Neon's ~0.5 s wake if the DB suspended).
2. **Downsizing further**: `CPU=0.25 MEMORY=512Mi ./infra/gcp/deploy.sh` —
   the API only relays WebRTC signaling (media goes P2P/TURN), so a small CPU
   is viable for light usage, but watch latency on calls.

If $0 matters more than staying GCP-native, point `DATABASE_URL` at
[Neon](https://neon.tech) or [Supabase](https://supabase.com) free tiers
(true serverless Postgres that suspends when idle) and keep everything else
as-is — the deploy script is database-agnostic. Watch their idle-suspend
latency (~0.5–1 s wake) and free-tier limits before betting production on it.

## Pointing the mobile app at the deployment

The app reads its API base URL from `EXPO_PUBLIC_API_URL`
(`apps/mobile/src/services/api/api-client.ts`), which Expo inlines into the
JS bundle — so it is fixed at bundle time, per environment:

```sh
# apps/mobile/.env (gitignored, local overrides)
EXPO_PUBLIC_API_URL=https://phoenix-api-xxxx-ew.a.run.app
```

- **Dev (metro / dev client)**: restart with `npx expo start -c` — the value
  is only re-read on restart.
- **EAS builds**: EAS picks up `apps/mobile/.env` at build time, or pass it
  inline: `cd apps/mobile && EXPO_PUBLIC_API_URL=… eas build --profile <name>`.
  Any installed binary keeps the URL it was built with — rebuild after
  changing it.
- Nothing else to configure for native clients: they send no `Origin` header
  (CORS doesn't apply), and the deploy script already set `BETTER_AUTH_URL`
  to the service URL for auth cookies and links.

## Environment on the service

Plain env vars: `NODE_ENV`, `CORS_ORIGIN`, `BETTER_AUTH_URL`,
`THUMBNAILS_DIR=/app/thumbnails`, `UPLOADS_DIR=/app/data/uploads`,
`DIGITAL_FILES_DIR=/app/data/digital-files` (+ optional passthroughs above).

Secrets (Secret Manager → env): `DATABASE_URL`, `BETTER_AUTH_SECRET`,
`PAYMENT_WEBHOOK_SECRET`.

Local dry run of the same image:
`docker build -f apps/api/Dockerfile -t phoenix-api . && docker run -p 8080:8080 phoenix-api`
(with `NODE_ENV=development` defaults it boots without secrets).
