import type { RoleRepository, UserRepository } from '@cmstack-ts/db';
import { type Mock, describe, expect, it, vi } from 'vitest';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  it('returns the user and role counts from the repositories', async () => {
    const users = { count: vi.fn().mockResolvedValue(12) } as unknown as UserRepository & {
      count: Mock;
    };
    const roles = { count: vi.fn().mockResolvedValue(3) } as unknown as RoleRepository & {
      count: Mock;
    };
    const service = new AdminService(users, roles);
    expect(await service.overview()).toEqual({ users: 12, roles: 3 });
  });
});
