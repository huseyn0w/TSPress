'use server';

import { apiSend } from '@/lib/admin/api';
import { revalidatePath } from 'next/cache';

type ActionResult = { ok: true } | { ok: false; error: string };

function fail(err: unknown, fallback: string): ActionResult {
  return { ok: false, error: err instanceof Error ? err.message : fallback };
}

export async function setHandled(id: string, handled: boolean): Promise<ActionResult> {
  try {
    await apiSend('PATCH', `/contact/${id}`, { handled });
    revalidatePath('/admin/contact');
    return { ok: true };
  } catch (err) {
    return fail(err, 'Failed to update');
  }
}

export async function deleteSubmission(id: string): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/contact/${id}`);
    revalidatePath('/admin/contact');
    return { ok: true };
  } catch (err) {
    return fail(err, 'Failed to delete');
  }
}
