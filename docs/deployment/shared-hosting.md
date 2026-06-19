# Deploying Typress on shared hosting (Hostinger / cPanel / Passenger)

Typress can run on shared hosting that supports **Node.js apps via Phusion
Passenger** (Hostinger, cPanel "Setup Node.js App", Plesk, and similar). This is
a more constrained environment than a VPS, so read the caveats first.

> **Recommended:** if you can use a VPS, follow [vps.md](./vps.md) instead — it
> gives you Docker, nginx, and full control. Shared hosting is supported but
> involves manual steps and a database caveat (below).

---

## Caveat: the database

Typress uses Prisma and is **DB-agnostic by design, with one exception**: the
full-text **search** feature (Phase 8) uses PostgreSQL-specific SQL
(`to_tsvector` / `websearch_to_tsquery` / `ts_rank`). So:

- **Best:** use **PostgreSQL** if your host offers it (many do, or use a managed
  Postgres such as Neon/Supabase/RDS and point `DATABASE_URL` at it). Everything
  works, including search.
- **MySQL/MariaDB only:** the rest of the CMS works, but `/search` and
  `GET /public/search` will error. Either disable/hide the search UI, or front
  Typress with a managed PostgreSQL. Switching providers also means changing the
  Prisma `datasource` provider and regenerating migrations.

Treat PostgreSQL as a requirement unless you are prepared to drop search.

---

## 1. Build locally, upload artifacts

Shared hosts rarely have enough resources to build Next.js. Build on your
machine (or CI) and upload the result.

```bash
corepack enable
pnpm install --frozen-lockfile

# NEXT_PUBLIC_* are inlined now — set them before building.
export NEXT_PUBLIC_API_URL=https://api.yourdomain.com
export NEXT_PUBLIC_SITE_URL=https://yourdomain.com
pnpm build
```

You will deploy **two Node apps** (the host runs each as a separate Passenger
application): the API (`apps/api`) and the web app (`apps/web`).

---

## 2. Create the databases and run migrations

Create a PostgreSQL database in your hosting panel and note the connection
string. From your machine, with `DATABASE_URL` pointing at it:

```bash
pnpm --filter @typress/db migrate     # prisma migrate deploy
pnpm --filter @typress/db seed        # first time only
```

(Run these from anywhere that can reach the database; they do not need to run on
the host.)

---

## 3. Configure the two Node apps in the panel

In cPanel "Setup Node.js App" (or Hostinger's Node.js page), create two
applications. For each, set the **Application startup file** and **environment
variables** via the panel (never commit secrets):

**API app**
- Startup file: `apps/api/dist/main.js`
- Env: `NODE_ENV=production`, `API_PORT` (often fixed by the host), `DATABASE_URL`,
  `AUTH_SECRET`, `INTERNAL_API_SECRET`, `AUTH_TOKEN_TTL=7d`,
  `WEB_ORIGIN=https://yourdomain.com`, `UPLOAD_DIR=/home/<you>/uploads`
  (a writable, persistent path), `MEDIA_MAX_SIZE_MB=10`.
- Map it to the `api.yourdomain.com` subdomain.

**Web app**
- Startup file: `apps/web/.next/standalone/apps/web/server.js`
- Env: `NODE_ENV=production`, `API_INTERNAL_URL=https://api.yourdomain.com`,
  `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`, `AUTH_URL=https://yourdomain.com`,
  `NEXT_PUBLIC_SITE_URL=https://yourdomain.com`, and the **same** `AUTH_SECRET`
  and `INTERNAL_API_SECRET` as the API.
- Map it to `yourdomain.com`.

Upload the built repo (or at least `apps/api/dist`, `apps/web/.next/standalone`,
`apps/web/.next/static`, `apps/web/public`, the `node_modules` Passenger expects,
and `packages/*/dist`). Run `pnpm install --prod` on the host if it supports it.

---

## 4. Uploads and TLS

- **Uploads:** point `UPLOAD_DIR` at a writable directory outside the web root.
  Files are served by the API at `/uploads/<key>`; since the API is on
  `api.yourdomain.com`, media URLs resolve there automatically.
- **TLS:** shared hosts almost always provide one-click Let's Encrypt for each
  (sub)domain — enable it for both `yourdomain.com` and `api.yourdomain.com`.

---

## 5. Verify

- `https://api.yourdomain.com/health` → `{"status":"ok",...}`
- `https://yourdomain.com/` → the public site
- Sign in at `/signin` with the seeded admin and change the password immediately.

If something 502s, check the Passenger app logs in the panel — the most common
causes are a wrong startup file path, a missing env var (`AUTH_SECRET` mismatch
between the two apps breaks sessions), or the API app not being reachable from
the web app at `API_INTERNAL_URL`.
