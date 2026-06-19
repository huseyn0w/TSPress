import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { CHARACTER_LIMIT, errorResult, toolResult } from './tool-kit';

describe('toolResult', () => {
  it('returns a success note for empty (204) responses', () => {
    const result = toolResult(undefined);
    expect(result.structuredContent).toEqual({ ok: true });
    expect(result.content[0]).toMatchObject({ type: 'text' });
  });

  it('passes objects through as structuredContent', () => {
    const result = toolResult({ id: 'p1', title: 'Hi' });
    expect(result.structuredContent).toEqual({ id: 'p1', title: 'Hi' });
  });

  it('wraps arrays under an items key', () => {
    const result = toolResult([{ id: 'a' }, { id: 'b' }]);
    expect(result.structuredContent).toEqual({ result: [{ id: 'a' }, { id: 'b' }] });
  });

  it('truncates oversized responses with guidance', () => {
    const huge = Array.from({ length: 5000 }, (_, i) => ({ i, pad: 'x'.repeat(20) }));
    const result = toolResult(huge);
    const text = result.content[0];
    expect(text.type).toBe('text');
    expect((text as { text: string }).text.length).toBeLessThan(CHARACTER_LIMIT);
    expect(result.structuredContent).toEqual({ truncated: true });
  });
});

describe('errorResult', () => {
  it('marks the result as an error and formats the message', () => {
    const result = errorResult(new ApiError(403, 'Forbidden', {}));
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toMatch(/Permission denied/);
  });
});
