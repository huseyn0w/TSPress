import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  mediaListQuerySchema,
  mediaListSchema,
  mediaSchema,
  updateMediaSchema,
} from '@cmstack-ts/config';
import { z } from 'zod';
import type { ApiClient } from '../api-client.js';
import { DESTRUCTIVE, READ, UPDATE, respond } from '../tool-kit.js';

const byId = z.object({ id: z.string().min(1).describe('The media asset id.') });

/**
 * Media tools. Binary upload is intentionally NOT exposed over MCP (it requires
 * a multipart file body and byte-level validation); these tools list and manage
 * existing assets and their editorial metadata.
 */
export function registerMediaTools(server: McpServer, client: ApiClient): void {
  server.registerTool(
    'cmstack_ts_list_media',
    {
      title: 'List media',
      description:
        'List uploaded media assets with pagination. Returns { items, total, page, perPage }; each item includes its public url, dimensions, and metadata.',
      inputSchema: mediaListQuerySchema,
      annotations: READ,
    },
    (input) =>
      respond(() => client.request('GET', '/media', { query: input, schema: mediaListSchema })),
  );

  server.registerTool(
    'cmstack_ts_get_media',
    {
      title: 'Get a media asset',
      description: 'Fetch a single media asset by id.',
      inputSchema: byId,
      annotations: READ,
    },
    ({ id }) => respond(() => client.request('GET', `/media/${id}`, { schema: mediaSchema })),
  );

  server.registerTool(
    'cmstack_ts_update_media',
    {
      title: 'Update media metadata',
      description:
        "Update a media asset's editorial metadata by id. Any subset of: alt, title, caption (each may be set to null to clear). Returns the updated asset.",
      inputSchema: updateMediaSchema.extend({ id: z.string().min(1) }),
      annotations: UPDATE,
    },
    ({ id, ...body }) =>
      respond(() => client.request('PATCH', `/media/${id}`, { body, schema: mediaSchema })),
  );

  server.registerTool(
    'cmstack_ts_delete_media',
    {
      title: 'Delete a media asset',
      description: 'Permanently delete a media asset (and its stored file) by id.',
      inputSchema: byId,
      annotations: DESTRUCTIVE,
    },
    ({ id }) => respond(() => client.request('DELETE', `/media/${id}`)),
  );
}
