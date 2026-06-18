import { describe, expect, it } from 'vitest';
import { likeStateSchema, updateAccountSchema } from './profile';

describe('updateAccountSchema', () => {
  it('accepts partial updates', () => {
    expect(updateAccountSchema.parse({ bio: 'Hi there.' }).bio).toBe('Hi there.');
    expect(updateAccountSchema.parse({}).name).toBeUndefined();
  });

  it('rejects an empty name and an over-long bio', () => {
    expect(() => updateAccountSchema.parse({ name: '' })).toThrow();
    expect(() => updateAccountSchema.parse({ bio: 'x'.repeat(601) })).toThrow();
  });

  it('accepts an empty or valid image url', () => {
    expect(updateAccountSchema.parse({ image: '' }).image).toBe('');
    expect(updateAccountSchema.parse({ image: 'https://x.test/a.png' }).image).toBe(
      'https://x.test/a.png',
    );
    expect(() => updateAccountSchema.parse({ image: 'not-a-url' })).toThrow();
  });
});

describe('likeStateSchema', () => {
  it('parses a like state', () => {
    expect(likeStateSchema.parse({ likes: 3, liked: true })).toEqual({ likes: 3, liked: true });
  });
});
