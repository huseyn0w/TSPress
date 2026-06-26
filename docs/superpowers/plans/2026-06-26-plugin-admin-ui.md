# Plugin Admin UI + Runtime Toggle + Render Regions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an Administrator enable/disable in-repo plugins at runtime and add a `site.footer` render-region hook plugins can inject into.

**Architecture:** All available plugins register at boot with their handlers tagged by plugin id (`owner`); a per-execution enabled-gate in `HookRegistry` skips disabled owners (core un-owned handlers always run). The enabled set persists in a `Setting` row and is toggled via an admin API + UI — no restart. A new region hook renders sanitized HTML into the public footer.

**Tech Stack:** NestJS (API, CommonJS), Prisma `Setting` (no migration), `@cmstack-ts/config` (Zod), Next.js App Router (web), `sanitize-html`, Vitest, Biome.

## Global Constraints

- Reply to the operator in **Russian**; code/comments/docs in **English**.
- Shared contracts from `@cmstack-ts/config`; never `@prisma/client` directly in services.
- **Core (un-owned) hook handlers must never be disableable** (e.g. `ContactMailListener`).
- No new table/migration — enabled state lives in `Setting['enabledPlugins']` (JSON id array).
- **No observer event** (§2.7 — a toggle is a config write).
- Region HTML is sanitized server-side via `HtmlSanitizerService` before it reaches the web.
- Admin plugin routes gated by CASL subject **`Plugin`** (Administrator-only); web page gated by `canManageSettings`.
- All gates before commit: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm vitest run --coverage` (≥80%), then live curl/SSR + `pnpm e2e` (11/11).
- No `Co-Authored-By`/Claude trailer in commits.
- **Write-tool gotcha:** strip a stray trailing `</content>` (`perl -0pi -e 's/\n?<\/content>\s*$//' <file>`) + `pnpm format`.

---

### Task 1: Config — plugin schemas + constant

**Files:**
- Create: `packages/config/src/plugins.ts`
- Create: `packages/config/src/plugins.test.ts`
- Modify: `packages/config/src/index.ts`

**Interfaces:**
- Produces: `PLUGINS_ENABLED_KEY` (`'enabledPlugins'`); `updatePluginSchema` (`{ enabled: boolean }`); `pluginInfoSchema`/`PluginInfo` (`{ id, name, description, enabled }`); `pluginRegionsSchema` (partial `{ 'site.footer': string }`).

- [ ] **Step 1: Write the failing test**

Create `packages/config/src/plugins.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PLUGINS_ENABLED_KEY, pluginInfoSchema, updatePluginSchema } from './plugins';

describe('plugin schemas', () => {
  it('exposes the settings key', () => {
    expect(PLUGINS_ENABLED_KEY).toBe('enabledPlugins');
  });
  it('updatePluginSchema requires a boolean enabled', () => {
    expect(updatePluginSchema.parse({ enabled: true }).enabled).toBe(true);
    expect(() => updatePluginSchema.parse({ enabled: 'yes' })).toThrow();
  });
  it('pluginInfoSchema parses the admin shape', () => {
    const p = pluginInfoSchema.parse({ id: 'x', name: 'X', description: 'd', enabled: false });
    expect(p.id).toBe('x');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run packages/config/src/plugins.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `packages/config/src/plugins.ts`:

```ts
import { z } from 'zod';

/** Setting key holding the JSON array of enabled plugin ids. */
export const PLUGINS_ENABLED_KEY = 'enabledPlugins';

export const updatePluginSchema = z.object({ enabled: z.boolean() });
export type UpdatePluginInput = z.infer<typeof updatePluginSchema>;

export const pluginInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
});
export type PluginInfo = z.infer<typeof pluginInfoSchema>;

export const pluginInfoListSchema = z.array(pluginInfoSchema);

/** Public render-region payload: region name -> sanitized HTML (only present regions). */
export const pluginRegionsSchema = z.object({ 'site.footer': z.string() }).partial();
export type PluginRegions = z.infer<typeof pluginRegionsSchema>;
```

- [ ] **Step 4: Export from the barrel**

In `packages/config/src/index.ts`, after the `./settings` export block add:

```ts
export {
  PLUGINS_ENABLED_KEY,
  updatePluginSchema,
  type UpdatePluginInput,
  pluginInfoSchema,
  type PluginInfo,
  pluginInfoListSchema,
  pluginRegionsSchema,
  type PluginRegions,
} from './plugins';
```

- [ ] **Step 5: Run config suite + build, verify pass**

Run: `pnpm vitest run packages/config && pnpm --filter @cmstack-ts/config build`
Expected: PASS, build clean.

- [ ] **Step 6: Commit**

```bash
git add packages/config/src/plugins.ts packages/config/src/plugins.test.ts packages/config/src/index.ts
git commit -m "feat(config): plugin admin + render-region schemas"
```

---

### Task 2: Plugin contract — id/description, region hook, demo plugin

**Files:**
- Modify: `apps/api/src/plugins/hooks.ts`
- Modify: `apps/api/src/plugins/plugin.types.ts`
- Modify: `apps/api/src/plugins/samples/reading-time.plugin.ts`
- Create: `apps/api/src/plugins/samples/site-footer-note.plugin.ts`

**Interfaces:**
- Produces: `RegionMap`/`RegionName` (`'site.footer'`); `RegionRenderer`; `PluginApi.addRegion`; `CmstackTsPlugin` gains `id` + `description`; `readingTimePlugin` + `siteFooterNotePlugin` carry ids.

- [ ] **Step 1: Add the region catalogue to `hooks.ts`**

Append to `apps/api/src/plugins/hooks.ts`:

```ts
/** Render-region hooks: a named slot on the public site plugins inject HTML into. */
export interface RegionMap {
  /** Appended to the public site footer area. */
  'site.footer': void;
}
export type RegionName = keyof RegionMap;
```

- [ ] **Step 2: Extend `plugin.types.ts`**

Add the renderer type + `addRegion` + plugin id/description:

```ts
import type { ActionMap, ActionName, FilterMap, FilterName, RegionName } from './hooks';
// ...existing FilterHandler / ActionHandler...

export type RegionRenderer = () => string | Promise<string>;

export interface PluginApi {
  addFilter<K extends FilterName>(name: K, handler: FilterHandler<K>, priority?: number): void;
  addAction<K extends ActionName>(name: K, handler: ActionHandler<K>, priority?: number): void;
  addRegion(name: RegionName, render: RegionRenderer, priority?: number): void;
}

export interface CmstackTsPlugin {
  /** Stable slug — the toggle key and the owner tag on its handlers. */
  id: string;
  /** Human-readable name (admin list + logs). */
  name: string;
  /** One-line description shown in the admin list. */
  description: string;
  register(api: PluginApi): void;
}
```

- [ ] **Step 3: Give the reading-time plugin an id + description**

In `samples/reading-time.plugin.ts`, update the export:

```ts
export const readingTimePlugin: CmstackTsPlugin = {
  id: 'reading-time',
  name: 'Reading time',
  description: 'Prepends an estimated reading-time badge to public post content.',
  register(api) {
    // ...unchanged body...
  },
};
```

- [ ] **Step 4: Create the demo region plugin**

Create `apps/api/src/plugins/samples/site-footer-note.plugin.ts`:

```ts
import type { CmstackTsPlugin } from '../plugin.types';

/**
 * Sample render-region plugin: contributes a fixed, safe footer line to the
 * public `site.footer` region. The markup is a constant shape (no interpolation),
 * so it is safe to render alongside the sanitized region output.
 */
export const siteFooterNotePlugin: CmstackTsPlugin = {
  id: 'site-footer-note',
  name: 'Site footer note',
  description: 'Adds a short "Built with Cmstack-TS" line to the public site footer.',
  register(api) {
    api.addRegion('site.footer', () => '<p class="plugin-footer-note">Built with Cmstack-TS</p>');
  },
};
```

- [ ] **Step 5: Typecheck (will fail until Task 3 adds `addRegion` to the registry — that is expected; commit together with Task 3).**

Run: `cd apps/api && pnpm exec tsc -p tsconfig.json --noEmit | head`
Expected: errors only about `addRegion`/`owner` on `HookRegistry` (resolved in Task 3). Do **not** commit yet — proceed to Task 3.

---

### Task 3: HookRegistry — owner gating, regions, runtime toggle

**Files:**
- Modify: `apps/api/src/plugins/hook-registry.ts`
- Modify: `apps/api/src/plugins/hook-registry.spec.ts`
- Create: `apps/api/src/plugins/scoped-plugin-api.ts`

**Interfaces:**
- Consumes: `RegionName`/`RegionRenderer` (Task 2).
- Produces: `HookRegistry.addFilter/addAction/addRegion(..., priority?, owner?)`; `renderRegion(name): Promise<string>`; `setEnabledPlugins(ids: string[]): void`; `scopedPluginApi(registry, ownerId): PluginApi`.

- [ ] **Step 1: Write the failing registry tests**

Add to `apps/api/src/plugins/hook-registry.spec.ts`:

```ts
import { scopedPluginApi } from './scoped-plugin-api';

describe('HookRegistry owner gating + regions', () => {
  it('skips a disabled owner but runs un-owned (core) handlers', async () => {
    const reg = new HookRegistry();
    reg.addFilter('public.post.render', (p) => ({ ...p, title: `${p.title}-core` })); // un-owned
    reg.addFilter('public.post.render', (p) => ({ ...p, title: `${p.title}-plug` }), 10, 'p1');
    reg.setEnabledPlugins([]); // p1 disabled
    const base = { title: 'T' } as never;
    const out = (await reg.applyFilters('public.post.render', base)) as { title: string };
    expect(out.title).toBe('T-core'); // core ran, plugin skipped
    reg.setEnabledPlugins(['p1']);
    const out2 = (await reg.applyFilters('public.post.render', base)) as { title: string };
    expect(out2.title).toBe('T-core-plug');
  });

  it('renderRegion concatenates enabled contributors in priority order', async () => {
    const reg = new HookRegistry();
    reg.addRegion('site.footer', () => 'B', 20, 'p2');
    reg.addRegion('site.footer', () => 'A', 10, 'p1');
    reg.setEnabledPlugins(['p1', 'p2']);
    expect(await reg.renderRegion('site.footer')).toBe('AB');
    reg.setEnabledPlugins(['p2']);
    expect(await reg.renderRegion('site.footer')).toBe('B');
  });

  it('isolates a throwing region renderer', async () => {
    const reg = new HookRegistry();
    reg.addRegion('site.footer', () => {
      throw new Error('boom');
    }, 10, 'p1');
    reg.addRegion('site.footer', () => 'ok', 20, 'p2');
    reg.setEnabledPlugins(['p1', 'p2']);
    expect(await reg.renderRegion('site.footer')).toBe('ok');
  });

  it('scopedPluginApi tags handlers with the owner id', async () => {
    const reg = new HookRegistry();
    scopedPluginApi(reg, 'p9').addRegion('site.footer', () => 'X');
    reg.setEnabledPlugins([]);
    expect(await reg.renderRegion('site.footer')).toBe('');
    reg.setEnabledPlugins(['p9']);
    expect(await reg.renderRegion('site.footer')).toBe('X');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run apps/api/src/plugins/hook-registry.spec.ts`
Expected: FAIL (`addRegion`/`renderRegion`/`setEnabledPlugins`/`scopedPluginApi` missing).

- [ ] **Step 3: Extend the registry**

Rewrite `apps/api/src/plugins/hook-registry.ts` (keep the existing `applyFilters`/`emit`/`insert`,
add `owner`, regions, gate, toggle):

```ts
import { Injectable, Logger } from '@nestjs/common';
import type { ActionMap, ActionName, FilterMap, FilterName, RegionName } from './hooks';
import type { ActionHandler, FilterHandler, PluginApi, RegionRenderer } from './plugin.types';

interface Entry {
  handler: (value: unknown) => unknown;
  priority: number;
  owner?: string;
}
interface RegionEntry {
  render: RegionRenderer;
  priority: number;
  owner?: string;
}

@Injectable()
export class HookRegistry implements PluginApi {
  private readonly logger = new Logger('HookRegistry');
  private readonly filters = new Map<string, Entry[]>();
  private readonly actions = new Map<string, Entry[]>();
  private readonly regions = new Map<string, RegionEntry[]>();
  // null = no gate set yet (everything runs); a Set = only these owners are enabled.
  private enabled: Set<string> | null = null;

  addFilter<K extends FilterName>(name: K, handler: FilterHandler<K>, priority = 10, owner?: string): void {
    this.insert(this.filters, name, { handler: handler as Entry['handler'], priority, owner });
  }
  addAction<K extends ActionName>(name: K, handler: ActionHandler<K>, priority = 10, owner?: string): void {
    this.insert(this.actions, name, { handler: handler as Entry['handler'], priority, owner });
  }
  addRegion(name: RegionName, render: RegionRenderer, priority = 10, owner?: string): void {
    const entries = this.regions.get(name) ?? [];
    entries.push({ render, priority, owner });
    entries.sort((a, b) => a.priority - b.priority);
    this.regions.set(name, entries);
  }

  /** Replace the enabled-plugin gate. Un-owned (core) handlers are always active. */
  setEnabledPlugins(ids: string[]): void {
    this.enabled = new Set(ids);
  }

  private isActive(owner?: string): boolean {
    if (!owner) return true; // core handler
    if (this.enabled === null) return true; // no gate configured yet
    return this.enabled.has(owner);
  }

  async applyFilters<K extends FilterName>(name: K, value: FilterMap[K]): Promise<FilterMap[K]> {
    const entries = this.filters.get(name);
    if (!entries) return value;
    let acc: FilterMap[K] = value;
    for (const entry of entries) {
      if (!this.isActive(entry.owner)) continue;
      acc = (await entry.handler(acc)) as FilterMap[K];
    }
    return acc;
  }

  async emit<K extends ActionName>(name: K, payload: ActionMap[K]): Promise<void> {
    const entries = this.actions.get(name);
    if (!entries) return;
    for (const entry of entries) {
      if (!this.isActive(entry.owner)) continue;
      try {
        await entry.handler(payload);
      } catch (error) {
        this.logger.error(`Action listener for "${name}" threw`, error as Error);
      }
    }
  }

  /** Concatenate enabled contributors' HTML for a region; each renderer is fault-isolated. */
  async renderRegion(name: RegionName): Promise<string> {
    const entries = this.regions.get(name);
    if (!entries) return '';
    let html = '';
    for (const entry of entries) {
      if (!this.isActive(entry.owner)) continue;
      try {
        html += await entry.render();
      } catch (error) {
        this.logger.error(`Region renderer for "${name}" threw`, error as Error);
      }
    }
    return html;
  }

  private insert(map: Map<string, Entry[]>, name: string, entry: Entry): void {
    const entries = map.get(name) ?? [];
    entries.push(entry);
    entries.sort((a, b) => a.priority - b.priority);
    map.set(name, entries);
  }
}
```

- [ ] **Step 4: Create the scoped facade**

Create `apps/api/src/plugins/scoped-plugin-api.ts`:

```ts
import type { HookRegistry } from './hook-registry';
import type { PluginApi } from './plugin.types';

/** Wrap the registry so a plugin's handlers are tagged with its id (owner). */
export function scopedPluginApi(registry: HookRegistry, ownerId: string): PluginApi {
  return {
    addFilter: (name, handler, priority) => registry.addFilter(name, handler, priority, ownerId),
    addAction: (name, handler, priority) => registry.addAction(name, handler, priority, ownerId),
    addRegion: (name, render, priority) => registry.addRegion(name, render, priority, ownerId),
  };
}
```

- [ ] **Step 5: Run registry tests, verify pass**

Run: `pnpm vitest run apps/api/src/plugins/hook-registry.spec.ts`
Expected: PASS (existing + 4 new).

- [ ] **Step 6: Typecheck the API**

Run: `cd apps/api && pnpm exec tsc -p tsconfig.json --noEmit | head`
Expected: clean (Task 2's `addRegion` now resolves).

- [ ] **Step 7: Commit Tasks 2 + 3 together**

```bash
git add apps/api/src/plugins/hooks.ts apps/api/src/plugins/plugin.types.ts \
  apps/api/src/plugins/hook-registry.ts apps/api/src/plugins/hook-registry.spec.ts \
  apps/api/src/plugins/scoped-plugin-api.ts apps/api/src/plugins/samples/
git commit -m "feat(api): owner-gated hooks, render regions, scoped plugin facade + demo plugin"
```

---

### Task 4: Catalogue + PluginService + module wiring

**Files:**
- Create: `apps/api/src/plugins/available-plugins.ts` (replaces `enabled-plugins.ts`)
- Delete: `apps/api/src/plugins/enabled-plugins.ts`
- Create: `apps/api/src/plugins/plugin.service.ts`
- Create: `apps/api/src/plugins/plugin.service.spec.ts`
- Modify: `apps/api/src/plugins/plugins.module.ts`

**Interfaces:**
- Consumes: `scopedPluginApi`, `HookRegistry`, `availablePlugins`, `SETTING_REPOSITORY`, `HtmlSanitizerService`, `PLUGINS_ENABLED_KEY`, `PluginInfo`.
- Produces: `PluginService.list()`, `setEnabled(id, enabled)`, `loadEnabled()`, `renderRegions()`; `availablePlugins`.

- [ ] **Step 1: Create the catalogue**

Create `apps/api/src/plugins/available-plugins.ts`:

```ts
import type { CmstackTsPlugin } from './plugin.types';
import { readingTimePlugin } from './samples/reading-time.plugin';
import { siteFooterNotePlugin } from './samples/site-footer-note.plugin';

/** Every in-repo plugin the build knows about. Enabled state is runtime (a setting). */
export const availablePlugins: CmstackTsPlugin[] = [readingTimePlugin, siteFooterNotePlugin];
```

Delete `apps/api/src/plugins/enabled-plugins.ts`.

- [ ] **Step 2: Write the failing service test**

Create `apps/api/src/plugins/plugin.service.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { HookRegistry } from './hook-registry';
import { PluginService } from './plugin.service';

function makeSanitizer() {
  return { sanitize: (s: string) => s } as { sanitize: (s: string) => string };
}

let settings: { get: Mock; upsert: Mock };
let registry: HookRegistry;
let service: PluginService;

beforeEach(() => {
  settings = { get: vi.fn(), upsert: vi.fn() };
  registry = new HookRegistry();
  service = new PluginService(
    settings as never,
    registry,
    makeSanitizer() as never,
  );
});

describe('PluginService', () => {
  it('list() reflects the persisted enabled set', async () => {
    settings.get.mockResolvedValue({ value: JSON.stringify(['reading-time']) });
    await service.loadEnabled();
    const list = await service.list();
    const byId = Object.fromEntries(list.map((p) => [p.id, p.enabled]));
    expect(byId['reading-time']).toBe(true);
    expect(byId['site-footer-note']).toBe(false);
  });

  it('defaults to all available plugins when the setting is missing', async () => {
    settings.get.mockResolvedValue(null);
    await service.loadEnabled();
    expect((await service.list()).every((p) => p.enabled)).toBe(true);
  });

  it('setEnabled persists + updates the registry + returns the new list', async () => {
    settings.get.mockResolvedValue({ value: JSON.stringify([]) });
    settings.upsert.mockResolvedValue({});
    await service.loadEnabled();
    const list = await service.setEnabled('reading-time', true);
    expect(settings.upsert).toHaveBeenCalledWith('enabledPlugins', JSON.stringify(['reading-time']));
    expect(list.find((p) => p.id === 'reading-time')?.enabled).toBe(true);
  });

  it('setEnabled throws NotFound for an unknown plugin id', async () => {
    settings.get.mockResolvedValue(null);
    await service.loadEnabled();
    await expect(service.setEnabled('nope', true)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('renderRegions returns sanitized region html', async () => {
    settings.get.mockResolvedValue({ value: JSON.stringify(['site-footer-note']) });
    await service.loadEnabled();
    // register the demo plugin's region into the test registry
    registry.addRegion('site.footer', () => '<p>x</p>', 10, 'site-footer-note');
    const regions = await service.renderRegions();
    expect(regions['site.footer']).toContain('<p>x</p>');
  });
});
```

- [ ] **Step 3: Run, verify fail**

Run: `pnpm vitest run apps/api/src/plugins/plugin.service.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement the service**

Create `apps/api/src/plugins/plugin.service.ts`:

```ts
import { PLUGINS_ENABLED_KEY, type PluginInfo } from '@cmstack-ts/config';
import { SETTING_REPOSITORY, type SettingRepository } from '@cmstack-ts/db';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HtmlSanitizerService } from '../content/html-sanitizer.service';
import { availablePlugins } from './available-plugins';
import { HookRegistry } from './hook-registry';
import type { RegionName } from './hooks';

const REGION_NAMES: RegionName[] = ['site.footer'];

@Injectable()
export class PluginService {
  private readonly logger = new Logger(PluginService.name);
  private enabled: Set<string> = new Set();

  constructor(
    @Inject(SETTING_REPOSITORY) private readonly settings: SettingRepository,
    private readonly registry: HookRegistry,
    private readonly sanitizer: HtmlSanitizerService,
  ) {}

  /** Read the persisted enabled set (default: all available) and drive the registry. */
  async loadEnabled(): Promise<void> {
    const row = await this.settings.get(PLUGINS_ENABLED_KEY);
    const all = availablePlugins.map((p) => p.id);
    let ids = all;
    if (row) {
      try {
        const parsed: unknown = JSON.parse(row.value);
        if (Array.isArray(parsed)) ids = parsed.filter((x): x is string => typeof x === 'string');
      } catch {
        this.logger.warn('Malformed enabledPlugins setting; enabling all plugins.');
      }
    }
    this.enabled = new Set(ids.filter((id) => all.includes(id)));
    this.registry.setEnabledPlugins([...this.enabled]);
  }

  async list(): Promise<PluginInfo[]> {
    return availablePlugins.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      enabled: this.enabled.has(p.id),
    }));
  }

  async setEnabled(id: string, enabled: boolean): Promise<PluginInfo[]> {
    if (!availablePlugins.some((p) => p.id === id)) {
      throw new NotFoundException('Plugin not found.');
    }
    if (enabled) this.enabled.add(id);
    else this.enabled.delete(id);
    const ids = [...this.enabled];
    await this.settings.upsert(PLUGINS_ENABLED_KEY, JSON.stringify(ids));
    this.registry.setEnabledPlugins(ids);
    return this.list();
  }

  async renderRegions(): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const name of REGION_NAMES) {
      const html = await this.registry.renderRegion(name);
      if (html) out[name] = this.sanitizer.sanitize(html);
    }
    return out;
  }
}
```

- [ ] **Step 5: Wire the module**

Rewrite `apps/api/src/plugins/plugins.module.ts`:

```ts
import { SETTING_REPOSITORY, PrismaSettingRepository } from '@cmstack-ts/db';
import { Logger, Module, type OnModuleInit } from '@nestjs/common';
import { AccountsModule } from '../auth/accounts.module';
import { HtmlSanitizerService } from '../content/html-sanitizer.service';
import { provideRepository } from '../persistence/repository.providers';
import { availablePlugins } from './available-plugins';
import { HookRegistry } from './hook-registry';
import { PluginService } from './plugin.service';
import { PluginsController } from './plugins.controller';
import { PublicPluginsController } from './public-plugins.controller';
import { scopedPluginApi } from './scoped-plugin-api';

@Module({
  imports: [AccountsModule],
  controllers: [PluginsController, PublicPluginsController],
  providers: [
    HookRegistry,
    PluginService,
    HtmlSanitizerService,
    provideRepository(SETTING_REPOSITORY, PrismaSettingRepository),
  ],
  exports: [HookRegistry],
})
export class PluginsModule implements OnModuleInit {
  private readonly logger = new Logger('PluginsModule');

  constructor(
    private readonly registry: HookRegistry,
    private readonly plugins: PluginService,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const plugin of availablePlugins) {
      plugin.register(scopedPluginApi(this.registry, plugin.id));
      this.logger.log(`Registered plugin: ${plugin.name} (${plugin.id})`);
    }
    await this.plugins.loadEnabled();
  }
}
```

(The controllers are created in Task 5; this module references them — create the two controller
files in Task 5 before running the API. For the unit test in Step 6 the module is not loaded.)

- [ ] **Step 6: Run service test, verify pass**

Run: `pnpm vitest run apps/api/src/plugins/plugin.service.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Do not commit yet — controllers (Task 5) are referenced by the module. Proceed to Task 5, then commit Tasks 4 + 5 together.**

---

### Task 5: Controllers (admin + public)

**Files:**
- Create: `apps/api/src/plugins/plugins.controller.ts`
- Create: `apps/api/src/plugins/public-plugins.controller.ts`

**Interfaces:**
- Consumes: `PluginService`; guards from `AccountsModule`; `updatePluginSchema`/`PluginInfo`.

- [ ] **Step 1: Admin controller**

Create `apps/api/src/plugins/plugins.controller.ts`:

```ts
import { type PluginInfo, type UpdatePluginInput, updatePluginSchema } from '@cmstack-ts/config';
import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../authz/check-policies.decorator';
import { PoliciesGuard } from '../authz/policies.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PluginService } from './plugin.service';

@Controller('plugins')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class PluginsController {
  constructor(private readonly plugins: PluginService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Plugin'))
  list(): Promise<PluginInfo[]> {
    return this.plugins.list();
  }

  @Put(':id')
  @CheckPolicies((ability) => ability.can('manage', 'Plugin'))
  setEnabled(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePluginSchema)) body: UpdatePluginInput,
  ): Promise<PluginInfo[]> {
    return this.plugins.setEnabled(id, body.enabled);
  }
}
```

(Verify the import paths for `JwtAuthGuard`/`CheckPolicies`/`PoliciesGuard`/`ZodValidationPipe`
against `settings.controller.ts` — match them exactly.)

- [ ] **Step 2: Public controller**

Create `apps/api/src/plugins/public-plugins.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import { PluginService } from './plugin.service';

/** Unauthenticated render-region payload for the server-rendered public site. */
@Controller('public/plugins')
export class PublicPluginsController {
  constructor(private readonly plugins: PluginService) {}

  @Get('regions')
  regions(): Promise<Record<string, string>> {
    return this.plugins.renderRegions();
  }
}
```

- [ ] **Step 3: Typecheck the API + run the plugin suite**

Run: `cd apps/api && pnpm exec tsc -p tsconfig.json --noEmit | head; cd ../.. && pnpm vitest run apps/api/src/plugins`
Expected: clean + all plugin tests pass.

- [ ] **Step 4: Commit Tasks 4 + 5**

```bash
git rm apps/api/src/plugins/enabled-plugins.ts
git add apps/api/src/plugins/available-plugins.ts apps/api/src/plugins/plugin.service.ts \
  apps/api/src/plugins/plugin.service.spec.ts apps/api/src/plugins/plugins.module.ts \
  apps/api/src/plugins/plugins.controller.ts apps/api/src/plugins/public-plugins.controller.ts
git commit -m "feat(api): PluginService + admin/public plugin controllers + runtime enabled state"
```

---

### Task 6: Web admin — /admin/plugins screen

**Files:**
- Create: `apps/web/app/admin/plugins/page.tsx`
- Create: `apps/web/app/admin/plugins/actions.ts`
- Create: `apps/web/app/admin/plugins/plugin-list.tsx`
- Modify: `apps/web/components/admin/admin-shell.tsx` (nav link)

**Interfaces:**
- Consumes: `apiGet`/`apiSend`; `pluginInfoListSchema`/`PluginInfo`; `requireAdminSession`/`canManageSettings`.

- [ ] **Step 1: Server Action**

Create `apps/web/app/admin/plugins/actions.ts`:

```ts
'use server';

import { apiSend } from '@/lib/admin/api';
import { revalidatePath } from 'next/cache';

type ActionResult = { ok: true } | { ok: false; error: string };

export async function togglePluginAction(id: string, enabled: boolean): Promise<ActionResult> {
  try {
    await apiSend('PUT', `/plugins/${id}`, { enabled });
    revalidatePath('/admin/plugins');
    revalidatePath('/', 'layout'); // regions change the public site
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update plugin' };
  }
}
```

- [ ] **Step 2: Client list with toggles**

Create `apps/web/app/admin/plugins/plugin-list.tsx`:

```tsx
'use client';

import { Button } from '@/components/ui/button';
import type { PluginInfo } from '@cmstack-ts/config';
import { Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { togglePluginAction } from './actions';

export function PluginList({ plugins }: { plugins: PluginInfo[] }) {
  const [items, setItems] = useState(plugins);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string, enabled: boolean) {
    startTransition(async () => {
      const res = await togglePluginAction(id, enabled);
      if (res.ok) {
        setItems((prev) => prev.map((p) => (p.id === id ? { ...p, enabled } : p)));
        toast.success(`${enabled ? 'Enabled' : 'Disabled'} plugin`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      {items.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between gap-4 rounded-md border border-border bg-card p-4"
        >
          <div>
            <p className="font-medium text-foreground">{p.name}</p>
            <p className="text-sm text-muted-foreground">{p.description}</p>
          </div>
          <Button
            variant={p.enabled ? 'outline' : 'default'}
            size="sm"
            disabled={isPending}
            onClick={() => toggle(p.id, !p.enabled)}
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {p.enabled ? 'Disable' : 'Enable'}
          </Button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Page (Administrator-only)**

Create `apps/web/app/admin/plugins/page.tsx`:

```tsx
import { apiGet } from '@/lib/admin/api';
import { canManageSettings, requireAdminSession } from '@/lib/admin/guard';
import { type PluginInfo, pluginInfoListSchema } from '@cmstack-ts/config';
import { redirect } from 'next/navigation';
import { PluginList } from './plugin-list';

export const dynamic = 'force-dynamic';

async function fetchPlugins(): Promise<PluginInfo[]> {
  try {
    return await apiGet('/plugins', pluginInfoListSchema);
  } catch {
    return [];
  }
}

export default async function PluginsPage() {
  const session = await requireAdminSession();
  if (!canManageSettings(session)) redirect('/admin');
  const plugins = await fetchPlugins();

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Plugins</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enable or disable in-repo plugins. Changes apply immediately.
        </p>
      </div>
      <PluginList plugins={plugins} />
    </div>
  );
}
```

(Confirm `requireAdminSession`/`canManageSettings` signatures against
`apps/web/app/admin/appearance/page.tsx`; the appearance page returns `redirect`/`notFound` —
match its exact guard call.)

- [ ] **Step 4: Add the nav link**

In `apps/web/components/admin/admin-shell.tsx`, next to the `canManageSettings` "Appearance" push,
add a Plugins item (use an existing lucide icon already imported, e.g. `Palette`/`Navigation`, or
import `Puzzle`):

```tsx
  if (canManageSettings) {
    siteItems.push({
      label: 'Plugins',
      href: '/admin/plugins',
      icon: <Puzzle className="h-4 w-4" />,
    });
  }
```

Add `Puzzle` to the existing `lucide-react` import. Also extend the section-title map (around the
`pathname.startsWith('/admin/appearance')` block) with
`if (pathname.startsWith('/admin/plugins')) return 'Plugins';`.

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm --filter @cmstack-ts/web exec tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/admin/plugins apps/web/components/admin/admin-shell.tsx
git commit -m "feat(web): admin plugins screen with runtime enable/disable toggles"
```

---

### Task 7: Web public — render the `site.footer` region

**Files:**
- Create: `apps/web/lib/plugins/regions.ts`
- Modify: `apps/web/app/[locale]/layout.tsx`

**Interfaces:**
- Consumes: `pluginRegionsSchema`; `apiBaseUrl`.
- Produces: `getPluginRegions(): Promise<PluginRegions>`.

- [ ] **Step 1: Region fetch helper**

Create `apps/web/lib/plugins/regions.ts`:

```ts
import 'server-only';

import { apiBaseUrl } from '@/app/lib/api';
import { type PluginRegions, pluginRegionsSchema } from '@cmstack-ts/config';

/** Fetch the public plugin render-regions; degrade to empty on any failure. */
export async function getPluginRegions(): Promise<PluginRegions> {
  try {
    const res = await fetch(`${apiBaseUrl}/public/plugins/regions`, { cache: 'no-store' });
    if (!res.ok) return {};
    const parsed = pluginRegionsSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}
```

(Confirm `apiBaseUrl`'s import path against `apps/web/lib/seo/fetch.ts` — reuse the same import.)

- [ ] **Step 2: Render the footer region in the locale layout**

In `apps/web/app/[locale]/layout.tsx`, import and fetch regions, then render the footer HTML after
`children` (alongside the existing `AnalyticsLoader`):

```tsx
import { getPluginRegions } from '@/lib/plugins/regions';
// ...inside LocaleLayout, after the consent cookie read:
const regions = await getPluginRegions();
// ...in the returned fragment, after <AnalyticsLoader .../>:
{regions['site.footer'] ? (
  // The API sanitized this HTML; render the trusted string.
  // biome-ignore lint/security/noDangerouslySetInnerHtml: server-sanitized plugin region output
  <div className="ts-plugin-region ts-plugin-region-footer" dangerouslySetInnerHTML={{ __html: regions['site.footer'] }} />
) : null}
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm --filter @cmstack-ts/web exec tsc --noEmit && pnpm lint`
Expected: clean. (If biome rejects the inline ignore, place the suppression comment on the exact
line biome points to, or extract a small server component.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/plugins/regions.ts "apps/web/app/[locale]/layout.tsx"
git commit -m "feat(web): render the site.footer plugin region on public pages"
```

---

### Task 8: Seed, full gates, live verification, adversarial review, HANDOFF

**Files:**
- Modify: `packages/db/prisma/seed.ts` (enabledPlugins setting + Plugin permission)
- Modify: `cmstack-ts/HANDOFF.md`, `cmstack-ts/REFACTOR_PLAN.md` (§7 #9 tick)

- [ ] **Step 1: Seed the setting + permission**

In `packages/db/prisma/seed.ts`: add `{ action: 'manage', subject: 'Plugin' }` to the
`ALL_PERMISSIONS` array; and upsert the setting (near where `activeTheme` is seeded, or add a
small block) `enabledPlugins = ["reading-time","site-footer-note"]`:

```ts
await prisma.setting.upsert({
  where: { key: 'enabledPlugins' },
  create: { key: 'enabledPlugins', value: JSON.stringify(['reading-time', 'site-footer-note']) },
  update: {},
});
```

(Use `update: {}` so a re-seed preserves admin toggles, matching the theme-setting pattern.)

- [ ] **Step 2: Run the full unit gates**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm vitest run --coverage   # ≥80% must hold
```

Expected: green; record counts.

- [ ] **Step 3: Live verification (HANDOFF recipe — Docker daemon may need `open -a Docker`)**

Bring the stack up (db + built api + web), then:
- `curl -s localhost:4000/public/plugins/regions | jq` → `{"site.footer":"<p ...>Built with Cmstack-TS</p>"}`.
- `curl -s localhost:3000/ | grep -c 'plugin-footer-note'` → ≥1 (footer note renders publicly).
- Login as admin, `curl -s localhost:4000/plugins -H "Authorization: Bearer $TOKEN" | jq` → both plugins, enabled.
- Disable the footer plugin: `curl -X PUT localhost:4000/plugins/site-footer-note -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"enabled":false}'`; then `curl -s localhost:4000/public/plugins/regions` → `{}` (no restart) and `curl -s localhost:3000/ | grep -c plugin-footer-note` → 0.
- Disable `reading-time`, confirm a public post no longer shows the reading-time badge; re-enable.
- `pnpm e2e` → 11/11.

- [ ] **Step 4: Adversarial self-review (inline, no parallel agents)**

Check: core (un-owned) handlers — especially `contact.submitted` mail listener — are NEVER gated
(verify by a registry test or reasoning: the contact module calls `hooks.addAction` with no owner);
toggling persists + takes effect without restart; an unknown plugin id → 404; a malformed
`enabledPlugins` setting → safe default (all); region HTML is sanitized server-side; the demo
plugin's markup is fixed-shape; admin routes are `Plugin`-gated (Administrator-only) and the web
page redirects non-admins; `renderRegion` is fault-isolated. Fix any finding with a test.

- [ ] **Step 5: Update HANDOFF + tick §7 #9**

Add a "§7 #9 — DONE" block to `HANDOFF.md` and tick #9 in `REFACTOR_PLAN.md` §7. Update the
continuation prompt's next item to #10 (Redis cache).

- [ ] **Step 6: Final commit**

```bash
git add packages/db/prisma/seed.ts cmstack-ts/HANDOFF.md cmstack-ts/REFACTOR_PLAN.md
git commit -m "feat: plugin admin UI, runtime toggle & render regions (Task 1 §7 #9)"
```

---

## Self-Review

**Spec coverage:**
- Config schemas/constant → Task 1. ✓
- Plugin contract (id/description, addRegion, RegionMap) + demo plugin → Task 2. ✓
- HookRegistry owner-gating + regions + setEnabledPlugins + scoped facade → Task 3. ✓
- Catalogue + PluginService (list/setEnabled/loadEnabled/renderRegions) + module wiring → Task 4. ✓
- Admin + public controllers (CASL `Plugin`) → Task 5. ✓
- Admin UI + nav → Task 6. ✓
- Public footer region render → Task 7. ✓
- Seed + gates + live + adversarial + HANDOFF → Task 8. ✓
- Out-of-scope (more regions, user code, per-plugin config) → documented in spec. ✓

**Placeholder scan:** Several steps ask to "confirm import paths against <existing file>" — the
action is concrete (copy the matching import); all logic steps carry full code. No TBD/TODO.

**Type consistency:** `RegionName`/`RegionRenderer`/`addRegion`/`renderRegion`/`setEnabledPlugins`/
`scopedPluginApi`, `PluginService.{list,setEnabled,loadEnabled,renderRegions}`, `availablePlugins`,
`PluginInfo`, `PLUGINS_ENABLED_KEY` (`'enabledPlugins'`), and `togglePluginAction` are spelled
identically across Tasks 1–7. Plugin ids `reading-time` / `site-footer-note` match between the
plugins, the catalogue, the seed, and the live checks.
