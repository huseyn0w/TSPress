import type {
  AdminUser,
  AdminUserList,
  RoleSummary,
  UpdateUserInput,
  UserListQuery,
} from '@cmstack-ts/config';
import {
  ROLE_REPOSITORY,
  type RoleRepository,
  USER_REPOSITORY,
  type UserRepository,
  type UserWithRoleSummary,
} from '@cmstack-ts/db';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
  ) {}

  async list(query: UserListQuery): Promise<AdminUserList> {
    const { items, total } = await this.users.listAndCount({
      q: query.q,
      page: query.page,
      perPage: query.perPage,
    });
    return {
      items: items.map((u) => this.toAdminUser(u)),
      total,
      page: query.page,
      perPage: query.perPage,
    };
  }

  async findById(id: string): Promise<AdminUser> {
    const user = await this.users.findByIdSummary(id);
    if (!user) throw new NotFoundException('User not found.');
    return this.toAdminUser(user);
  }

  async update(id: string, input: UpdateUserInput, actingUserId: string): Promise<AdminUser> {
    // Prevent an admin from removing their own access and locking themselves out.
    if (id === actingUserId && input.roleId !== undefined) {
      throw new ForbiddenException('You cannot change your own role.');
    }
    if (!(await this.users.exists(id))) throw new NotFoundException('User not found.');

    if (typeof input.roleId === 'string') {
      const role = await this.roles.findIdById(input.roleId);
      if (!role) throw new BadRequestException('Role does not exist.');
    }

    const user = await this.users.updateAdmin(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.roleId !== undefined ? { roleId: input.roleId } : {}),
    });
    return this.toAdminUser(user);
  }

  async remove(id: string, actingUserId: string): Promise<void> {
    if (id === actingUserId) {
      throw new ForbiddenException('You cannot delete your own account.');
    }
    if (!(await this.users.exists(id))) throw new NotFoundException('User not found.');
    await this.users.hardDelete(id);
  }

  async listRoles(): Promise<RoleSummary[]> {
    return this.roles.list();
  }

  private toAdminUser(user: UserWithRoleSummary): AdminUser {
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
