import { describe, expect, it } from 'vitest';
import { createPostSchema, scheduleLabel } from './content';

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
