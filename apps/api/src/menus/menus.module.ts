import {
  CATEGORY_REPOSITORY,
  MENU_REPOSITORY,
  PAGE_REPOSITORY,
  POST_REPOSITORY,
  PrismaCategoryRepository,
  PrismaMenuRepository,
  PrismaPageRepository,
  PrismaPostRepository,
} from '@cmstack-ts/db';
import { Module } from '@nestjs/common';
import { AccountsModule } from '../auth/accounts.module';
import { provideRepository } from '../persistence/repository.providers';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { PublicMenuController } from './public-menu.controller';

@Module({
  // AccountsModule provides the JwtAuthGuard/PoliciesGuard used to gate the admin
  // menu controller. The Post/Page/Category repositories are bound here (own
  // bindings per module) only for slug resolution of reference menu items.
  imports: [AccountsModule],
  controllers: [MenuController, PublicMenuController],
  providers: [
    MenuService,
    provideRepository(MENU_REPOSITORY, PrismaMenuRepository),
    provideRepository(POST_REPOSITORY, PrismaPostRepository),
    provideRepository(PAGE_REPOSITORY, PrismaPageRepository),
    provideRepository(CATEGORY_REPOSITORY, PrismaCategoryRepository),
  ],
})
export class MenusModule {}
