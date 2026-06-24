import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  adminCommentListQuerySchema,
  adminCommentListSchema,
  adminCommentSchema,
} from '@cmstack-ts/config';
import { z } from 'zod';
import type { ApiClient } from '../api-client.js';
import { DESTRUCTIVE, READ, UPDATE, respond } from '../tool-kit.js';

const byId = z.object({ id: z.string().min(1).describe('The comment id.') });

/**
 * Comment moderation tools. Gated by the `Comment` CASL subject (Editor +
 * Administrator). New comments arrive PENDING and only become public once
 * approved.
 */
export function registerCommentTools(server: McpServer, client: ApiClient): void {
  server.registerTool(
    'cmstack_ts_list_comments',
    {
      title: 'List comments',
      description:
        'List comments for moderation with optional status filter (PENDING|APPROVED|SPAM|TRASH) and pagination. Returns { items, total, page, perPage }; each item includes the post slug/title and author email (admin view).',
      inputSchema: adminCommentListQuerySchema,
      annotations: READ,
    },
    (input) =>
      respond(() =>
        client.request('GET', '/comments', { query: input, schema: adminCommentListSchema }),
      ),
  );

  server.registerTool(
    'cmstack_ts_approve_comment',
    {
      title: 'Approve a comment',
      description:
        'Approve a comment by id (status APPROVED), making it publicly visible. Returns the updated comment.',
      inputSchema: byId,
      annotations: UPDATE,
    },
    ({ id }) =>
      respond(() =>
        client.request('PATCH', `/comments/${id}`, {
          body: { status: 'APPROVED' },
          schema: adminCommentSchema,
        }),
      ),
  );

  server.registerTool(
    'cmstack_ts_mark_comment_spam',
    {
      title: 'Mark a comment as spam',
      description:
        'Mark a comment by id as SPAM (hides it from the public site). Returns the updated comment.',
      inputSchema: byId,
      annotations: UPDATE,
    },
    ({ id }) =>
      respond(() =>
        client.request('PATCH', `/comments/${id}`, {
          body: { status: 'SPAM' },
          schema: adminCommentSchema,
        }),
      ),
  );

  server.registerTool(
    'cmstack_ts_trash_comment',
    {
      title: 'Trash a comment',
      description: 'Move a comment by id to TRASH. Returns the updated comment.',
      inputSchema: byId,
      annotations: UPDATE,
    },
    ({ id }) =>
      respond(() =>
        client.request('PATCH', `/comments/${id}`, {
          body: { status: 'TRASH' },
          schema: adminCommentSchema,
        }),
      ),
  );

  server.registerTool(
    'cmstack_ts_delete_comment',
    {
      title: 'Delete a comment',
      description: 'Permanently delete a comment by id.',
      inputSchema: byId,
      annotations: DESTRUCTIVE,
    },
    ({ id }) => respond(() => client.request('DELETE', `/comments/${id}`)),
  );
}
