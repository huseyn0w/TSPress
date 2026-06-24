import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaAccountRepository } from './account.repository';
import { PrismaRoleRepository } from './role.repository';
import { PrismaUserRepository } from './user.repository';

const PERMS_INCLUDE = { role: { include: { permissions: true } } };
const SUMMARY_INCLUDE = { role: { select: { id: true, name: true } } };

describe('PrismaUserRepository', () => {
  function make() {
    const user = {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    };
    const $transaction = vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
    const prisma = { user, $transaction } as unknown as PrismaClient;
    return { repo: new PrismaUserRepository(prisma), user, $transaction };
  }

  it('uses the permissions include for auth lookups', async () => {
    const { repo, user } = make();
    user.findUnique.mockResolvedValue(null);
    await repo.findByEmailWithRole('a@b.com');
    await repo.findByIdWithRole('u1');
    expect(user.findUnique).toHaveBeenNthCalledWith(1, {
      where: { email: 'a@b.com' },
      include: PERMS_INCLUDE,
    });
    expect(user.findUnique).toHaveBeenNthCalledWith(2, {
      where: { id: 'u1' },
      include: PERMS_INCLUDE,
    });
  });

  it('uses the role SUMMARY include for admin list/get (distinct shape)', async () => {
    const { repo, user } = make();
    user.findMany.mockResolvedValue([]);
    user.count.mockResolvedValue(0);
    user.findUnique.mockResolvedValue(null);
    await repo.listAndCount({ page: 1, perPage: 10 });
    await repo.findByIdSummary('u1');
    expect(user.findMany.mock.calls[0]?.[0]?.include).toEqual(SUMMARY_INCLUDE);
    expect(user.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' }, include: SUMMARY_INCLUDE });
  });

  it('listAndCount builds a case-insensitive email/name OR search', async () => {
    const { repo, user } = make();
    user.findMany.mockResolvedValue([]);
    user.count.mockResolvedValue(0);
    await repo.listAndCount({ q: 'ada', page: 1, perPage: 10 });
    expect(user.count.mock.calls[0]?.[0]?.where).toEqual({
      OR: [
        { email: { contains: 'ada', mode: 'insensitive' } },
        { name: { contains: 'ada', mode: 'insensitive' } },
      ],
    });
  });

  it('findPublicProfile and updateProfileFields select only public fields (no email/hash)', async () => {
    const { repo, user } = make();
    user.findUnique.mockResolvedValue(null);
    user.update.mockResolvedValue({});
    await repo.findPublicProfile('u1');
    await repo.updateProfileFields('u1', { bio: 'hi' });
    const publicSelect = { id: true, name: true, image: true, bio: true };
    expect(user.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' }, select: publicSelect });
    expect(user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { bio: 'hi' },
      select: publicSelect,
    });
  });

  it('createWithRoleAndAccount stamps emailVerified and nests the account create', async () => {
    const { repo, user } = make();
    user.create.mockResolvedValue({});
    await repo.createWithRoleAndAccount({
      email: 'x@y.com',
      name: null,
      image: null,
      roleId: 'r1',
      provider: 'google',
      providerAccountId: 'g1',
    });
    const data = user.create.mock.calls[0]?.[0]?.data;
    expect(data.emailVerified).toBeInstanceOf(Date);
    expect(data.accounts).toEqual({ create: { provider: 'google', providerAccountId: 'g1' } });
  });

  it('updateAdmin only writes provided fields (scalar roleId)', async () => {
    const { repo, user } = make();
    user.update.mockResolvedValue({});
    await repo.updateAdmin('u1', { roleId: null });
    expect(user.update.mock.calls[0]?.[0]?.data).toEqual({ roleId: null });
  });
});

describe('PrismaAccountRepository', () => {
  function make() {
    const account = { findUnique: vi.fn(), create: vi.fn() };
    const prisma = { account } as unknown as PrismaClient;
    return { repo: new PrismaAccountRepository(prisma), account };
  }

  it('findByProvider uses the composite unique key and includes the user role+permissions', async () => {
    const { repo, account } = make();
    account.findUnique.mockResolvedValue(null);
    await repo.findByProvider('github', 'gh1');
    expect(account.findUnique).toHaveBeenCalledWith({
      where: { provider_providerAccountId: { provider: 'github', providerAccountId: 'gh1' } },
      include: { user: { include: { role: { include: { permissions: true } } } } },
    });
  });

  it('linkToUser creates the account row for the user', async () => {
    const { repo, account } = make();
    account.create.mockResolvedValue({});
    await repo.linkToUser('u1', { provider: 'github', providerAccountId: 'gh1' });
    expect(account.create).toHaveBeenCalledWith({
      data: { userId: 'u1', provider: 'github', providerAccountId: 'gh1' },
    });
  });
});

describe('PrismaRoleRepository', () => {
  function make() {
    const role = { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() };
    const prisma = { role } as unknown as PrismaClient;
    return { repo: new PrismaRoleRepository(prisma), role };
  }

  it('findIdByName/findIdById select only the id', async () => {
    const { repo, role } = make();
    role.findUnique.mockResolvedValue(null);
    await repo.findIdByName('Member');
    await repo.findIdById('r1');
    expect(role.findUnique).toHaveBeenNthCalledWith(1, {
      where: { name: 'Member' },
      select: { id: true },
    });
    expect(role.findUnique).toHaveBeenNthCalledWith(2, {
      where: { id: 'r1' },
      select: { id: true },
    });
  });

  it('list selects id/name ordered by name', async () => {
    const { repo, role } = make();
    role.findMany.mockResolvedValue([]);
    await repo.list();
    expect(role.findMany).toHaveBeenCalledWith({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  });
});
