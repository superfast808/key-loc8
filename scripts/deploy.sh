#!/usr/bin/env bash
# Safe deploy for key-loc8. Run from the repo folder on the server.
# The Deploy GitHub Action calls this after every merge to main.
#
#  1. Backs up the database (keeps the last 14 in ./backups, which Git ignores)
#  2. Pulls the latest main
#  3. Builds the new app image (the old app keeps running meanwhile)
#  4. If the database schema changed, applies it with drizzle-kit push
#  5. Restarts the app and waits for /api/health
#  6. If any step fails, puts the previous version back
set -euo pipefail

BRANCH="${DEPLOY_BRANCH:-main}"
[ -f docker-compose.yml ] || { echo "Run this from the key-loc8 repo folder"; exit 1; }
[ -f .env ] || { echo "No .env here - refusing to deploy"; exit 1; }

APP_PORT="$(grep -E '^APP_PORT=' .env | tail -n1 | cut -d= -f2 | tr -d '"' || true)"
APP_PORT="${APP_PORT:-8088}"

PREV="$(git rev-parse HEAD)"
git fetch origin "$BRANCH"
NEW="$(git rev-parse "origin/$BRANCH")"

if [ "$PREV" = "$NEW" ]; then
  echo "Already on $NEW - rebuilding anyway"
fi

echo "==> Deploying ${PREV:0:7} -> ${NEW:0:7}"

rollback() {
  echo "!!! Deploy failed - going back to ${PREV:0:7}"
  git reset --hard "$PREV"
  docker compose build app && docker compose up -d app
  echo "!!! Previous version restored. Database backup: ${BACKUP:-none}"
  exit 1
}

# 1. Database backup
mkdir -p backups
BACKUP="backups/keyloc8-$(date +%Y%m%d-%H%M%S)-${PREV:0:7}.dump"
echo "==> Backing up database to $BACKUP"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$BACKUP"
ls -1t backups/keyloc8-*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f

# 2. Pull new code (fast-forward only; never overwrites local commits)
git merge --ff-only "origin/$BRANCH" || { echo "Server copy has diverged from $BRANCH - fix by hand"; exit 1; }

# 3. Build new image
echo "==> Building app image"
docker compose build --pull app || rollback

# 4. Schema changes
if ! git diff --quiet "$PREV" "$NEW" -- public/Key-Locate/shared/schema.ts; then
  echo "==> Database schema changed - applying with drizzle-kit push"
  docker compose --profile tools build migrate || rollback
  timeout 300 docker compose --profile tools run --rm -T migrate || rollback
fi

# 5. Restart and health check
echo "==> Restarting app"
docker compose up -d app || rollback

echo "==> Waiting for http://127.0.0.1:${APP_PORT}/api/health"
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" > /dev/null 2>&1; then
    echo "==> Healthy. Deployed ${NEW:0:7}"
    docker image prune -f > /dev/null || true
    exit 0
  fi
  sleep 5
done

echo "!!! App did not become healthy. Last logs:"
docker compose logs --tail=80 app || true
rollback
