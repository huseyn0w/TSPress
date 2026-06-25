import { describe, expect, it } from 'vitest';
import {
  createMenuItemSchema,
  menuStructureSchema,
  normalizeCustomUrl,
  resolveMenuItemUrl,
} from './menu';

describe('resolveMenuItemUrl', () => {
  it('maps POST to the blog post path', () => {
    expect(resolveMenuItemUrl('POST', 'hello-world', null)).toBe('/blog/hello-world');
  });
  it('maps PAGE to the root slug path', () => {
    expect(resolveMenuItemUrl('PAGE', 'about', null)).toBe('/about');
  });
  it('maps CATEGORY to the blog category filter', () => {
    expect(resolveMenuItemUrl('CATEGORY', 'guides', null)).toBe('/blog?category=guides');
  });
  it('returns the custom url verbatim', () => {
    expect(resolveMenuItemUrl('CUSTOM', null, 'https://x.test/a')).toBe('https://x.test/a');
  });
  it('returns null when a reference slug is missing (dropped at render)', () => {
    expect(resolveMenuItemUrl('POST', null, null)).toBeNull();
  });
});

describe('normalizeCustomUrl', () => {
  it('accepts a site-relative path', () => {
    expect(normalizeCustomUrl('/contact')).toBe('/contact');
  });
  it('accepts an absolute http(s) url', () => {
    expect(normalizeCustomUrl('https://x.test')).toBe('https://x.test');
  });
  it('rejects a javascript: url', () => {
    expect(normalizeCustomUrl('javascript:alert(1)')).toBeNull();
  });
  it('rejects a relative path without a leading slash', () => {
    expect(normalizeCustomUrl('contact')).toBeNull();
  });
  it('rejects a protocol-relative url', () => {
    expect(normalizeCustomUrl('//evil.test')).toBeNull();
  });
});

describe('createMenuItemSchema', () => {
  it('requires url for CUSTOM and rejects a bad protocol', () => {
    expect(
      createMenuItemSchema.safeParse({ type: 'CUSTOM', label: 'X', url: 'javascript:1' }).success,
    ).toBe(false);
    expect(createMenuItemSchema.safeParse({ type: 'CUSTOM', label: 'X', url: '/ok' }).success).toBe(
      true,
    );
  });
  it('requires targetId for POST', () => {
    expect(createMenuItemSchema.safeParse({ type: 'POST', label: 'X' }).success).toBe(false);
    expect(
      createMenuItemSchema.safeParse({ type: 'POST', label: 'X', targetId: 'abc' }).success,
    ).toBe(true);
  });
});

describe('menuStructureSchema', () => {
  it('accepts a flat list of nodes', () => {
    const r = menuStructureSchema.safeParse({ nodes: [{ id: 'a', parentId: null, order: 0 }] });
    expect(r.success).toBe(true);
  });
});
