# Phoenix API on Google Cloud Run

The API ships as a container (`apps/api/Dockerfile`, built from the repo root)
running on **Cloud Run**. One command provisions everything that can be
derived automatically:

```bash
CORS_ORIGIN="https://your-web-app.example.com" \
DATABASE_URL="postgresql://user:pass@host:5432/phoenix" \
  ./infra/gcp/deploy.sh
```

The script is idempotent: it enables the needed APIs, creates the Artifact
Registry repository, creates + IAM-grants the Secret Manager secrets, builds
the image with Cloud Build, deploys the service, and points
`BETTER_AUTH_URL` at the resulting service URL.

Environment variables: `PROJECT`, `REGION` (default `europe-west1`),
`SERVICE` (default `phoenix-api`), `IMAGE_TAG` (default `latest`),
`MIN_INSTANCES`/`MAX_INSTANCES` (default `1`/`1`), `SKIP_BUILD=1` to redeploy
the existing image without a rebuild. Optional app config (`R2_*`, `TURN_*`,
`EXPO_PUSH_ACCESS_TOKEN`, `MAX_UPLOAD_MB`, `RING_TIMEOUT_MS`) is forwarded to
the service when set.

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

1. `CORS_ORIGIN` is **required** — the script refuses to deploy without it.
   No silent wildcard in production.
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
  (Neon, Supabase) or Cloud SQL. Cloud SQL private-IP variant additionally
  needs a Serverless VPC connector on the service.
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

## Environment on the service

Plain env vars: `NODE_ENV`, `CORS_ORIGIN`, `BETTER_AUTH_URL`,
`THUMBNAILS_DIR=/app/thumbnails`, `UPLOADS_DIR=/app/data/uploads`,
`DIGITAL_FILES_DIR=/app/data/digital-files` (+ optional passthroughs above).

Secrets (Secret Manager → env): `DATABASE_URL`, `BETTER_AUTH_SECRET`,
`PAYMENT_WEBHOOK_SECRET`.

Local dry run of the same image:
`docker build -f apps/api/Dockerfile -t phoenix-api . && docker run -p 8080:8080 phoenix-api`
(with `NODE_ENV=development` defaults it boots without secrets).
