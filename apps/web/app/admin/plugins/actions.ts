'use server';

import { apiSend } from '@/lib/admin/api';
import { revalidatePath } from 'next/cache';

type ActionResult = { ok: true } | { ok: false; error: string };

export async function togglePluginAction(id: string, enabled: boolean): Promise<ActionResult> {
  try {
    await apiSend('PUT', `/plugins/${id}`, { enabled });
    revalidatePath('/admin/plugins');
    revalidatePath('/', 'layout'); // regions change the public site
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update plugin' };
  }
}
