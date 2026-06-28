'use server';

import { apiGet, apiSend, apiUpload } from '@/lib/admin/api';
import type { MediaList, UpdateMediaInput } from '@cmstack-ts/config';
import { mediaListSchema } from '@cmstack-ts/config';
import { revalidatePath } from 'next/cache';

type ActionResult<T = undefined> = T extends undefined
  ? { ok: true } | { ok: false; error: string }
  : { ok: true; data: T } | { ok: false; error: string };

/**
 * List media for the in-editor picker. Runs server-side (the admin API needs the
 * session bearer token), so client components reach it through this action.
 */
export async function listMediaForPicker(page = 1, perPage = 24): Promise<ActionResult<MediaList>> {
  try {
    const query = new URLSearchParams({ page: String(page), perPage: String(perPage) });
    const data = await apiGet(`/media?${query.toString()}`, mediaListSchema);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load media' };
  }
}

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
