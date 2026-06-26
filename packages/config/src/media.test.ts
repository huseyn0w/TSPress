import { describe, expect, it } from 'vitest';
import { THUMBNAIL_SIZES, mediaSchema, thumbnailKey, thumbnailSchema } from './media';

describe('thumbnailSchema', () => {
  it('parses a derivative entry', () => {
    const t = thumbnailSchema.parse({
      label: 'thumb',
      width: 400,
      height: 320,
      url: '/uploads/abc-thumb.webp',
      size: 1234,
    });
    expect(t.label).toBe('thumb');
  });
});

describe('mediaSchema.thumbnails', () => {
  const base = {
    id: '1',
    filename: 'f',
    originalName: 'o',
    mimeType: 'image/png',
    size: 1,
    width: 10,
    height: 10,
    alt: null,
    title: null,
    caption: null,
    url: '/uploads/f',
    createdAt: '2026-06-26T00:00:00.000Z',
    updatedAt: '2026-06-26T00:00:00.000Z',
  };

  it('requires a thumbnails array', () => {
    expect(() => mediaSchema.parse(base)).toThrow();
    expect(mediaSchema.parse({ ...base, thumbnails: [] }).thumbnails).toEqual([]);
  });
});

describe('thumbnailKey', () => {
  it('derives <base>-<label>.webp and strips the source extension', () => {
    expect(thumbnailKey('123-abcd.png', 'thumb')).toBe('123-abcd-thumb.webp');
    expect(thumbnailKey('123-abcd.jpg', 'medium')).toBe('123-abcd-medium.webp');
    expect(thumbnailKey('123-abcd', 'thumb')).toBe('123-abcd-thumb.webp');
  });
});

describe('THUMBNAIL_SIZES', () => {
  it('defines thumb 400 and medium 1024', () => {
    expect(THUMBNAIL_SIZES.map((s) => [s.label, s.max])).toEqual([
      ['thumb', 400],
      ['medium', 1024],
    ]);
  });
});
