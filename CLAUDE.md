# key-loc8 (Key-Locate)

Multi-tenant operations platform: key tracking, audits with NFC, lone working,
uniforms, policies. Live at https://staff.shopkillieicehockey.com. Real staff use it,
so keep changes small, safe and focused on exactly what was asked.

The person asking for changes is often not a developer. Reply in simple,
everyday language: say what you changed and what they should check on the site.

## Layout
- `public/Key-Locate/` – the app (everything lives here)
  - `client/src/` – React 18 + TypeScript, Wouter routing, TanStack Query,
    Radix UI + Tailwind, React Hook Form + Zod
  - `server/` – Express (ESM TypeScript). `routes.ts` is the main API
  - `shared/schema.ts` – Drizzle ORM schema (PostgreSQL 16)
  - `replit.md` – fuller feature notes; `EMPLOYEE_GUIDE.md` – user guide
- `docker-compose.yml` – production stack (db + app) behind Plesk
- `scripts/deploy.sh` – run on the server after every merge to `main`

## Checking your work
Packages are already installed. Before finishing, always run:

    npm --prefix public/Key-Locate run build

It must succeed. (`npm run check`/tsc already has many old errors across the
codebase; don't try to fix those unless asked, and don't add new ones in files you touch.)

## Rules
- Every query must stay scoped to the user's `companyId`. Never weaken
  multi-tenant isolation, authentication, role checks or audit logging.
- Database: changes to `shared/schema.ts` are applied automatically on deploy with
  `drizzle-kit push`. Only make **additive** changes (new tables, new nullable
  columns or columns with defaults). Never rename or drop tables/columns, or
  change a column type, without saying so loudly in the PR description – it can
  lose live data. Mention any schema change in the PR description.
- Never commit `.env`, secrets, API keys, cookie files, database dumps or backups.
- Don't change `docker-compose.yml`, `Dockerfile`, `scripts/deploy.sh` or
  `.github/` unless the request is specifically about deployment.
- Don't add new npm packages unless truly needed; if you do, update `package-lock.json`
  with `npm --prefix public/Key-Locate install <pkg>`.
- Keep the existing look and component style (shadcn/Radix components in
  `client/src/components/ui`).
