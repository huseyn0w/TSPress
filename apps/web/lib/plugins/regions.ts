import 'server-only';

import { apiBaseUrl } from '@/app/lib/api';
import { type PluginRegions, pluginRegionsSchema } from '@cmstack-ts/config';

/** Fetch the public plugin render-regions; degrade to empty on any failure. */
export async function getPluginRegions(): Promise<PluginRegions> {
  try {
    const res = await fetch(`${apiBaseUrl}/public/plugins/regions`, { cache: 'no-store' });
    if (!res.ok) return {};
    const parsed = pluginRegionsSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}
