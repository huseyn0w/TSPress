import { parseEnv } from '@cmstack-ts/config';
import {
  ACCOUNT_REPOSITORY,
  PrismaAccountRepository,
  PrismaRoleRepository,
  PrismaUserRepository,
  ROLE_REPOSITORY,
  USER_REPOSITORY,
} from '@cmstack-ts/db';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from '../admin/admin.controller';
import { AdminService } from '../admin/admin.service';
import { PoliciesGuard } from '../authz/policies.guard';
import { provideRepository } from '../persistence/repository.providers';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { InternalSecretGuard } from './internal-secret.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PasswordService } from './password.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const env = parseEnv();
        return {
          secret: env.AUTH_SECRET,
          signOptions: { expiresIn: env.AUTH_TOKEN_TTL },
        };
      },
    }),
  ],
  controllers: [AccountsController, AdminController, UsersController],
  providers: [
    AccountsService,
    UsersService,
    AdminService,
    PasswordService,
    JwtAuthGuard,
    PoliciesGuard,
    InternalSecretGuard,
    provideRepository(USER_REPOSITORY, PrismaUserRepository),
    provideRepository(ACCOUNT_REPOSITORY, PrismaAccountRepository),
    provideRepository(ROLE_REPOSITORY, PrismaRoleRepository),
  ],
  // Exported so other feature modules can reuse the auth guards (which depend on
  // JwtService + AccountsService) to protect their own routes.
  exports: [JwtModule, AccountsService, JwtAuthGuard, PoliciesGuard],
})
export class AccountsModule {}
