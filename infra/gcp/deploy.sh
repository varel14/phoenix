#!/usr/bin/env bash
# Deploys the Phoenix API to Google Cloud Run.
#
# Usage (mobile-only deploy, no CORS_ORIGIN needed):
#   DATABASE_URL="postgresql://…neon.tech/neondb?sslmode=require" \
#     ./infra/gcp/deploy.sh
#
# Required environment variables:
#   DATABASE_URL   Postgres connection string (e.g. Neon's pooled URL). Stored
#                  in Secret Manager on first deploy.
#
# Optional environment variables (see infra/gcp/README.md for details):
#   CORS_ORIGIN    Comma-separated list of exact origins allowed to call the
#                  API from a browser (e.g. "https://app.example.com").
#                  Omit for a mobile-only deployment — native apps send no
#                  Origin header, so all browser origins are then blocked.
#                  "*" is rejected — with `credentials: true` it would let
#                  every website make credentialed requests. Override with
#                  ALLOW_WILDCARD_CORS=1 only for throwaway sandboxes.
#   PROJECT, REGION, SERVICE, REPOSITORY, IMAGE_TAG
#   PROJECT, REGION, SERVICE, REPOSITORY, IMAGE_TAG
#   BETTER_AUTH_URL     Custom base URL (e.g. https://api.example.com).
#                       Defaults to the Cloud Run service URL.
#   CLOUDSQL_INSTANCE   Cloud SQL connection name (PROJECT:REGION:INSTANCE).
#                       Attaches the instance to Cloud Run and grants the
#                       runtime SA cloudsql.client — connect via the unix
#                       socket: postgresql://user:pass@/phoenix?host=/cloudsql/PROJECT:REGION:INSTANCE
#                       (keeps the Cloud SQL public IP disabled — no IP fee).
#   MIN_INSTANCES=0 MAX_INSTANCES=1 CPU=1 MEMORY=1Gi CONCURRENCY=80 TIMEOUT=3600
#                       Default 0 = scale-to-zero (idle cost $0, cold start on
#                       first connect). MIN_INSTANCES=1 keeps one warm instance.
#   SKIP_BUILD=1        Redeploy the existing image without rebuilding.
#   SEED=1              Run migrations + demo seed as a Cloud Run Job (from
#                       GCP's network — fast). Off by default: the seed
#                       writes demo content; never use on data worth keeping.
#   ALLOW_WILDCARD_CORS=1
#   R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET
#   R2_PUBLIC_BASE_URL TURN_URL TURN_USERNAME TURN_CREDENTIAL TURN_AUTH_SECRET
#   TURN_CREDENTIAL_TTL_SEC EXPO_PUSH_ACCESS_TOKEN MAX_UPLOAD_MB RING_TIMEOUT_MS

set -euo pipefail

PROJECT="${PROJECT:-"$(gcloud config get-value project 2>/dev/null)"}"
REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-phoenix-api}"
REPOSITORY="${REPOSITORY:-phoenix}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
MIN_INSTANCES="${MIN_INSTANCES:-0}" # scale-to-zero by default: $0 idle, cold start on first connect
MAX_INSTANCES="${MAX_INSTANCES:-1}"
CPU="${CPU:-1}"
MEMORY="${MEMORY:-1Gi}"
CONCURRENCY="${CONCURRENCY:-80}"
TIMEOUT="${TIMEOUT:-3600}" # seconds — WebSocket connections ride on this budget

log() { printf '\033[1;36m[deploy]\033[0m %s\n' "$1"; }
die() { printf '\033[1;31m[deploy] ERROR:\033[0m %s\n' "$1" >&2; exit 1; }

[ -n "$PROJECT" ] || die "No GCP project. Run 'gcloud config set project <id>' or pass PROJECT=<id>."
command -v gcloud >/dev/null || die "gcloud CLI is required."
[ -f infra/gcp/cloudbuild.yaml ] || die "Run this script from the repository root (it needs infra/gcp/cloudbuild.yaml)."
# --- CORS validation --------------------------------------------------------
# Single source of truth for all three CORS-sensitive layers in the API:
# express `cors` middleware, Socket.IO handshake and better-auth trustedOrigins
# all read env.CORS_ORIGIN (see apps/api/src/config/env.ts).
# Optional: a mobile-only deployment needs no browser origins (native apps
# send no Origin header, so CORS never applies to them) — omit the variable
# and every browser origin is blocked. Set it as soon as a web client exists.
if [ -z "${CORS_ORIGIN:-}" ]; then
  log "CORS_ORIGIN unset — mobile-only deploy: all browser origins will be blocked."
  log "Native mobile clients are unaffected. Set CORS_ORIGIN and redeploy when a web client needs access."
  CORS_ORIGIN=""
fi
normalize_origins() {
  printf '%s' "$1" | tr ',' '\n' | sed 's#^[[:space:]]*##; s#[[:space:]]*$##; s#/*$##' | grep -v '^$' || true
}
ORIGINS="$(normalize_origins "$CORS_ORIGIN")"
if printf '%s\n' "$ORIGINS" | grep -qx '\*'; then
  if [ "${ALLOW_WILDCARD_CORS:-0}" != "1" ]; then
    die "CORS_ORIGIN='*' is not allowed for a Cloud Run deployment.
  The API answers with credentials: true, so a wildcard reflects any origin
  and every website could call the API with the user's cookies.
  List your real origins instead, or set ALLOW_WILDCARD_CORS=1 to override
  (sandbox only)."
  fi
  log "WARNING: wildcard CORS forced via ALLOW_WILDCARD_CORS=1 — do not use in production."
fi
BAD_ORIGIN="$(printf '%s\n' "$ORIGINS" | grep -v '^https\?://' | head -1 || true)"
[ -z "$BAD_ORIGIN" ] || die "Origin '$BAD_ORIGIN' in CORS_ORIGIN is not an http(s):// origin."
CORS_ORIGIN="$(printf '%s\n' "$ORIGINS" | paste -sd, -)"
log "CORS origins: $CORS_ORIGIN"

IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPOSITORY}/api:${IMAGE_TAG}"

# --- One-time project setup (all idempotent) --------------------------------
log "Enabling required APIs…"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com --project "$PROJECT" >/dev/null

log "Ensuring Artifact Registry repository '$REPOSITORY' in $REGION…"
gcloud artifacts repositories describe "$REPOSITORY" --location "$REGION" --project "$PROJECT" >/dev/null 2>&1 || \
  gcloud artifacts repositories create "$REPOSITORY" --repository-format docker \
    --location "$REGION" --project "$PROJECT" --description "Phoenix images" >/dev/null

# --- Secrets -----------------------------------------------------------------
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

ensure_secret() { # $1 name, $2 value-or-empty, $3 hint-if-missing
  local name="$1" value="${2:-}"
  if gcloud secrets describe "$name" --project "$PROJECT" >/dev/null 2>&1; then
    log "Secret $name already exists."
    return 0
  fi
  if [ -z "$value" ]; then
    die "Secret '$name' does not exist and no value was provided.
  Create it with:  $3"
  fi
  printf '%s' "$value" | gcloud secrets create "$name" --data-file=- --project "$PROJECT" >/dev/null
  log "Created secret $name."
}

ensure_secret "phoenix-api-database-url" "${DATABASE_URL:-}" \
  "echo 'postgres://…' | gcloud secrets create phoenix-api-database-url --data-file=- --project $PROJECT"
ensure_secret "phoenix-api-better-auth-secret" \
  "$( [ -n "${BETTER_AUTH_SECRET:-}" ] && printf '%s' "$BETTER_AUTH_SECRET" || openssl rand -base64 32 )"
ensure_secret "phoenix-api-payment-webhook-secret" \
  "$( [ -n "${PAYMENT_WEBHOOK_SECRET:-}" ] && printf '%s' "$PAYMENT_WEBHOOK_SECRET" || openssl rand -base64 32 )"
ensure_secret "phoenix-api-app-lock-secret" \
  "$( [ -n "${APP_LOCK_SECRET:-}" ] && printf '%s' "$APP_LOCK_SECRET" || openssl rand -base64 32 )"
ensure_secret "phoenix-api-app-lock-admin-key" \
  "$( [ -n "${APP_LOCK_ADMIN_KEY:-}" ] && printf '%s' "$APP_LOCK_ADMIN_KEY" || openssl rand -base64 32 )"

grant_secret_access() {
  local name="$1"
  if gcloud secrets get-iam-policy "$name" --project "$PROJECT" 2>/dev/null | \
     grep -B10 "roles/secretmanager.secretAccessor" | grep -q "serviceAccount:${RUNTIME_SA}"; then
    return 0
  fi
  log "Granting secretAccessor on $name to the runtime service account…"
  gcloud secrets add-iam-policy-binding "$name" --project "$PROJECT" \
    --member "serviceAccount:${RUNTIME_SA}" --role roles/secretmanager.secretAccessor >/dev/null
}
for s in phoenix-api-database-url phoenix-api-better-auth-secret phoenix-api-payment-webhook-secret \
  phoenix-api-app-lock-secret phoenix-api-app-lock-admin-key; do
  grant_secret_access "$s"
done

# --- Optional Cloud SQL attachment -------------------------------------------
EXTRA_DEPLOY_FLAGS=()
if [ -n "${CLOUDSQL_INSTANCE:-}" ]; then
  log "Attaching Cloud SQL instance $CLOUDSQL_INSTANCE…"
  gcloud services enable sqladmin.googleapis.com --project "$PROJECT" >/dev/null
  if ! gcloud projects get-iam-policy "$PROJECT" --format=json 2>/dev/null | \
     grep -B3 "roles/cloudsql.client" | grep -q "serviceAccount:${RUNTIME_SA}"; then
    gcloud projects add-iam-policy-binding "$PROJECT" \
      --member "serviceAccount:${RUNTIME_SA}" --role roles/cloudsql.client >/dev/null
    log "Granted roles/cloudsql.client to the runtime service account."
  fi
  EXTRA_DEPLOY_FLAGS+=(--add-cloudsql-instances "$CLOUDSQL_INSTANCE")
  if [ -n "${DATABASE_URL:-}" ] && ! printf '%s' "$DATABASE_URL" | grep -q "/cloudsql/"; then
    log "NOTE: CLOUDSQL_INSTANCE is set but DATABASE_URL does not use the unix socket.
  Expected shape: postgresql://USER:PASS@/phoenix?host=/cloudsql/${CLOUDSQL_INSTANCE}"
  fi
fi

# --- Build -------------------------------------------------------------------
if [ "${SKIP_BUILD:-0}" = "1" ]; then
  log "SKIP_BUILD=1 — deploying existing image $IMAGE"
else
  log "Building $IMAGE via Cloud Build…"
  gcloud builds submit --project "$PROJECT" --config infra/gcp/cloudbuild.yaml \
    --substitutions "_REGION=${REGION},_REPOSITORY=${REPOSITORY},_IMAGE_TAG=${IMAGE_TAG}" .
fi

# --- Deploy --------------------------------------------------------------------
service_url() {
  gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT" \
    --format='value(status.url)' 2>/dev/null || true
}
# better-auth needs its public base URL for cookies and links. Use the
# operator-provided one, or the service URL once the service exists.
AUTH_URL="${BETTER_AUTH_URL:-"$(service_url)"}"
AUTH_URL_IS_PLACEHOLDER=0
if [ -z "$AUTH_URL" ]; then
  AUTH_URL="https://pending.invalid" # fixed up right after the first deploy
  AUTH_URL_IS_PLACEHOLDER=1
fi

# gcloud splits --set-env-vars on commas unless a custom delimiter is given
# (^;^ prefix); CORS_ORIGIN and TURN_URL both contain commas, so use ';'.
ENV_ITEMS=("NODE_ENV=production"
  "CORS_ORIGIN=${CORS_ORIGIN}"
  "BETTER_AUTH_URL=${AUTH_URL}"
  "THUMBNAILS_DIR=/app/thumbnails"
  "UPLOADS_DIR=/app/data/uploads"
  "DIGITAL_FILES_DIR=/app/data/digital-files")
for var in MAX_UPLOAD_MB RING_TIMEOUT_MS \
  R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET R2_PUBLIC_BASE_URL \
  TURN_URL TURN_USERNAME TURN_CREDENTIAL TURN_AUTH_SECRET TURN_CREDENTIAL_TTL_SEC \
  EXPO_PUSH_ACCESS_TOKEN; do
  if [ -n "${!var:-}" ]; then ENV_ITEMS+=("${var}=${!var}"); fi
done
ENV_ARG="^;^$(IFS=';'; printf '%s' "${ENV_ITEMS[*]}")"

log "Deploying $SERVICE to Cloud Run ($REGION)…"
gcloud run deploy "$SERVICE" --project "$PROJECT" --region "$REGION" \
  --image "$IMAGE" \
  --port 8080 \
  --cpu "$CPU" --memory "$MEMORY" \
  --min-instances "$MIN_INSTANCES" --max-instances "$MAX_INSTANCES" \
  --concurrency "$CONCURRENCY" \
  --session-affinity \
  --timeout "$TIMEOUT" \
  --execution-environment gen2 \
  --startup-probe "httpGet.path=/api/v1/health,httpGet.port=8080,initialDelaySeconds=5,periodSeconds=5,timeoutSeconds=5,failureThreshold=12" \
  --liveness-probe "httpGet.path=/api/v1/health,httpGet.port=8080,periodSeconds=30,timeoutSeconds=5,failureThreshold=3" \
  --set-secrets "DATABASE_URL=phoenix-api-database-url:latest,BETTER_AUTH_SECRET=phoenix-api-better-auth-secret:latest,PAYMENT_WEBHOOK_SECRET=phoenix-api-payment-webhook-secret:latest,APP_LOCK_SECRET=phoenix-api-app-lock-secret:latest,APP_LOCK_ADMIN_KEY=phoenix-api-app-lock-admin-key:latest" \
  --set-env-vars "$ENV_ARG" \
  --allow-unauthenticated \
  --ingress all \
  "${EXTRA_DEPLOY_FLAGS[@]}"

# --- Post-deploy wiring & CORS audit ------------------------------------------
URL="$(service_url)"
[ -n "$URL" ] || die "Deploy finished but the service URL could not be read."

if [ "$AUTH_URL_IS_PLACEHOLDER" = "1" ]; then
  log "Setting BETTER_AUTH_URL=$URL…"
  gcloud run services update "$SERVICE" --region "$REGION" --project "$PROJECT" \
    --update-env-vars "BETTER_AUTH_URL=$URL" >/dev/null
  AUTH_URL="$URL"
elif [ -n "${BETTER_AUTH_URL:-}" ]; then
  log "Using operator-provided BETTER_AUTH_URL=$AUTH_URL."
fi

# --- Optional: migrations + seed as a Cloud Run Job (SEED=1) ------------------
# Runs from GCP's network next to the service — minutes instead of the
# hour-plus a laptop on a faraway/flaky link needs for thousands of queries.
# Off by default: the seed writes demo content; never point it at data you
# want to keep.
if [ "${SEED:-0}" = "1" ]; then
  SEED_JOB="phoenix-api-seed"
  SEED_IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPOSITORY}/api:seed"
  JOB_ENV_ITEMS=("NODE_ENV=production"
    "THUMBNAILS_DIR=/app/thumbnails"
    "UPLOADS_DIR=/app/data/uploads"
    "DIGITAL_FILES_DIR=/app/data/digital-files")
  for var in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET R2_PUBLIC_BASE_URL; do
    if [ -n "${!var:-}" ]; then JOB_ENV_ITEMS+=("${var}=${!var}"); fi
  done
  JOB_ENV_ARG="^;^$(IFS=';'; printf '%s' "${JOB_ENV_ITEMS[*]}")"
  JOB_SECRETS="DATABASE_URL=phoenix-api-database-url:latest,BETTER_AUTH_SECRET=phoenix-api-better-auth-secret:latest,PAYMENT_WEBHOOK_SECRET=phoenix-api-payment-webhook-secret:latest,APP_LOCK_SECRET=phoenix-api-app-lock-secret:latest,APP_LOCK_ADMIN_KEY=phoenix-api-app-lock-admin-key:latest"
  JOB_CMD=(/bin/sh -c "cd /app/apps/api && npx prisma migrate deploy && npx prisma db seed")

  if gcloud run jobs describe "$SEED_JOB" --region "$REGION" --project "$PROJECT" >/dev/null 2>&1; then
    log "Updating Cloud Run Job $SEED_JOB…"
    gcloud run jobs update "$SEED_JOB" --region "$REGION" --project "$PROJECT" \
      --image "$SEED_IMAGE" --set-secrets "$JOB_SECRETS" --set-env-vars "$JOB_ENV_ARG" >/dev/null
  else
    log "Creating Cloud Run Job $SEED_JOB…"
    gcloud run jobs create "$SEED_JOB" --region "$REGION" --project "$PROJECT" \
      --image "$SEED_IMAGE" \
      --command "${JOB_CMD[0]}" --args "${JOB_CMD[1]},${JOB_CMD[2]}" \
      --cpu 1 --memory 1Gi --timeout 1800 --max-retries 1 --parallelism 1 \
      --set-secrets "$JOB_SECRETS" --set-env-vars "$JOB_ENV_ARG" >/dev/null
  fi

  log "Running migrations + seed on GCP (execution of $SEED_JOB)…"
  if gcloud run jobs execute "$SEED_JOB" --region "$REGION" --project "$PROJECT" --wait >/dev/null; then
    log "Seed job completed."
  else
    die "Seed job failed — inspect with:
  gcloud run jobs executions logs read $SEED_JOB --region $REGION --project $PROJECT --tail=50"
  fi
fi

if printf '%s\n' "$ORIGINS" | grep -qF "$URL"; then
  log "Service URL $URL is already in CORS_ORIGIN."
else
  log "NOTE: $URL is NOT in CORS_ORIGIN — fine for native mobile clients, but a
  browser served from that URL (or a custom domain) would be blocked. Add it to
  CORS_ORIGIN and redeploy when you need browser access."
fi

log "Done. API: $URL"
log "Health check: curl -fsS $URL/health   (includes DB status; probes use /api/v1/health)"
log "Logs:         gcloud run services logs read $SERVICE --region $REGION --project $PROJECT --tail"
