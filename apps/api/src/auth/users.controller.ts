import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  type AdminUser,
  type AdminUserList,
  type RoleSummary,
  type UpdateUserInput,
  type UserListQuery,
  updateUserSchema,
  userListQuerySchema,
} from '@typress/config';
import { CheckPolicies } from '../authz/check-policies.decorator';
import { PoliciesGuard } from '../authz/policies.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { AuthenticatedUser } from './authenticated-user';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'User'))
  list(
    @Query(new ZodValidationPipe(userListQuerySchema)) query: UserListQuery,
  ): Promise<AdminUserList> {
    return this.users.list(query);
  }

  // Must precede the ":id" route so "roles" is not captured as an id.
  @Get('roles')
  @CheckPolicies((ability) => ability.can('read', 'User'))
  roles(): Promise<RoleSummary[]> {
    return this.users.listRoles();
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can('read', 'User'))
  findOne(@Param('id') id: string): Promise<AdminUser> {
    return this.users.findById(id);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can('update', 'User'))
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminUser> {
    return this.users.update(id, body, user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @CheckPolicies((ability) => ability.can('delete', 'User'))
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.users.remove(id, user.id);
  }
}
