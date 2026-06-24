import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

const valid = {
  MCP_API_URL: 'http://localhost:4000',
  MCP_API_EMAIL: 'admin@cmstack-ts.local',
  MCP_API_PASSWORD: 'admin12345',
};

describe('loadConfig', () => {
  it('parses a valid environment', () => {
    expect(loadConfig(valid)).toEqual({
      apiUrl: 'http://localhost:4000',
      email: 'admin@cmstack-ts.local',
      password: 'admin12345',
    });
  });

  it('strips a trailing slash from the API URL', () => {
    expect(loadConfig({ ...valid, MCP_API_URL: 'http://localhost:4000/' }).apiUrl).toBe(
      'http://localhost:4000',
    );
  });

  it('throws a helpful error when MCP_API_URL is missing', () => {
    expect(() => loadConfig({ ...valid, MCP_API_URL: undefined })).toThrow(/MCP_API_URL/);
  });

  it('throws when the email is malformed', () => {
    expect(() => loadConfig({ ...valid, MCP_API_EMAIL: 'not-an-email' })).toThrow(/MCP_API_EMAIL/);
  });

  it('throws when the password is empty', () => {
    expect(() => loadConfig({ ...valid, MCP_API_PASSWORD: '' })).toThrow(/MCP_API_PASSWORD/);
  });
});
