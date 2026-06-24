import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ApiClient } from './api-client.js';
import { loadConfig } from './config.js';
import { registerAllTools } from './tools/index.js';

/**
 * Cmstack-TS MCP server. A thin, authenticated client of the Cmstack-TS API: it logs
 * in with a service account (MCP_API_EMAIL / MCP_API_PASSWORD) and every tool
 * call rides that bearer token, so the API re-checks CASL on each request.
 * It performs only data operations through the REST API — no filesystem, no
 * shell, no plugin/theme code execution.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const client = new ApiClient(config);

  const server = new McpServer({ name: 'cmstack-ts-mcp-server', version: '0.1.0' });

  // Diagnostic reachability probe (no API call).
  server.registerTool(
    'cmstack_ts_ping',
    {
      title: 'Ping',
      description:
        'Diagnostic tool. Returns "pong" with a timestamp to confirm the server is reachable.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => ({
      content: [{ type: 'text', text: `pong @ ${new Date().toISOString()}` }],
    }),
  );

  registerAllTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Logs go to stderr so they never corrupt the stdio JSON-RPC stream.
  console.error(`Cmstack-TS MCP server running on stdio (API: ${config.apiUrl}).`);
}

main().catch((error: unknown) => {
  console.error(
    'Cmstack-TS MCP server failed to start:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
