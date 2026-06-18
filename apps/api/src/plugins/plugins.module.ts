import { Logger, Module, type OnModuleInit } from '@nestjs/common';
import { enabledPlugins } from './enabled-plugins';
import { HookRegistry } from './hook-registry';

/**
 * Owns the hook registry and registers the enabled plugins once at bootstrap.
 * Exports `HookRegistry` so feature modules can drive extension points
 * (`applyFilters` / `emit`).
 */
@Module({
  providers: [HookRegistry],
  exports: [HookRegistry],
})
export class PluginsModule implements OnModuleInit {
  private readonly logger = new Logger('PluginsModule');

  constructor(private readonly registry: HookRegistry) {}

  onModuleInit(): void {
    for (const plugin of enabledPlugins) {
      plugin.register(this.registry);
      this.logger.log(`Registered plugin: ${plugin.name}`);
    }
  }
}
