import { PrismaSettingRepository, SETTING_REPOSITORY } from '@cmstack-ts/db';
import { Module } from '@nestjs/common';
import { AccountsModule } from '../auth/accounts.module';
import { CacheModule } from '../cache/cache.module';
import { provideRepository } from '../persistence/repository.providers';
import { PluginsModule } from '../plugins/plugins.module';
import { PublicSettingsController } from './public-settings.controller';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  // AccountsModule provides the JwtAuthGuard/PoliciesGuard used to gate the admin
  // settings controller. CacheModule caches the public theme read; PluginsModule
  // provides the HookRegistry the service emits the invalidation event through.
  imports: [AccountsModule, CacheModule, PluginsModule],
  controllers: [SettingsController, PublicSettingsController],
  providers: [SettingsService, provideRepository(SETTING_REPOSITORY, PrismaSettingRepository)],
})
export class SettingsModule {}
