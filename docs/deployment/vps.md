# Deploying Typress on a VPS

This is the primary, recommended way to run Typress in production: a Linux VPS
with the app behind **nginx**, using either **Docker** (recommended) or **PM2**.

Topology (single host):

```
                         ┌──────────────── nginx (:80 / :443) ────────────────┐
  https://example.com ──▶│  example.com      → web  (Next.js, :3000)          │
  https://api.example… ─▶│  api.example.com  → api  (NestJS,  :4000)          │
                         └──────────────┬─────────────────────┬───────────────┘
                                        │                     │
                                   web container         api container ──▶ postgres
```

The API is served from an `api.` subdomain so its root-level routes (`/auth`,
`/public`, `/posts`, `/uploads`, ...) never collide with the web app's own
`/api/auth/*` (Auth.js) routes. The browser talks to the API at
`https://api.example.com`; CORS is restricted to your site origin.

---

## 1. Prerequisites

- A VPS (Ubuntu 22.04+ or similar) with a public IP, `docker` + `docker compose`
  installed (or Node ≥ 22 + pnpm for the PM2 path).
- Two DNS A records pointing at the VPS:
  - `example.com` (the public site)
  - `api.example.com` (the API)
- Ports 80 and 443 open in the firewall.

---

## 2. Environment

Copy `.env.example` to `.env` and fill it in. The values that **must** change
for production:

| Variable | What it is | Example |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | Database password | a long random string |
| `AUTH_SECRET` | Signs/verifies API JWTs **and** Auth.js sessions (shared) | `openssl rand -base64 32` |
| `INTERNAL_API_SECRET` | Guards server-to-server endpoints | `openssl rand -base64 32` |
| `PUBLIC_WEB_URL` | Public site URL → `AUTH_URL`, `WEB_ORIGIN`, `NEXT_PUBLIC_SITE_URL` | `https://example.com` |
| `PUBLIC_API_URL` | Browser-facing API URL → `NEXT_PUBLIC_API_URL` (baked into the web bundle at build) | `https://api.example.com` |

Optional:

| Variable | Purpose |
| --- | --- |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google social login |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub social login (see the verified-email caveat in CLAUDE.md before enabling) |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` / `RECAPTCHA_SECRET_KEY` | reCAPTCHA v3 on comments/auth (left blank = disabled) |
| `MEDIA_MAX_SIZE_MB` | Upload size cap (default 10; keep nginx `client_max_body_size` a little above it) |
| `MCP_API_URL` / `MCP_API_EMAIL` / `MCP_API_PASSWORD` | Only needed where you run the MCP server (Phase 10) |

> **`NEXT_PUBLIC_*` are inlined at build time.** If you change `PUBLIC_API_URL`
> or `PUBLIC_WEB_URL`, you must **rebuild the web image** (`--build`), not just
> restart it.

`AUTH_SECRET` and `INTERNAL_API_SECRET` must be **identical** for the web and
api services — they share them. Never commit `.env`.

---

## 3. Deploy with Docker (recommended)

The repo ships `docker-compose.prod.yml`: db + api + web, with **only nginx
published** on the host (the app containers are reachable only on the internal
Docker network). nginx config lives in `nginx/typress.conf`.

```bash
git clone <your-fork> typress && cd typress
cp .env.example .env && $EDITOR .env        # set the variables from step 2

# Build and start (db → api → web → nginx).
docker compose -f docker-compose.prod.yml up -d --build

# First boot only: apply the schema and seed demo content.
# (The API container also runs `prisma migrate deploy` automatically on start.)
docker compose -f docker-compose.prod.yml exec api pnpm --filter @typress/db seed
```

Edit `nginx/typress.conf` and replace the `example.com` / `api.example.com`
`server_name` values with your domains.

Verify:

```bash
curl -I https://example.com                 # 200, the public site
curl    https://api.example.com/health      # {"status":"ok",...}
curl    https://api.example.com/health/ready # {"status":"ok"} once the DB is reachable
```

Sign in at `https://example.com/signin` with the seeded admin
(`admin@typress.local` / the password from `SEED_ADMIN_PASSWORD`, default
`admin12345` — **change it**), then open `/admin`.

### Uploads

Uploaded media lives on the `uploads` Docker volume and is served at
`/uploads/<key>`. nginx forwards `/uploads/*` on the api subdomain to the API
process (see `nginx/typress.conf`). Alternatively, mount the `uploads` volume
into the nginx container and serve it directly — if you do, drop the API's
`useStaticAssets` call so only one process owns the path.

### Migrations on later deploys

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build   # API runs `migrate deploy` on boot
```

`prisma migrate deploy` only applies committed migrations (it never generates or
resets), so it is safe to run on every deploy.

---

## 4. TLS (Let's Encrypt)

The shipped nginx config listens on `:80` only. To add HTTPS:

1. Obtain certificates on the host (one cert per name), e.g. with the standalone
   plugin while nginx is briefly stopped, or via a webroot/`certbot` container:

   ```bash
   certbot certonly --standalone -d example.com -d api.example.com
   ```

2. Mount the certs into the nginx container (uncomment the `letsencrypt` volume
   line in `docker-compose.prod.yml`).
3. In `nginx/typress.conf`, uncomment the `listen 443 ssl` server blocks and the
   `Strict-Transport-Security` header, and enable the `return 301 https://...`
   redirect in the `:80` blocks. Reload: `docker compose -f docker-compose.prod.yml restart nginx`.

Renewals: run `certbot renew` on a cron/systemd timer and reload nginx.

---

## 5. Alternative: PM2 (no Docker)

For a host with Node ≥ 22 and a managed PostgreSQL:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build                                   # topological: packages → apps

pnpm --filter @typress/db migrate            # prisma migrate deploy
pnpm --filter @typress/db seed               # first boot only

# Run both apps under PM2 (set the env first — see step 2).
pm2 start "node apps/api/dist/main.js"  --name typress-api
pm2 start "node apps/web/.next/standalone/apps/web/server.js" --name typress-web
pm2 save && pm2 startup
```

Point the same `nginx/typress.conf` (installed under
`/etc/nginx/conf.d/`) at `127.0.0.1:3000` / `127.0.0.1:4000` instead of the
`web` / `api` container hostnames, and `sudo nginx -t && sudo systemctl reload nginx`.

Build the web app with `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_SITE_URL` set in the
environment **before** `pnpm build` (they are inlined at build time).

---

## 6. Health checks & monitoring

| Endpoint | Meaning |
| --- | --- |
| `GET /health` | API liveness (process is up) |
| `GET /health/ready` | API readiness (database probe) |
| `GET /` on the site | Public site (SSR) |

The api container has a Docker `healthcheck` against `/health/ready`, and `web`
waits for it to be healthy before starting. Point your uptime monitor at the two
health endpoints.

---

## 7. Backups

- **Database**: `docker compose -f docker-compose.prod.yml exec db pg_dump -U typress typress > backup.sql`
  on a schedule.
- **Uploads**: back up the `uploads` Docker volume (e.g. `docker run --rm -v
  typress_uploads:/data -v "$PWD":/backup alpine tar czf /backup/uploads.tgz -C /data .`).
