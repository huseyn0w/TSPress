import { z } from 'zod';

/**
 * Configuration for the Cmstack-TS MCP server. The server is a thin, authenticated
 * client of the Cmstack-TS API: it logs in with a service account and every tool
 * call rides that account's bearer token, so the API re-checks CASL on each
 * request. Tools are only as powerful as the account's role.
 */
const envSchema = z.object({
  MCP_API_URL: z
    .string()
    .url('MCP_API_URL must be a valid URL (e.g. http://localhost:4000)')
    // Normalize away a trailing slash so path joins are predictable.
    .transform((url) => url.replace(/\/+$/, '')),
  MCP_API_EMAIL: z.string().email('MCP_API_EMAIL must be a valid email address'),
  MCP_API_PASSWORD: z.string().min(1, 'MCP_API_PASSWORD is required'),
});

export interface McpConfig {
  apiUrl: string;
  email: string;
  password: string;
}

/**
 * Parse and validate the MCP server configuration from environment variables.
 * Throws an Error with an actionable, field-level message when anything is
 * missing or malformed.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): McpConfig {
  const parsed = envSchema.safeParse({
    MCP_API_URL: env.MCP_API_URL,
    MCP_API_EMAIL: env.MCP_API_EMAIL,
    MCP_API_PASSWORD: env.MCP_API_PASSWORD,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(env)'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid Cmstack-TS MCP configuration. Set MCP_API_URL, MCP_API_EMAIL, and MCP_API_PASSWORD.\n${issues}`,
    );
  }

  return {
    apiUrl: parsed.data.MCP_API_URL,
    email: parsed.data.MCP_API_EMAIL,
    password: parsed.data.MCP_API_PASSWORD,
  };
}
