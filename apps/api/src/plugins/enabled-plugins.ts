import type { TypressPlugin } from './plugin.types';
import { readingTimePlugin } from './samples/reading-time.plugin';

/**
 * Plugins active in this build. Plugins are explicit in-repo modules (not
 * user-uploaded code); enabling one is a one-line change here. A future phase
 * can drive this list from a setting.
 */
export const enabledPlugins: TypressPlugin[] = [readingTimePlugin];
