'use server';

import { apiSend } from '@/lib/admin/api';
import { revalidatePath } from 'next/cache';

type ActionResult<T = undefined> = T extends undefined
  ? { ok: true } | { ok: false; error: string }
  : { ok: true; data: T } | { ok: false; error: string };

export async function updateUserRole(id: string, roleId: string): Promise<ActionResult> {
  try {
    await apiSend('PATCH', `/users/${id}`, { roleId });
    revalidatePath('/admin/users');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update role' };
  }
}

export async function deleteUser(id: string): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/users/${id}`);
    revalidatePath('/admin/users');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete user' };
  }
}
