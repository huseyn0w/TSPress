import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AdminUser,
  AdminUserList,
  RoleSummary,
  UpdateUserInput,
  UserListQuery,
} from '@cmstack-ts/config';
import { Prisma, type PrismaClient } from '@cmstack-ts/db';
import { PRISMA } from '../prisma/prisma.module';

const userInclude = { role: { select: { id: true, name: true } } } satisfies Prisma.UserInclude;
type UserWithRole = Prisma.UserGetPayload<{ include: typeof userInclude }>;

@Injectable()
export class UsersService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async list(query: UserListQuery): Promise<AdminUserList> {
    const where: Prisma.UserWhereInput = query.q
      ? {
          OR: [
            { email: { contains: query.q, mode: 'insensitive' } },
            { name: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: userInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: items.map((u) => this.toAdminUser(u)),
      total,
      page: query.page,
      perPage: query.perPage,
    };
  }

  async findById(id: string): Promise<AdminUser> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: userInclude });
    if (!user) throw new NotFoundException('User not found.');
    return this.toAdminUser(user);
  }

  async update(id: string, input: UpdateUserInput, actingUserId: string): Promise<AdminUser> {
    // Prevent an admin from removing their own access and locking themselves out.
    if (id === actingUserId && input.roleId !== undefined) {
      throw new ForbiddenException('You cannot change your own role.');
    }
    const existing = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('User not found.');

    if (typeof input.roleId === 'string') {
      const role = await this.prisma.role.findUnique({
        where: { id: input.roleId },
        select: { id: true },
      });
      if (!role) throw new BadRequestException('Role does not exist.');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.roleId !== undefined ? { roleId: input.roleId } : {}),
      },
      include: userInclude,
    });
    return this.toAdminUser(user);
  }

  async remove(id: string, actingUserId: string): Promise<void> {
    if (id === actingUserId) {
      throw new ForbiddenException('You cannot delete your own account.');
    }
    const existing = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('User not found.');
    await this.prisma.user.delete({ where: { id } });
  }

  async listRoles(): Promise<RoleSummary[]> {
    return this.prisma.role.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  private toAdminUser(user: UserWithRole): AdminUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role ? { id: user.role.id, name: user.role.name } : null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
