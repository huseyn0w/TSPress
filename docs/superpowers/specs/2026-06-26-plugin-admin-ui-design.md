# §7 #9 — Plugin admin UI + runtime enable/disable + render-region hooks — Design

**Date:** 2026-06-26 · **Status:** approved · **Feature register:** `REFACTOR_PLAN.md` §7 #9

## Goal

Let an Administrator enable/disable in-repo plugins at runtime (no restart) from an admin
screen, and add a **render-region** hook so plugins can inject HTML into named public-site
regions. Ships `site.footer` as the first region plus a small demo plugin.

## Context (Phase 6, in place)

- `CmstackTsPlugin = { name, register(api) }`; plugins are explicit in-repo modules.
- `enabledPlugins` is a **static array** registered once at `PluginsModule.onModuleInit`.
- `HookRegistry` holds filter + action handlers; drives `applyFilters` / `emit`.
- **Core** subscribers use the registry directly (not as plugins): `ContactMailListener` via
  `hooks.addAction('contact.submitted', …)`; `post.published` emits. These must **never** be
  disableable.
- `Setting` is a key/value model (`activeTheme` lives there). `SettingRepository` =
  `get(key)` / `upsert(key, value)`. Administrator holds `manage all`.
- `HtmlSanitizerService` (content module) is a dependency-free `@Injectable` (sanitize-html).

## Decisions

- **Persistence:** a `Setting` row `enabledPlugins` (JSON array of ids) — no new table/migration.
- **Runtime toggle:** register **all** available plugins at boot (handlers tagged with their
  plugin id as `owner`); a per-execution enabled-gate skips handlers of disabled plugins. Core
  (un-owned) handlers always run. Toggling updates the in-memory enabled set + the setting —
  **no restart**.
- **Render regions:** ship **`site.footer`** only (RegionMap is extensible). Rendered in the
  public `[locale]` layout via sanitized `dangerouslySetInnerHTML` (like the consent banner),
  degrading to empty on error.
- **Demo plugin:** a small `site-footer-note` plugin contributes a fixed footer line.
- **CASL:** new subject **`Plugin`** (Administrator-only, like theme switching). Admin page
  gated by the existing `canManageSettings`.
- **No observer event** (§2.7): a toggle is a config write, not a real side effect.

## Plugin contract (`apps/api/src/plugins/`)

`plugin.types.ts`:

```ts
export type RegionRenderer = () => string | Promise<string>;

export interface PluginApi {
  addFilter<K extends FilterName>(name: K, handler: FilterHandler<K>, priority?: number): void;
  addAction<K extends ActionName>(name: K, handler: ActionHandler<K>, priority?: number): void;
  addRegion(name: RegionName, render: RegionRenderer, priority?: number): void;
}

export interface CmstackTsPlugin {
  id: string;          // stable slug (toggle key, owner tag)
  name: string;        // human label
  description: string; // shown in the admin list
  register(api: PluginApi): void;
}
```

`hooks.ts` adds the region catalogue:

```ts
export interface RegionMap {
  /** Appended to the public site footer area. */
  'site.footer': void;
}
export type RegionName = keyof RegionMap;
```

## HookRegistry (owner-gating + regions)

`addFilter/addAction/addRegion` gain an optional `owner?: string`; entries store it. A new
`regions: Map<string, Array<{ render: RegionRenderer; priority: number; owner?: string }>>`.

- `setEnabledPlugins(ids: string[]): void` — replaces the in-memory `enabled: Set<string>`.
- An entry runs iff `!entry.owner || this.enabled.has(entry.owner)`. Applied in
  `applyFilters`, `emit`, and `renderRegion`.
- `renderRegion(name: RegionName): Promise<string>` — concatenate enabled contributors' HTML in
  ascending priority order (each renderer is fault-isolated: a throw is logged + skipped, like
  `emit`, so one bad region renderer can't blank the whole region).

Plugins register through a **scoped facade** bound to their `id`, so `addFilter/addAction/
addRegion` pass `owner = plugin.id`. Core modules keep calling the registry directly (no owner).

## Catalogue + service

- `available-plugins.ts`: `availablePlugins: CmstackTsPlugin[]` (reading-time + the demo).
- `PluginsModule.onModuleInit`: register **every** available plugin via its scoped facade, then
  `PluginService.loadEnabled()` reads the setting (default = all available ids when unset) and
  calls `registry.setEnabledPlugins(...)`.
- `PluginService` (in PluginsModule, injects `SETTING_REPOSITORY` + `HookRegistry`):
  - `list(): Promise<PluginInfo[]>` → `{ id, name, description, enabled }` from `availablePlugins`
    + the persisted enabled set.
  - `setEnabled(id: string, enabled: boolean): Promise<PluginInfo[]>` — 404 if `id` is not an
    available plugin; compute the next enabled-id list; `settings.upsert('enabledPlugins',
    JSON.stringify(ids))`; `registry.setEnabledPlugins(ids)`; return `list()`.
  - `loadEnabled()` — parse the setting (tolerate malformed → default), set the registry.
  - `renderRegions(): Promise<Record<RegionName, string>>` — `{ 'site.footer':
    sanitize(await registry.renderRegion('site.footer')) }` (sanitized for defense-in-depth).

## API

- New `PluginsController` (`@UseGuards(JwtAuthGuard, PoliciesGuard)`):
  - `GET /plugins` `@CheckPolicies(can('read','Plugin'))` → `PluginInfo[]`.
  - `PUT /plugins/:id` `@CheckPolicies(can('manage','Plugin'))`, body `updatePluginSchema`
    `{ enabled: boolean }` → `PluginInfo[]`.
- New `PublicPluginsController`: `GET /public/plugins/regions` (unauthenticated) →
  `Record<RegionName, string>` (sanitized HTML for enabled plugins).
- `PluginsModule` adds the controllers, `PluginService`, `HtmlSanitizerService` (re-provided —
  dependency-free), binds `SETTING_REPOSITORY`, imports `AccountsModule` for the guards.

## Config (`@cmstack-ts/config`)

```ts
export const PLUGINS_ENABLED_KEY = 'enabledPlugins';
export const updatePluginSchema = z.object({ enabled: z.boolean() });
export const pluginInfoSchema = z.object({
  id: z.string(), name: z.string(), description: z.string(), enabled: z.boolean(),
});
export type PluginInfo = z.infer<typeof pluginInfoSchema>;
export const pluginRegionsSchema = z.object({ 'site.footer': z.string() }).partial();
```

## Web

- **Admin** `/admin/plugins` (Administrator-only via `requireAdminSession` + `canManageSettings`):
  fetch `GET /plugins`, render each plugin (name, description, enabled toggle). A Server Action
  `togglePluginAction(id, enabled)` → `apiSend('PUT', '/plugins/:id', { enabled })` +
  `revalidatePath('/admin/plugins')` + `revalidatePath('/', 'layout')` (regions change the public
  site). Add a "Plugins" link to the admin nav.
- **Public** `[locale]/layout.tsx`: a small server fetch of `GET /public/plugins/regions`
  (degrade to `{}` on error); render the `site.footer` HTML after `children` via a sanitized
  `dangerouslySetInnerHTML` wrapper. The API already sanitized it; the web only renders the
  trusted string.

## Demo plugin

`samples/site-footer-note.plugin.ts`:

```ts
export const siteFooterNotePlugin: CmstackTsPlugin = {
  id: 'site-footer-note',
  name: 'Site footer note',
  description: 'Adds a short "Built with Cmstack-TS" line to the public site footer.',
  register(api) {
    api.addRegion('site.footer', () => '<p class="plugin-footer-note">Built with Cmstack-TS</p>');
  },
};
```

## Seed

Set the `enabledPlugins` setting to `["reading-time","site-footer-note"]`; add
`{ action: 'manage', subject: 'Plugin' }` to the seeded permission catalogue (Administrator holds
`manage all`, so this is mostly catalogue hygiene).

## Testing (TDD by layer)

- **HookRegistry:** a disabled owner's filter/action/region is skipped; an un-owned (core) handler
  always runs; `renderRegion` concatenates enabled contributors in priority order and is
  fault-isolated; `setEnabledPlugins` flips behavior live.
- **PluginService:** `list` reflects the enabled set; `setEnabled` persists the setting + updates
  the registry + returns the new list; an unknown id throws `NotFoundException`; `loadEnabled`
  tolerates a malformed setting (→ default).
- **Config:** `updatePluginSchema` / `pluginInfoSchema` parse; reject a non-boolean `enabled`.
- **Public regions:** the endpoint returns sanitized HTML only for enabled plugins.
- **Web:** live + e2e (UI). Coverage gate ≥80% holds.

## Out of scope (logged, not silent)

Regions beyond `site.footer` (RegionMap is extensible — adding one is a few lines); loading
user-uploaded plugin code (in-repo only by design); per-plugin settings/config screens;
inter-plugin dependencies/ordering beyond `priority`.
