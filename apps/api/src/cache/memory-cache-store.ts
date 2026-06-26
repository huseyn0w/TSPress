import { Logger } from '@nestjs/common';
import type { CacheStore } from './cache-store';

interface Entry {
  value: string;
  expiresAt: number;
}

/**
 * In-process cache used when no `REDIS_URL` is configured. Single-worker only —
 * each API process has its own map, so it is NOT shared across workers. Good for
 * local/demo runs and tests; set `REDIS_URL` for multi-worker correctness.
 */
export class MemoryCacheStore implements CacheStore {
  private readonly store = new Map<string, Entry>();

  constructor() {
    new Logger('CacheStore').log(
      'Using in-process memory cache (set REDIS_URL for a shared cache).',
    );
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async delByPrefix(prefix: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}
