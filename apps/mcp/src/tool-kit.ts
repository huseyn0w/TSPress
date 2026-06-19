import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { formatToolError } from './errors.js';

/** Cap response size so a large list never floods the client context. */
export const CHARACTER_LIMIT = 25_000;

/** Annotation presets describing how each kind of tool behaves. */
export const READ: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};
export const CREATE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
};
export const UPDATE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};
export const DESTRUCTIVE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: true,
};

/** Wrap arbitrary API data into a structured-content tool result (JSON text). */
export function toolResult(data: unknown): CallToolResult {
  // A 204/empty response (deletes) carries no body.
  if (data === undefined || data === null) {
    return {
      content: [{ type: 'text', text: 'Done. The API returned no content (success).' }],
      structuredContent: { ok: true },
    };
  }

  // structuredContent must be a JSON object; wrap arrays and scalars.
  const structuredContent: Record<string, unknown> =
    typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : { result: data };

  let text = JSON.stringify(data, null, 2);
  if (text.length > CHARACTER_LIMIT) {
    text = `The response is too large to return in full (${text.length} characters). Narrow the request with filters or pagination (e.g. a smaller perPage, a status filter, or a specific id/slug).`;
    return { content: [{ type: 'text', text }], structuredContent: { truncated: true } };
  }

  return { content: [{ type: 'text', text }], structuredContent };
}

/** Turn a thrown error into an `isError` tool result. */
export function errorResult(error: unknown): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: formatToolError(error) }] };
}

/** Run a producer and format its result/error as a CallToolResult. */
export async function respond(produce: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return toolResult(await produce());
  } catch (error) {
    return errorResult(error);
  }
}
