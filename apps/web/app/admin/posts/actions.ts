'use server';

import { apiSend } from '@/lib/admin/api';
import type { CreatePostInput, UpdatePostInput } from '@cmstack-ts/config';
import { revalidatePath } from 'next/cache';

type ActionResult<T = undefined> = T extends undefined
  ? { ok: true } | { ok: false; error: string }
  : { ok: true; data: T } | { ok: false; error: string };

export async function createPostAction(
  input: CreatePostInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const post = (await apiSend('POST', '/posts', input)) as { id: string };
    revalidatePath('/admin/posts');
    return { ok: true, data: post };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create post' };
  }
}

export async function updatePostAction(id: string, input: UpdatePostInput): Promise<ActionResult> {
  try {
    await apiSend('PATCH', `/posts/${id}`, input);
    revalidatePath('/admin/posts');
    revalidatePath(`/admin/posts/${id}/edit`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update post' };
  }
}

export async function deletePostAction(id: string): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/posts/${id}`);
    revalidatePath('/admin/posts');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete post' };
  }
}

export async function restorePostAction(id: string): Promise<ActionResult> {
  try {
    await apiSend('POST', `/posts/${id}/restore`);
    revalidatePath('/admin/posts');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to restore post' };
  }
}

export async function permanentDeletePostAction(id: string): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/posts/${id}/permanent`);
    revalidatePath('/admin/posts');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to permanently delete post',
    };
  }
}

export async function togglePostStatusAction(
  id: string,
  currentStatus: string,
): Promise<ActionResult> {
  try {
    const newStatus = currentStatus === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    await apiSend('PATCH', `/posts/${id}`, { status: newStatus });
    revalidatePath('/admin/posts');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update status' };
  }
}
