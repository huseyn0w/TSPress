import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  createCategorySchema,
  createPageSchema,
  createPostSchema,
  createTagSchema,
  pageDetailSchema,
  postDetailSchema,
  postListQuerySchema,
  postListSchema,
  updateCategorySchema,
  updatePageSchema,
  updatePostSchema,
  updateTagSchema,
} from '@cmstack-ts/config';
import { z } from 'zod';
import type { ApiClient } from '../api-client.js';
import { CREATE, DESTRUCTIVE, READ, UPDATE, respond } from '../tool-kit.js';

const byId = z.object({ id: z.string().min(1).describe('The resource id (a cuid).') });
const pageListQuery = z.object({
  includeTrashed: z.boolean().optional().describe('Include soft-deleted pages.'),
});

/**
 * Register content management tools (posts, pages, categories, tags). Every
 * call hits a CASL-gated authoring endpoint, so the configured account must
 * hold the matching content permission (Editor or Administrator).
 */
export function registerContentTools(server: McpServer, client: ApiClient): void {
  // --- Posts -----------------------------------------------------------------

  server.registerTool(
    'cmstack_ts_list_posts',
    {
      title: 'List posts',
      description:
        'List posts (drafts and published) with optional filters and pagination. Returns { items, total, page, perPage }. Filters: status (DRAFT|PUBLISHED), categorySlug, tagSlug, q (text), includeTrashed.',
      inputSchema: postListQuerySchema,
      annotations: READ,
    },
    (input) =>
      respond(() => client.request('GET', '/posts', { query: input, schema: postListSchema })),
  );

  server.registerTool(
    'cmstack_ts_get_post',
    {
      title: 'Get a post',
      description: 'Fetch a single post by id, including its full content, categories, and tags.',
      inputSchema: byId,
      annotations: READ,
    },
    ({ id }) => respond(() => client.request('GET', `/posts/${id}`, { schema: postDetailSchema })),
  );

  server.registerTool(
    'cmstack_ts_get_post_revisions',
    {
      title: 'Get post revisions',
      description:
        'List the saved revisions (scalar field snapshots) of a post by id, newest first.',
      inputSchema: byId,
      annotations: READ,
    },
    ({ id }) => respond(() => client.request('GET', `/posts/${id}/revisions`)),
  );

  server.registerTool(
    'cmstack_ts_create_post',
    {
      title: 'Create a post',
      description:
        'Create a post. Fields: title (required), slug (optional, auto-generated from title), excerpt, content (HTML; sanitized server-side), status (DRAFT default), categoryIds, tagIds. Returns the created post.',
      inputSchema: createPostSchema,
      annotations: CREATE,
    },
    (input) =>
      respond(() => client.request('POST', '/posts', { body: input, schema: postDetailSchema })),
  );

  server.registerTool(
    'cmstack_ts_update_post',
    {
      title: 'Update a post',
      description:
        'Update a post by id. Any subset of: title, slug, excerpt, content, status, categoryIds, tagIds. Returns the updated post.',
      inputSchema: updatePostSchema.extend({ id: z.string().min(1) }),
      annotations: UPDATE,
    },
    ({ id, ...body }) =>
      respond(() => client.request('PATCH', `/posts/${id}`, { body, schema: postDetailSchema })),
  );

  server.registerTool(
    'cmstack_ts_publish_post',
    {
      title: 'Publish a post',
      description: 'Publish a post by id (sets status to PUBLISHED). Returns the updated post.',
      inputSchema: byId,
      annotations: UPDATE,
    },
    ({ id }) =>
      respond(() =>
        client.request('PATCH', `/posts/${id}`, {
          body: { status: 'PUBLISHED' },
          schema: postDetailSchema,
        }),
      ),
  );

  server.registerTool(
    'cmstack_ts_unpublish_post',
    {
      title: 'Unpublish a post',
      description:
        'Unpublish a post by id (sets status back to DRAFT, hiding it from the public site). Returns the updated post.',
      inputSchema: byId,
      annotations: UPDATE,
    },
    ({ id }) =>
      respond(() =>
        client.request('PATCH', `/posts/${id}`, {
          body: { status: 'DRAFT' },
          schema: postDetailSchema,
        }),
      ),
  );

  server.registerTool(
    'cmstack_ts_delete_post',
    {
      title: 'Delete a post',
      description:
        'Soft-delete a post by id (moves it to trash; restorable with cmstack_ts_restore_post).',
      inputSchema: byId,
      annotations: DESTRUCTIVE,
    },
    ({ id }) => respond(() => client.request('DELETE', `/posts/${id}`)),
  );

  server.registerTool(
    'cmstack_ts_restore_post',
    {
      title: 'Restore a post',
      description: 'Restore a soft-deleted (trashed) post by id. Returns the restored post.',
      inputSchema: byId,
      annotations: UPDATE,
    },
    ({ id }) =>
      respond(() => client.request('POST', `/posts/${id}/restore`, { schema: postDetailSchema })),
  );

  // --- Pages -----------------------------------------------------------------

  server.registerTool(
    'cmstack_ts_list_pages',
    {
      title: 'List pages',
      description: 'List all pages. Set includeTrashed to also return soft-deleted pages.',
      inputSchema: pageListQuery,
      annotations: READ,
    },
    (input) => respond(() => client.request('GET', '/pages', { query: input })),
  );

  server.registerTool(
    'cmstack_ts_get_page',
    {
      title: 'Get a page',
      description: 'Fetch a single page by id, including its full content.',
      inputSchema: byId,
      annotations: READ,
    },
    ({ id }) => respond(() => client.request('GET', `/pages/${id}`, { schema: pageDetailSchema })),
  );

  server.registerTool(
    'cmstack_ts_create_page',
    {
      title: 'Create a page',
      description:
        'Create a page. Fields: title (required), slug (optional), content (HTML; sanitized server-side), status (DRAFT default). Returns the created page.',
      inputSchema: createPageSchema,
      annotations: CREATE,
    },
    (input) =>
      respond(() => client.request('POST', '/pages', { body: input, schema: pageDetailSchema })),
  );

  server.registerTool(
    'cmstack_ts_update_page',
    {
      title: 'Update a page',
      description:
        'Update a page by id. Any subset of: title, slug, content, status. Returns the updated page.',
      inputSchema: updatePageSchema.extend({ id: z.string().min(1) }),
      annotations: UPDATE,
    },
    ({ id, ...body }) =>
      respond(() => client.request('PATCH', `/pages/${id}`, { body, schema: pageDetailSchema })),
  );

  server.registerTool(
    'cmstack_ts_delete_page',
    {
      title: 'Delete a page',
      description: 'Soft-delete a page by id (moves it to trash; restorable).',
      inputSchema: byId,
      annotations: DESTRUCTIVE,
    },
    ({ id }) => respond(() => client.request('DELETE', `/pages/${id}`)),
  );

  server.registerTool(
    'cmstack_ts_restore_page',
    {
      title: 'Restore a page',
      description: 'Restore a soft-deleted (trashed) page by id. Returns the restored page.',
      inputSchema: byId,
      annotations: UPDATE,
    },
    ({ id }) =>
      respond(() => client.request('POST', `/pages/${id}/restore`, { schema: pageDetailSchema })),
  );

  // --- Categories ------------------------------------------------------------

  server.registerTool(
    'cmstack_ts_list_categories',
    {
      title: 'List categories',
      description: 'List all categories (a self-referential tree; each item carries its parentId).',
      inputSchema: z.object({}),
      annotations: READ,
    },
    () => respond(() => client.request('GET', '/categories')),
  );

  server.registerTool(
    'cmstack_ts_create_category',
    {
      title: 'Create a category',
      description:
        'Create a category. Fields: name (required), slug (optional), description, parentId (optional, for nesting). Returns the created category.',
      inputSchema: createCategorySchema,
      annotations: CREATE,
    },
    (input) => respond(() => client.request('POST', '/categories', { body: input })),
  );

  server.registerTool(
    'cmstack_ts_update_category',
    {
      title: 'Update a category',
      description:
        'Update a category by id. Any subset of: name, slug, description, parentId. Returns the updated category.',
      inputSchema: updateCategorySchema.extend({ id: z.string().min(1) }),
      annotations: UPDATE,
    },
    ({ id, ...body }) => respond(() => client.request('PATCH', `/categories/${id}`, { body })),
  );

  server.registerTool(
    'cmstack_ts_delete_category',
    {
      title: 'Delete a category',
      description: 'Permanently delete a category by id.',
      inputSchema: byId,
      annotations: DESTRUCTIVE,
    },
    ({ id }) => respond(() => client.request('DELETE', `/categories/${id}`)),
  );

  // --- Tags ------------------------------------------------------------------

  server.registerTool(
    'cmstack_ts_list_tags',
    {
      title: 'List tags',
      description: 'List all tags.',
      inputSchema: z.object({}),
      annotations: READ,
    },
    () => respond(() => client.request('GET', '/tags')),
  );

  server.registerTool(
    'cmstack_ts_create_tag',
    {
      title: 'Create a tag',
      description:
        'Create a tag. Fields: name (required), slug (optional). Returns the created tag.',
      inputSchema: createTagSchema,
      annotations: CREATE,
    },
    (input) => respond(() => client.request('POST', '/tags', { body: input })),
  );

  server.registerTool(
    'cmstack_ts_update_tag',
    {
      title: 'Update a tag',
      description: 'Update a tag by id. Any subset of: name, slug. Returns the updated tag.',
      inputSchema: updateTagSchema.extend({ id: z.string().min(1) }),
      annotations: UPDATE,
    },
    ({ id, ...body }) => respond(() => client.request('PATCH', `/tags/${id}`, { body })),
  );

  server.registerTool(
    'cmstack_ts_delete_tag',
    {
      title: 'Delete a tag',
      description: 'Permanently delete a tag by id.',
      inputSchema: byId,
      annotations: DESTRUCTIVE,
    },
    ({ id }) => respond(() => client.request('DELETE', `/tags/${id}`)),
  );
}
