import type { Prisma, PrismaClient } from '@prisma/client';
import { PrismaCrudRepository } from './crud.repository';

// Two DISTINCT role-include shapes — never collapse them (different query cost +
// returned fields). Permissions shape feeds CASL; the summary feeds admin lists.
const userWithRoleInclude = {
  role: { include: { permissions: true } },
} satisfies Prisma.UserInclude;
export type UserWithRole = Prisma.UserGetPayload<{ include: typeof userWithRoleInclude }>;

const userWithRoleSummaryInclude = {
  role: { select: { id: true, name: true } },
} satisfies Prisma.UserInclude;
export type UserWithRoleSummary = Prisma.UserGetPayload<{
  include: typeof userWithRoleSummaryInclude;
}>;

/** Public-safe profile projection (no email/hash/role). */
export type UserPublicFields = {
  id: string;
  name: string | null;
  image: string | null;
  bio: string | null;
};

export type UserCreateData = {
  email: string;
  name: string | null;
  passwordHash: string;
  roleId: string | null;
};

export type OAuthUserCreateData = {
  email: string;
  name: string | null;
  image: string | null;
  roleId: string | null;
  provider: string;
  providerAccountId: string;
};

export type ProfileFieldsData = { name?: string; bio?: string; image?: string | null };
export type UserListFilter = { q?: string; page: number; perPage: number };
export type AdminUserUpdateData = { name?: string | null; roleId?: string | null };

/** Data access for {@link User}. */
export interface UserRepository {
  findByEmailWithRole(email: string): Promise<UserWithRole | null>;
  findByIdWithRole(id: string): Promise<UserWithRole | null>;
  findIdByEmail(email: string): Promise<{ id: string } | null>;
  createWithRole(data: UserCreateData): Promise<UserWithRole>;
  createWithRoleAndAccount(data: OAuthUserCreateData): Promise<UserWithRole>;
  updateProfileFields(id: string, data: ProfileFieldsData): Promise<UserPublicFields>;
  /** Set a new password hash (password reset). */
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
  listAndCount(filter: UserListFilter): Promise<{ items: UserWithRoleSummary[]; total: number }>;
  findByIdSummary(id: string): Promise<UserWithRoleSummary | null>;
  updateAdmin(id: string, data: AdminUserUpdateData): Promise<UserWithRoleSummary>;
  findPublicProfile(id: string): Promise<UserPublicFields | null>;
  count(): Promise<number>;
  exists(id: string): Promise<boolean>;
  hardDelete(id: string): Promise<void>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export class PrismaUserRepository extends PrismaCrudRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {
    super(prisma.user);
  }

  findByEmailWithRole(email: string): Promise<UserWithRole | null> {
    return this.prisma.user.findUnique({ where: { email }, include: userWithRoleInclude });
  }

  findByIdWithRole(id: string): Promise<UserWithRole | null> {
    return this.prisma.user.findUnique({ where: { id }, include: userWithRoleInclude });
  }

  findIdByEmail(email: string): Promise<{ id: string } | null> {
    return this.prisma.user.findUnique({ where: { email }, select: { id: true } });
  }

  createWithRole(data: UserCreateData): Promise<UserWithRole> {
    return this.prisma.user.create({ data, include: userWithRoleInclude });
  }

  createWithRoleAndAccount(data: OAuthUserCreateData): Promise<UserWithRole> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        image: data.image,
        emailVerified: new Date(),
        roleId: data.roleId,
        accounts: {
          create: { provider: data.provider, providerAccountId: data.providerAccountId },
        },
      },
      include: userWithRoleInclude,
    });
  }

  updateProfileFields(id: string, data: ProfileFieldsData): Promise<UserPublicFields> {
    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, image: true, bio: true },
    });
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  async listAndCount(filter: UserListFilter): Promise<{
    items: UserWithRoleSummary[];
    total: number;
  }> {
    const where: Prisma.UserWhereInput = filter.q
      ? {
          OR: [
            { email: { contains: filter.q, mode: 'insensitive' } },
            { name: { contains: filter.q, mode: 'insensitive' } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: userWithRoleSummaryInclude,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.perPage,
        take: filter.perPage,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total };
  }

  findByIdSummary(id: string): Promise<UserWithRoleSummary | null> {
    return this.prisma.user.findUnique({ where: { id }, include: userWithRoleSummaryInclude });
  }

  updateAdmin(id: string, data: AdminUserUpdateData): Promise<UserWithRoleSummary> {
    const prismaData: Prisma.UserUncheckedUpdateInput = {};
    if (data.name !== undefined) prismaData.name = data.name;
    if (data.roleId !== undefined) prismaData.roleId = data.roleId;
    return this.prisma.user.update({
      where: { id },
      data: prismaData,
      include: userWithRoleSummaryInclude,
    });
  }

  findPublicProfile(id: string): Promise<UserPublicFields | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, image: true, bio: true },
    });
  }

  count(): Promise<number> {
    return this.prisma.user.count();
  }
}
