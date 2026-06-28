import type { Media } from '@cmstack-ts/config';
import { describe, expect, it } from 'vitest';
import { absoluteMediaUrl, defaultAltFor, isImageMedia, mediaToImageAttrs } from './media-insert';

const ORIGIN = 'http://localhost:4000';

function media(overrides: Partial<Media> = {}): Media {
  return {
    id: 'm1',
    filename: 'photo.webp',
    originalName: 'Photo.jpg',
    mimeType: 'image/jpeg',
    size: 1234,
    width: 800,
    height: 600,
    alt: null,
    title: null,
    caption: null,
    url: '/uploads/photo.webp',
    thumbnails: [],
    createdAt: '2026-06-29T00:00:00.000Z',
    updatedAt: '2026-06-29T00:00:00.000Z',
    ...overrides,
  };
}

describe('absoluteMediaUrl', () => {
  it('prefixes a root-relative url with the API origin', () => {
    expect(absoluteMediaUrl('/uploads/x.webp', ORIGIN)).toBe(
      'http://localhost:4000/uploads/x.webp',
    );
  });

  it('leaves an absolute http(s) url untouched', () => {
    expect(absoluteMediaUrl('https://cdn.example.com/x.webp', ORIGIN)).toBe(
      'https://cdn.example.com/x.webp',
    );
    expect(absoluteMediaUrl('http://cdn.example.com/x.webp', ORIGIN)).toBe(
      'http://cdn.example.com/x.webp',
    );
  });
});

describe('isImageMedia', () => {
  it('is true only for image mime types', () => {
    expect(isImageMedia('image/png')).toBe(true);
    expect(isImageMedia('image/webp')).toBe(true);
    expect(isImageMedia('application/pdf')).toBe(false);
    expect(isImageMedia('text/plain')).toBe(false);
  });
});

describe('defaultAltFor', () => {
  it('prefers alt, then title, then empty (never the filename)', () => {
    expect(defaultAltFor(media({ alt: 'A cat', title: 'Ignored' }))).toBe('A cat');
    expect(defaultAltFor(media({ alt: null, title: 'A title' }))).toBe('A title');
    expect(defaultAltFor(media({ alt: null, title: null }))).toBe('');
    expect(defaultAltFor(media({ alt: '  ', title: 'Trimmed wins' }))).toBe('Trimmed wins');
  });
});

describe('mediaToImageAttrs', () => {
  it('builds an absolute src from the full image (not the thumbnail) with the chosen alt', () => {
    const item = media({
      url: '/uploads/full.webp',
      thumbnails: [
        { label: 'thumb', url: '/uploads/full-thumb.webp', width: 400, height: 300, size: 999 },
      ],
    });
    expect(mediaToImageAttrs(item, ORIGIN, 'Custom alt')).toEqual({
      src: 'http://localhost:4000/uploads/full.webp',
      alt: 'Custom alt',
    });
  });

  it('trims the alt and falls back to the media default when not provided', () => {
    const item = media({ alt: 'Default alt' });
    expect(mediaToImageAttrs(item, ORIGIN)).toEqual({
      src: 'http://localhost:4000/uploads/photo.webp',
      alt: 'Default alt',
    });
    expect(mediaToImageAttrs(item, ORIGIN, '  spaced  ')).toEqual({
      src: 'http://localhost:4000/uploads/photo.webp',
      alt: 'spaced',
    });
  });
});
