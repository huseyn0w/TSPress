import { describe, expect, it } from 'vitest';
import { createCommentSchema, moderateCommentSchema } from './comments';

describe('createCommentSchema', () => {
  it('accepts a valid guest comment', () => {
    const parsed = createCommentSchema.parse({
      authorName: 'Ada',
      authorEmail: 'ada@example.com',
      content: 'Great post!',
    });
    expect(parsed.authorName).toBe('Ada');
    expect(parsed.parentId).toBeUndefined();
  });

  it('requires a name, a valid email, and non-empty content', () => {
    expect(() =>
      createCommentSchema.parse({ authorName: '', authorEmail: 'a@b.com', content: 'x' }),
    ).toThrow();
    expect(() =>
      createCommentSchema.parse({ authorName: 'A', authorEmail: 'nope', content: 'x' }),
    ).toThrow();
    expect(() =>
      createCommentSchema.parse({ authorName: 'A', authorEmail: 'a@b.com', content: '' }),
    ).toThrow();
  });

  it('accepts an optional parentId and recaptcha token', () => {
    const parsed = createCommentSchema.parse({
      authorName: 'A',
      authorEmail: 'a@b.com',
      content: 'reply',
      parentId: 'c1',
      recaptchaToken: 'tok',
    });
    expect(parsed.parentId).toBe('c1');
    expect(parsed.recaptchaToken).toBe('tok');
  });
});

describe('moderateCommentSchema', () => {
  it('accepts a valid status', () => {
    expect(moderateCommentSchema.parse({ status: 'APPROVED' }).status).toBe('APPROVED');
  });
  it('rejects an unknown status', () => {
    expect(() => moderateCommentSchema.parse({ status: 'NOPE' })).toThrow();
  });
});
