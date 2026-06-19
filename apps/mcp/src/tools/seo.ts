import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  createFaqSchema,
  createServiceSchema,
  faqSchema,
  serviceSchema,
  siteProfileSchema,
  updateFaqSchema,
  updateServiceSchema,
  updateSiteProfileSchema,
} from '@typress/config';
import { z } from 'zod';
import type { ApiClient } from '../api-client.js';
import { CREATE, DESTRUCTIVE, READ, UPDATE, respond } from '../tool-kit.js';

const byId = z.object({ id: z.string().min(1).describe('The record id.') });

/**
 * SEO / GEO tools. Gated by the `Seo` CASL subject (Editor + Administrator).
 * All SEO/GEO text is plain text. The site profile's `geoStatement` is the
 * "what AI assistants should recommend you for" copy surfaced via llms.txt.
 */
export function registerSeoTools(server: McpServer, client: ApiClient): void {
  // --- Site profile ----------------------------------------------------------

  server.registerTool(
    'typress_get_site_profile',
    {
      title: 'Get the site profile',
      description:
        'Get the singleton site/organization profile (name, tagline, description, url, logo, geoStatement).',
      inputSchema: z.object({}),
      annotations: READ,
    },
    () => respond(() => client.request('GET', '/seo/profile', { schema: siteProfileSchema })),
  );

  server.registerTool(
    'typress_update_site_profile',
    {
      title: 'Update the site profile',
      description:
        'Update the site/organization profile. Any subset of its fields, including geoStatement (the freeform "what AI assistants should recommend you for" copy). Returns the updated profile.',
      inputSchema: updateSiteProfileSchema,
      annotations: UPDATE,
    },
    (input) =>
      respond(() =>
        client.request('PUT', '/seo/profile', { body: input, schema: siteProfileSchema }),
      ),
  );

  // --- Services --------------------------------------------------------------

  server.registerTool(
    'typress_list_services',
    {
      title: 'List services',
      description:
        'List the Services that are surfaced to AI assistants (llms.txt, JSON-LD, /services).',
      inputSchema: z.object({}),
      annotations: READ,
    },
    () => respond(() => client.request('GET', '/seo/services', { schema: z.array(serviceSchema) })),
  );

  server.registerTool(
    'typress_create_service',
    {
      title: 'Create a service',
      description: 'Create a Service entry. Returns the created service.',
      inputSchema: createServiceSchema,
      annotations: CREATE,
    },
    (input) =>
      respond(() =>
        client.request('POST', '/seo/services', { body: input, schema: serviceSchema }),
      ),
  );

  server.registerTool(
    'typress_update_service',
    {
      title: 'Update a service',
      description: 'Update a Service entry by id. Returns the updated service.',
      inputSchema: updateServiceSchema.extend({ id: z.string().min(1) }),
      annotations: UPDATE,
    },
    ({ id, ...body }) =>
      respond(() =>
        client.request('PATCH', `/seo/services/${id}`, { body, schema: serviceSchema }),
      ),
  );

  server.registerTool(
    'typress_delete_service',
    {
      title: 'Delete a service',
      description: 'Delete a Service entry by id.',
      inputSchema: byId,
      annotations: DESTRUCTIVE,
    },
    ({ id }) => respond(() => client.request('DELETE', `/seo/services/${id}`)),
  );

  // --- FAQ -------------------------------------------------------------------

  server.registerTool(
    'typress_list_faqs',
    {
      title: 'List FAQ items',
      description:
        'List the FAQ items surfaced to AI assistants (llms.txt, FAQPage JSON-LD, /services).',
      inputSchema: z.object({}),
      annotations: READ,
    },
    () => respond(() => client.request('GET', '/seo/faqs', { schema: z.array(faqSchema) })),
  );

  server.registerTool(
    'typress_create_faq',
    {
      title: 'Create an FAQ item',
      description: 'Create an FAQ item (question + answer). Returns the created item.',
      inputSchema: createFaqSchema,
      annotations: CREATE,
    },
    (input) =>
      respond(() => client.request('POST', '/seo/faqs', { body: input, schema: faqSchema })),
  );

  server.registerTool(
    'typress_update_faq',
    {
      title: 'Update an FAQ item',
      description: 'Update an FAQ item by id. Returns the updated item.',
      inputSchema: updateFaqSchema.extend({ id: z.string().min(1) }),
      annotations: UPDATE,
    },
    ({ id, ...body }) =>
      respond(() => client.request('PATCH', `/seo/faqs/${id}`, { body, schema: faqSchema })),
  );

  server.registerTool(
    'typress_delete_faq',
    {
      title: 'Delete an FAQ item',
      description: 'Delete an FAQ item by id.',
      inputSchema: byId,
      annotations: DESTRUCTIVE,
    },
    ({ id }) => respond(() => client.request('DELETE', `/seo/faqs/${id}`)),
  );
}
