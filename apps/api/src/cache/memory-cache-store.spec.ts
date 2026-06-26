import { describe, expect, it, vi } from 'vitest';
import { MemoryCacheStore } from './memory-cache-store';

describe('MemoryCacheStore', () => {
  it('stores and returns a value', async () => {
    const store = new MemoryCacheStore();
    await store.set('a', 'one', 60);
    expect(await store.get('a')).toBe('one');
  });

  it('returns null after TTL expiry', async () => {
    vi.useFakeTimers();
    const store = new MemoryCacheStore();
    await store.set('a', 'one', 1);
    vi.advanceTimersByTime(1500);
    expect(await store.get('a')).toBeNull();
    vi.useRealTimers();
  });

  it('deletes a single key', async () => {
    const store = new MemoryCacheStore();
    await store.set('a', 'one', 60);
    await store.del('a');
    expect(await store.get('a')).toBeNull();
  });

  it('deletes every key under a prefix', async () => {
    const store = new MemoryCacheStore();
    await store.set('cms:seo:x', '1', 60);
    await store.set('cms:seo:y', '2', 60);
    await store.set('cms:menus:z', '3', 60);
    await store.delByPrefix('cms:seo:');
    expect(await store.get('cms:seo:x')).toBeNull();
    expect(await store.get('cms:seo:y')).toBeNull();
    expect(await store.get('cms:menus:z')).toBe('3');
  });
});
