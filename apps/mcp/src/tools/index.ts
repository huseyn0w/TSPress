import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../api-client.js';
import { registerCommentTools } from './comments.js';
import { registerContentTools } from './content.js';
import { registerMediaTools } from './media.js';
import { registerSeoTools } from './seo.js';
import { registerSettingsTools } from './settings.js';
import { registerUserTools } from './users.js';

/** Register every Cmstack-TS tool onto the MCP server. */
export function registerAllTools(server: McpServer, client: ApiClient): void {
  registerContentTools(server, client);
  registerMediaTools(server, client);
  registerCommentTools(server, client);
  registerSettingsTools(server, client);
  registerSeoTools(server, client);
  registerUserTools(server, client);
}
