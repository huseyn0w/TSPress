'use server';

import { apiSend } from '@/lib/admin/api';
import type { CreateTagInput, UpdateTagInput } from '@cmstack-ts/config';
import { revalidatePath } from 'next/cache';

type ActionResult<T = undefined> = T extends undefined
  ? { ok: true } | { ok: false; error: string }
  : { ok: true; data: T } | { ok: false; error: string };

export async function createTagAction(
  input: CreateTagInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const tag = (await apiSend('POST', '/tags', input)) as { id: string };
    revalidatePath('/admin/tags');
    return { ok: true, data: tag };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create tag' };
  }
}

export async function updateTagAction(id: string, input: UpdateTagInput): Promise<ActionResult> {
  try {
    await apiSend('PATCH', `/tags/${id}`, input);
    revalidatePath('/admin/tags');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update tag' };
  }
}

export async function deleteTagAction(id: string): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/tags/${id}`);
    revalidatePath('/admin/tags');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete tag' };
  }
}
