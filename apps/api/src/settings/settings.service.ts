import {
  ACTIVE_THEME_KEY,
  type ThemeSetting,
  type UpdateThemeSettingInput,
} from '@cmstack-ts/config';
import { SETTING_REPOSITORY, type SettingRepository } from '@cmstack-ts/db';
import { Inject, Injectable } from '@nestjs/common';
import { CACHE_NS, cacheKey } from '../cache/cache.keys';
import { CacheService } from '../cache/cache.service';
import { HookRegistry } from '../plugins/hook-registry';

/**
 * Fallback theme when no `activeTheme` setting exists yet (e.g. a fresh DB before
 * seeding). Must match a theme id in the web theme catalogue; the web resolver
 * also falls back to its own default for any unknown value.
 */
export const DEFAULT_ACTIVE_THEME = 'editorial';

@Injectable()
export class SettingsService {
  constructor(
    @Inject(SETTING_REPOSITORY) private readonly settings: SettingRepository,
    private readonly cache: CacheService,
    private readonly hooks: HookRegistry,
  ) {}

  async getActiveTheme(): Promise<ThemeSetting> {
    return this.cache.getOrSet(cacheKey(CACHE_NS.SETTINGS, 'theme'), async () => {
      const row = await this.settings.get(ACTIVE_THEME_KEY);
      return { activeTheme: row?.value ?? DEFAULT_ACTIVE_THEME };
    });
  }

  async setActiveTheme(input: UpdateThemeSettingInput): Promise<ThemeSetting> {
    const row = await this.settings.upsert(ACTIVE_THEME_KEY, input.activeTheme);
    await this.hooks.emit('settings.theme.changed', {});
    return { activeTheme: row.value };
  }
}
