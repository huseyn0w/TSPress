import { PrismaSettingRepository, SETTING_REPOSITORY } from '@cmstack-ts/db';
import { Module } from '@nestjs/common';
import { AccountsModule } from '../auth/accounts.module';
import { provideRepository } from '../persistence/repository.providers';
import { PublicSettingsController } from './public-settings.controller';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  // AccountsModule provides the JwtAuthGuard/PoliciesGuard used to gate the admin
  // settings controller.
  imports: [AccountsModule],
  controllers: [SettingsController, PublicSettingsController],
  providers: [SettingsService, provideRepository(SETTING_REPOSITORY, PrismaSettingRepository)],
})
export class SettingsModule {}
