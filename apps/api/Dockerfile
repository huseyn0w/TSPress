# syntax=docker/dockerfile:1
# Multi-stage build for the Cmstack-TS NestJS API within the pnpm monorepo.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# --- Install dependencies (cached on manifest changes only) ---
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

# --- Build the API and its workspace dependencies ---
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @cmstack-ts/config build \
  && pnpm --filter @cmstack-ts/db generate \
  && pnpm --filter @cmstack-ts/db build \
  && pnpm --filter @cmstack-ts/api build

# --- Runtime ---
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app ./
WORKDIR /app/apps/api
EXPOSE 4000
# Apply pending migrations, then start the API.
CMD ["sh", "-c", "pnpm --filter @cmstack-ts/db migrate && node dist/main.js"]
