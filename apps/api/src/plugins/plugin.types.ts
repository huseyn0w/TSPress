import type { ActionMap, ActionName, FilterMap, FilterName } from './hooks';

export type FilterHandler<K extends FilterName> = (
  value: FilterMap[K],
) => FilterMap[K] | Promise<FilterMap[K]>;

export type ActionHandler<K extends ActionName> = (payload: ActionMap[K]) => void | Promise<void>;

/**
 * The constrained surface a plugin is given at registration time. A plugin can
 * only attach handlers to declared hooks — it never receives the Nest container,
 * Prisma, or request objects, so "plugins" are extension points, not arbitrary
 * code injection.
 */
export interface PluginApi {
  addFilter<K extends FilterName>(name: K, handler: FilterHandler<K>, priority?: number): void;
  addAction<K extends ActionName>(name: K, handler: ActionHandler<K>, priority?: number): void;
}

/** A plugin is an in-repo module implementing this typed contract. */
export interface TypressPlugin {
  /** Stable, human-readable name (used in logs). */
  name: string;
  /** Called once at bootstrap to attach the plugin's hook handlers. */
  register(api: PluginApi): void;
}
