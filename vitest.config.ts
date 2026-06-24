import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const fromRoot = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    // Resolve workspace packages to their TypeScript source so unit tests run
    // without a prior build step. Production builds still consume `dist`.
    alias: {
      '@cmstack-ts/config': fromRoot('./packages/config/src/index.ts'),
      '@cmstack-ts/db': fromRoot('./packages/db/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['{apps,packages}/**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text'],
      // Focus the coverage gate on the layers the refactor targets: the NestJS
      // service layer and the repository layer.
      include: ['apps/api/src/**/*.service.ts', 'packages/db/src/repositories/**/*.ts'],
      exclude: ['**/*.spec.ts', '**/*.test.ts', 'packages/db/src/repositories/index.ts'],
      // Enforce the gate: the run fails if service/repository coverage regresses.
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
