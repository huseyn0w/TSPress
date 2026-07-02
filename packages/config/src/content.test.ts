import { describe, expect, it } from 'vitest';
import {
  createPostSchema,
  scheduleLabel,
  termTranslationInputSchema,
  updatePostSchema,
} from './content';

const NOW = new Date('2026-06-28T12:00:00.000Z');

describe('createPostSchema scheduledAt', () => {
  it('accepts an ISO scheduledAt', () => {
    const parsed = createPostSchema.parse({ title: 'T', scheduledAt: '2026-07-01T09:00:00.000Z' });
    expect(parsed.scheduledAt).toBe('2026-07-01T09:00:00.000Z');
  });

  it('accepts null and absent', () => {
    expect(createPostSchema.parse({ title: 'T', scheduledAt: null }).scheduledAt).toBeNull();
    expect(createPostSchema.parse({ title: 'T' }).scheduledAt).toBeUndefined();
  });
});

describe('clearable optional fields accept null (field-clearing)', () => {
  it('accepts null for excerpt/meta/canonical on create and update', () => {
    const parsed = updatePostSchema.parse({
      excerpt: null,
      metaTitle: null,
      metaDescription: null,
      canonicalUrl: null,
    });
    expect(parsed).toEqual({
      excerpt: null,
      metaTitle: null,
      metaDescription: null,
      canonicalUrl: null,
    });
  });

  it('still distinguishes absent (unchanged) from null (clear)', () => {
    expect(updatePostSchema.parse({}).excerpt).toBeUndefined();
    expect(updatePostSchema.parse({ excerpt: null }).excerpt).toBeNull();
  });

  it('a non-empty canonical URL still validates as a URL', () => {
    expect(createPostSchema.safeParse({ title: 'T', canonicalUrl: 'not-a-url' }).success).toBe(
      false,
    );
    expect(
      createPostSchema.safeParse({ title: 'T', canonicalUrl: 'https://x.test/a' }).success,
    ).toBe(true);
  });
});

describe('termTranslationInputSchema', () => {
  it('accepts a name override and trims it', () => {
    expect(termTranslationInputSchema.parse({ name: '  Anleitungen ' })).toEqual({
      name: 'Anleitungen',
    });
  });
  it('accepts an empty input (clears the translation)', () => {
    expect(termTranslationInputSchema.parse({})).toEqual({});
  });
  it('rejects a blank or over-long name', () => {
    expect(termTranslationInputSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(termTranslationInputSchema.safeParse({ name: 'x'.repeat(121) }).success).toBe(false);
  });
});

describe('scheduleLabel', () => {
  it('labels a published item published', () => {
    expect(scheduleLabel('PUBLISHED', null, NOW)).toBe('published');
  });
  it('labels a future-dated draft scheduled', () => {
    expect(scheduleLabel('DRAFT', '2026-06-28T13:00:00.000Z', NOW)).toBe('scheduled');
  });
  it('labels a past-dated or unscheduled draft draft', () => {
    expect(scheduleLabel('DRAFT', '2026-06-28T11:00:00.000Z', NOW)).toBe('draft');
    expect(scheduleLabel('DRAFT', null, NOW)).toBe('draft');
  });
});
