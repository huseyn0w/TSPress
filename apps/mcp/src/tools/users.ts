import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  adminUserListSchema,
  adminUserSchema,
  roleSummarySchema,
  updateUserSchema,
  userListQuerySchema,
} from '@cmstack-ts/config';
import { z } from 'zod';
import type { ApiClient } from '../api-client.js';
import { READ, UPDATE, respond } from '../tool-kit.js';

/**
 * User tools. Gated by the `User` CASL subject. Deliberately scoped to listing
 * and role assignment; user deletion is not exposed over MCP. Email, password
 * hashes, and other sensitive fields are never returned by the API.
 */
export function registerUserTools(server: McpServer, client: ApiClient): void {
  server.registerTool(
    'cmstack_ts_list_users',
    {
      title: 'List users',
      description:
        'List users with optional text search (q) and pagination. Returns { items, total, page, perPage }; each item includes id, email, name, image, role, createdAt.',
      inputSchema: userListQuerySchema,
      annotations: READ,
    },
    (input) =>
      respond(() => client.request('GET', '/users', { query: input, schema: adminUserListSchema })),
  );

  server.registerTool(
    'cmstack_ts_list_roles',
    {
      title: 'List roles',
      description:
        'List the available roles ({ id, name }) for assignment with cmstack_ts_update_user.',
      inputSchema: z.object({}),
      annotations: READ,
    },
    () =>
      respond(() => client.request('GET', '/users/roles', { schema: z.array(roleSummarySchema) })),
  );

  server.registerTool(
    'cmstack_ts_get_user',
    {
      title: 'Get a user',
      description: 'Fetch a single user by id (id, email, name, image, role, createdAt).',
      inputSchema: z.object({ id: z.string().min(1).describe('The user id.') }),
      annotations: READ,
    },
    ({ id }) => respond(() => client.request('GET', `/users/${id}`, { schema: adminUserSchema })),
  );

  server.registerTool(
    'cmstack_ts_update_user',
    {
      title: 'Update a user',
      description:
        'Update a user by id. Any subset of: name, roleId (assign a role; use cmstack_ts_list_roles for valid ids). Returns the updated user. A user cannot change their own role.',
      inputSchema: updateUserSchema.extend({ id: z.string().min(1) }),
      annotations: UPDATE,
    },
    ({ id, ...body }) =>
      respond(() => client.request('PATCH', `/users/${id}`, { body, schema: adminUserSchema })),
  );
}
