/**
 * Error helpers. API failures are turned into clear, actionable tool errors so
 * an AI client understands what went wrong (and, for 403s, that it's a CASL
 * permission boundary it cannot work around).
 */

/** Raised when the Typress API returns a non-2xx response. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** A human-readable explanation for a given HTTP status. */
export function describeStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Bad request: the input failed API validation.';
    case 401:
      return 'Authentication failed: check MCP_API_EMAIL and MCP_API_PASSWORD.';
    case 403:
      return 'Permission denied: the MCP account lacks the CASL permission for this action. Use an account with a higher role.';
    case 404:
      return 'Not found: the resource does not exist (check the id or slug).';
    case 409:
      return 'Conflict: the resource already exists (e.g. a duplicate slug).';
    case 422:
      return 'Unprocessable input: the API rejected the payload.';
    case 429:
      return 'Rate limit exceeded: wait before retrying.';
    default:
      if (status >= 500) return 'The API encountered a server error.';
      return `The API request failed with status ${status}.`;
  }
}

/**
 * Pull a readable detail string out of a Nest error body, which is shaped like
 * `{ statusCode, message, error }` where `message` may be a string or string[]
 * (the field-level messages from ZodValidationPipe).
 */
export function extractApiDetail(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const message = (body as { message?: unknown }).message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) {
    const parts = message.filter((m): m is string => typeof m === 'string');
    if (parts.length > 0) return parts.join('; ');
  }
  return undefined;
}

/** Format any thrown value into a tool-facing error string. */
export function formatToolError(error: unknown): string {
  if (error instanceof ApiError) {
    const detail = extractApiDetail(error.body);
    const base = `Error ${error.status}: ${describeStatus(error.status)}`;
    return detail ? `${base} Detail: ${detail}` : base;
  }
  return `Error: ${error instanceof Error ? error.message : String(error)}`;
}
