'use server';

import { apiSend } from '@/lib/admin/api';
import { type CommentStatus, moderateCommentSchema } from '@typress/config';
import { revalidatePath } from 'next/cache';

type ActionResult = { ok: true } | { ok: false; error: string };

export async function moderateComment(
  id: string,
  status: CommentStatus,
  postSlug: string,
): Promise<ActionResult> {
  const parsed = moderateCommentSchema.safeParse({ status });
  if (!parsed.success) return { ok: false, error: 'Invalid status.' };
  try {
    await apiSend('PATCH', `/comments/${id}`, parsed.data);
    revalidatePath('/admin/comments');
    // Approving/un-approving changes what the public post shows.
    revalidatePath(`/blog/${postSlug}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update comment' };
  }
}

export async function deleteComment(id: string, postSlug: string): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/comments/${id}`);
    revalidatePath('/admin/comments');
    revalidatePath(`/blog/${postSlug}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete comment' };
  }
}
