'use server';

import { apiSend, apiUpload } from '@/lib/admin/api';
import type { UpdateMediaInput } from '@cmstack-ts/config';
import { revalidatePath } from 'next/cache';

type ActionResult<T = undefined> = T extends undefined
  ? { ok: true } | { ok: false; error: string }
  : { ok: true; data: T } | { ok: false; error: string };

export async function uploadMedia(
  formData: FormData,
): Promise<ActionResult<{ id: string; url: string }>> {
  try {
    const result = (await apiUpload('/media', formData)) as { id: string; url: string };
    revalidatePath('/admin/media');
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Upload failed' };
  }
}

export async function updateMedia(id: string, input: UpdateMediaInput): Promise<ActionResult> {
  try {
    await apiSend('PATCH', `/media/${id}`, input);
    revalidatePath('/admin/media');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update media' };
  }
}

export async function deleteMedia(id: string): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/media/${id}`);
    revalidatePath('/admin/media');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete media' };
  }
}
