import { describe, expect, it } from 'vitest';
import { ApiError, describeStatus, extractApiDetail, formatToolError } from './errors';

describe('describeStatus', () => {
  it('explains a 403 as a CASL permission boundary', () => {
    expect(describeStatus(403)).toMatch(/permission/i);
  });

  it('explains a 401 by pointing at the credentials env vars', () => {
    expect(describeStatus(401)).toMatch(/MCP_API_EMAIL/);
  });

  it('treats any 5xx as a server error', () => {
    expect(describeStatus(503)).toMatch(/server error/i);
  });

  it('falls back to a generic message for unknown statuses', () => {
    expect(describeStatus(418)).toMatch(/status 418/);
  });
});

describe('extractApiDetail', () => {
  it('returns a string message as-is', () => {
    expect(extractApiDetail({ message: 'Slug already exists' })).toBe('Slug already exists');
  });

  it('joins an array of field messages', () => {
    expect(extractApiDetail({ message: ['title: Required', 'slug: invalid'] })).toBe(
      'title: Required; slug: invalid',
    );
  });

  it('returns undefined when there is no usable message', () => {
    expect(extractApiDetail({ statusCode: 500 })).toBeUndefined();
    expect(extractApiDetail(null)).toBeUndefined();
    expect(extractApiDetail('boom')).toBeUndefined();
  });
});

describe('formatToolError', () => {
  it('formats an ApiError with status and detail', () => {
    const err = new ApiError(400, 'Bad Request', { message: ['title: Required'] });
    expect(formatToolError(err)).toBe(
      'Error 400: Bad request: the input failed API validation. Detail: title: Required',
    );
  });

  it('formats an ApiError without detail', () => {
    const err = new ApiError(404, 'Not Found', {});
    expect(formatToolError(err)).toBe(
      'Error 404: Not found: the resource does not exist (check the id or slug).',
    );
  });

  it('formats a plain Error', () => {
    expect(formatToolError(new Error('socket hang up'))).toBe('Error: socket hang up');
  });
});
