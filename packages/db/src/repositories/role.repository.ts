import type { PrismaClient } from '@prisma/client';

export type RoleSummaryRow = { id: string; name: string };

/** Data access for {@link Role}. */
export interface RoleRepository {
  findIdByName(name: string): Promise<{ id: string } | null>;
  findIdById(id: string): Promise<{ id: string } | null>;
  list(): Promise<RoleSummaryRow[]>;
  count(): Promise<number>;
}

export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');

export class PrismaRoleRepository implements RoleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findIdByName(name: string): Promise<{ id: string } | null> {
    return this.prisma.role.findUnique({ where: { name }, select: { id: true } });
  }

  findIdById(id: string): Promise<{ id: string } | null> {
    return this.prisma.role.findUnique({ where: { id }, select: { id: true } });
  }

  list(): Promise<RoleSummaryRow[]> {
    return this.prisma.role.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  count(): Promise<number> {
    return this.prisma.role.count();
  }
}
