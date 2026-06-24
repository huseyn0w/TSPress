import { describe, expect, it } from 'vitest';
import { languageAlternates, localizedPath, localizedUrl } from './alternates';

const opts = {
  locales: ['en', 'de', 'ru'] as const,
  defaultLocale: 'en',
  baseUrl: 'https://cmstack-ts.example.com',
};

describe('localizedPath', () => {
  it('leaves the default locale unprefixed', () => {
    expect(localizedPath('en', '/blog', 'en')).toBe('/blog');
    expect(localizedPath('en', '/', 'en')).toBe('/');
  });

  it('prefixes non-default locales', () => {
    expect(localizedPath('de', '/blog', 'en')).toBe('/de/blog');
    expect(localizedPath('ru', '/blog/hello', 'en')).toBe('/ru/blog/hello');
  });

  it('handles the home path for a prefixed locale without a trailing slash', () => {
    expect(localizedPath('de', '/', 'en')).toBe('/de');
  });

  it('normalizes missing leading slash and trailing slashes', () => {
    expect(localizedPath('de', 'blog/', 'en')).toBe('/de/blog');
  });
});

describe('localizedUrl', () => {
  it('builds an absolute URL', () => {
    expect(localizedUrl('de', '/blog', opts)).toBe('https://cmstack-ts.example.com/de/blog');
    expect(localizedUrl('en', '/', opts)).toBe('https://cmstack-ts.example.com/');
  });
});

describe('languageAlternates', () => {
  it('maps every locale plus x-default to absolute URLs', () => {
    expect(languageAlternates('/blog', opts)).toEqual({
      en: 'https://cmstack-ts.example.com/blog',
      de: 'https://cmstack-ts.example.com/de/blog',
      ru: 'https://cmstack-ts.example.com/ru/blog',
      'x-default': 'https://cmstack-ts.example.com/blog',
    });
  });

  it('handles the home path', () => {
    expect(languageAlternates('/', opts)).toEqual({
      en: 'https://cmstack-ts.example.com/',
      de: 'https://cmstack-ts.example.com/de',
      ru: 'https://cmstack-ts.example.com/ru',
      'x-default': 'https://cmstack-ts.example.com/',
    });
  });
});
