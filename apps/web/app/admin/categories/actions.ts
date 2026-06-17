'use server';

import { apiSend } from '@/lib/admin/api';
import type { CreateCategoryInput, UpdateCategoryInput } from '@typress/config';
import { revalidatePath } from 'next/cache';

type ActionResult<T = undefined> = T extends undefined
  ? { ok: true } | { ok: false; error: string }
  : { ok: true; data: T } | { ok: false; error: string };

export async function createCategoryAction(
  input: CreateCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const category = (await apiSend('POST', '/categories', input)) as { id: string };
    revalidatePath('/admin/categories');
    return { ok: true, data: category };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create category' };
  }
}

export async function updateCategoryAction(
  id: string,
  input: UpdateCategoryInput,
): Promise<ActionResult> {
  try {
    await apiSend('PATCH', `/categories/${id}`, input);
    revalidatePath('/admin/categories');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update category' };
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/categories/${id}`);
    revalidatePath('/admin/categories');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete category' };
  }
}
