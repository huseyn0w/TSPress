import { Injectable, Logger } from '@nestjs/common';
import type { ActionMap, ActionName, FilterMap, FilterName } from './hooks';
import type { ActionHandler, FilterHandler, PluginApi } from './plugin.types';

interface Entry {
  handler: (value: unknown) => unknown;
  priority: number;
}

/**
 * The typed hook/event registry. Plugins register filter and action handlers
 * through the `PluginApi` surface; the rest of the app drives extension points
 * via `applyFilters` (transform a value) and `emit` (fire an event). Handlers run
 * in ascending priority order; equal priorities keep registration order.
 */
@Injectable()
export class HookRegistry implements PluginApi {
  private readonly logger = new Logger('HookRegistry');
  private readonly filters = new Map<string, Entry[]>();
  private readonly actions = new Map<string, Entry[]>();

  addFilter<K extends FilterName>(name: K, handler: FilterHandler<K>, priority = 10): void {
    this.insert(this.filters, name, handler as Entry['handler'], priority);
  }

  addAction<K extends ActionName>(name: K, handler: ActionHandler<K>, priority = 10): void {
    this.insert(this.actions, name, handler as Entry['handler'], priority);
  }

  /** Thread `value` through every registered filter for `name`, in order. */
  async applyFilters<K extends FilterName>(name: K, value: FilterMap[K]): Promise<FilterMap[K]> {
    const entries = this.filters.get(name);
    if (!entries) return value;
    let acc: FilterMap[K] = value;
    for (const entry of entries) {
      acc = (await entry.handler(acc)) as FilterMap[K];
    }
    return acc;
  }

  /**
   * Invoke every action listener for `name`, in order. Actions are fire-and-forget:
   * a throwing listener is logged and isolated so it can neither break the caller
   * (e.g. fail an already-committed write) nor stop the other listeners.
   */
  async emit<K extends ActionName>(name: K, payload: ActionMap[K]): Promise<void> {
    const entries = this.actions.get(name);
    if (!entries) return;
    for (const entry of entries) {
      try {
        await entry.handler(payload);
      } catch (error) {
        this.logger.error(`Action listener for "${name}" threw`, error as Error);
      }
    }
  }

  private insert(
    map: Map<string, Entry[]>,
    name: string,
    handler: Entry['handler'],
    priority: number,
  ): void {
    const entries = map.get(name) ?? [];
    entries.push({ handler, priority });
    // Stable ascending sort: Array.prototype.sort is stable, so equal priorities
    // retain registration order.
    entries.sort((a, b) => a.priority - b.priority);
    map.set(name, entries);
  }
}
