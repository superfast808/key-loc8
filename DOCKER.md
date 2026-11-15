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

## Full database export from the admin interface

Sign in as a **platform super-admin** (not a company-level admin), open
**Platform Administration**, and click **Export Database (.dump)** under
**Full Database Export**. The browser downloads a PostgreSQL **custom-format**
archive created by PostgreSQL 16 `pg_dump` and streamed directly from the app;
it is not saved in the container or repository.

- Includes the schema and records from **all companies** and application tables.
- Excludes **active session row data** from `public.sessions` for security.
- Includes sensitive user data and password hashes. Store the file in a secure
  location and never email it or commit it to Git.
- Existing per-company JSON snapshots still work separately. Those are not
  equivalent to a restorable PostgreSQL database dump.

To inspect the download using the PostgreSQL 16 tools already available in
the database container, from the Compose directory:

```bash
docker compose exec -T db pg_restore --list < /secure/path/keyloc8-database-TIMESTAMP.dump | head -30
```

**Restore only after validating the archive, and preferably into a test database
first.** Restoring into an existing database replaces its current data. Stop
the app before any deliberate production restore:

```bash
docker compose stop app
docker compose exec -T db pg_restore \
  --clean --if-exists --no-owner --no-privileges \
  -U "${POSTGRES_USER:-keyloc8}" -d "${POSTGRES_DB:-keyloc8}" \
  < /secure/path/keyloc8-database-TIMESTAMP.dump
docker compose up -d app
```

Because login session data is excluded, users must sign in again after a
restore. The export button appears only in platform administration; the API
endpoint checks the same role server-side.

## Full database export over SSH (no GUI)

From the repository root on the host:

```bash
bash scripts/export-database.sh
```

This runs `pg_dump` **inside the PostgreSQL Docker Compose service**, so no
`pg_dump` installation or database password is needed on the host.
It produces a timestamped, PostgreSQL custom-format archive containing the
application database (schema and all companies' data, excluding live session
rows), verifies its table of contents, then atomically moves it into
`/var/backups/keyloc8/`. The script does not stop the site, restore anything,
or prune old backups.

To select a different destination:

```bash
BACKUP_DIR="$HOME/keyloc8-backups" bash scripts/export-database.sh
```

A failed export removes its temporary file; the script exits non-zero, making
it suitable for cron/monitoring. A successful archive is readable only to the
account running the script. Store an encrypted copy **off the server** for
disaster recovery, and periodically test restoring into a disposable database.

## Important

Do not commit `.env`, database dumps, SQL exports, backups, API keys, session secrets, or production cookie files. The repository ignore rules cover the common dump/archive extensions, but production data should be transferred directly to the server.
