import {
  ROLE_REPOSITORY,
  type RoleRepository,
  USER_REPOSITORY,
  type UserRepository,
} from '@cmstack-ts/db';
import { Inject, Injectable } from '@nestjs/common';

export interface AdminOverview {
  users: number;
  roles: number;
}

/**
 * Business logic for the admin dashboard overview. Extracted out of the
 * controller so the controller stays thin (validate/authorize -> delegate) and the
 * data access goes through repositories.
 */
@Injectable()
export class AdminService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
  ) {}

  async overview(): Promise<AdminOverview> {
    const [users, roles] = await Promise.all([this.users.count(), this.roles.count()]);
    return { users, roles };
  }
}
