import { apiGet } from '@/lib/admin/api';
import { canManageSettings, requireAdminSession } from '@/lib/admin/guard';
import { type PluginInfo, pluginInfoListSchema } from '@cmstack-ts/config';
import { redirect } from 'next/navigation';
import { PluginList } from './plugin-list';

export const dynamic = 'force-dynamic';

async function fetchPlugins(): Promise<PluginInfo[]> {
  try {
    return await apiGet('/plugins', pluginInfoListSchema);
  } catch {
    return [];
  }
}

export default async function PluginsPage() {
  const session = await requireAdminSession();
  // Plugin management is Administrator-only; Editors don't hold it.
  if (!canManageSettings(session)) {
    redirect('/admin');
  }

  const plugins = await fetchPlugins();

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Plugins</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enable or disable in-repo plugins. Changes apply immediately.
        </p>
      </div>
      <PluginList plugins={plugins} />
    </div>
  );
}
