# Docker deployment

The application is built from `public/Key-Locate` and runs behind Plesk. PostgreSQL 16 is provided by Docker Compose.

## First deployment

```bash
cp .env.example .env
nano .env
docker compose build
docker compose up -d db
docker compose ps
```

Restore the production database **from a secure local/server path, not from Git**.

For a custom-format `pg_dump -Fc` backup:

```bash
cat /secure/path/production.dump | docker compose exec -T db pg_restore \
  --clean --if-exists --no-owner --no-privileges \
  -U keyloc8 -d keyloc8
```

For a plain SQL dump:

```bash
cat /secure/path/production.sql | docker compose exec -T db psql -U keyloc8 -d keyloc8
```

Then start the application:

```bash
docker compose up -d app
docker compose ps
docker compose logs --tail=100 app
curl http://127.0.0.1:${APP_PORT:-8088}/api/health
```

The default host binding is `127.0.0.1:8088`. Point the Plesk reverse proxy at that local address/port.

## Updates

```bash
git pull
docker compose build --pull app
docker compose up -d app
docker image prune -f
```

## Important

Do not commit `.env`, database dumps, SQL exports, backups, API keys, session secrets, or production cookie files. The repository ignore rules cover the common dump/archive extensions, but production data should be transferred directly to the server.
