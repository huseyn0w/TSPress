import { ForbiddenException } from '@nestjs/common';
import type { PrismaClient } from '@cmstack-ts/db';
import { describe, expect, it, vi } from 'vitest';
import { UsersService } from './users.service';

function makeService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    user: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    role: { findUnique: vi.fn() },
    ...overrides,
  } as unknown as PrismaClient;
  return { service: new UsersService(prisma), prisma };
}

describe('UsersService self-protection', () => {
  it('forbids changing your own role (anti-lockout)', async () => {
    const { service } = makeService();
    await expect(service.update('me', { roleId: 'role-2' }, 'me')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows changing your own name (no role change)', async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'me' });
    (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'me',
      email: 'me@x.com',
      name: 'New Name',
      image: null,
      role: null,
      createdAt: new Date(),
    });
    const result = await service.update('me', { name: 'New Name' }, 'me');
    expect(result.name).toBe('New Name');
  });

  it('forbids deleting your own account', async () => {
    const { service } = makeService();
    await expect(service.remove('me', 'me')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
