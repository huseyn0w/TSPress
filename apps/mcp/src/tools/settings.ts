import { themeSettingSchema, updateThemeSettingSchema } from '@cmstack-ts/config';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ApiClient } from '../api-client.js';
import { READ, UPDATE, respond } from '../tool-kit.js';

/**
 * Settings tools. The active public theme is gated by the `Setting` CASL
 * subject (Administrator only). The stored theme id is a slug; the web resolver
 * falls back to the default for any unknown value.
 */
export function registerSettingsTools(server: McpServer, client: ApiClient): void {
  server.registerTool(
    'cmstack_ts_get_active_theme',
    {
      title: 'Get the active theme',
      description:
        'Get the active public theme id (the `activeTheme` setting). Returns { activeTheme }.',
      inputSchema: z.object({}),
      annotations: READ,
    },
    () => respond(() => client.request('GET', '/settings/theme', { schema: themeSettingSchema })),
  );

  server.registerTool(
    'cmstack_ts_set_active_theme',
    {
      title: 'Set the active theme',
      description:
        'Set the active public theme by id (a slug, e.g. "editorial" or "magazine"). Requires Administrator. Returns the updated { activeTheme }.',
      inputSchema: updateThemeSettingSchema,
      annotations: UPDATE,
    },
    (input) =>
      respond(() =>
        client.request('PUT', '/settings/theme', { body: input, schema: themeSettingSchema }),
      ),
  );
}
