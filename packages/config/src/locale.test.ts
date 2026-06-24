import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, LOCALES, localeSchema } from './locale';

describe('locale', () => {
  it('lists en/de/ru with en default', () => {
    expect(LOCALES).toEqual(['en', 'de', 'ru']);
    expect(DEFAULT_LOCALE).toBe('en');
  });

  it('rejects an unknown locale and accepts a known one', () => {
    expect(localeSchema.safeParse('xx').success).toBe(false);
    expect(localeSchema.safeParse('de').success).toBe(true);
  });
});
