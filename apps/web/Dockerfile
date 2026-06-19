# syntax=docker/dockerfile:1
# Multi-stage build for the Typress Next.js web app (standalone output).

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# --- Install dependencies ---
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/config/package.json packages/config/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# --- Build the web app and its workspace dependencies ---
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js inlines NEXT_PUBLIC_* at BUILD time, so the browser-facing API URL and
# canonical site URL must be passed as build args for a production deploy
# (otherwise the bundle would target the localhost defaults). Pass them with
# `--build-arg` / the compose `build.args` block; they default to localhost for
# the dev build.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
COPY tsconfig.base.json ./
COPY packages/config ./packages/config
COPY apps/web ./apps/web
RUN pnpm --filter @typress/config build \
  && pnpm --filter @typress/web build

# --- Runtime (Next standalone server) ---
FROM base AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
