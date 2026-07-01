'use server';

import { apiSend } from '@/lib/admin/api';
import { type BulkSummary, summarizeBulk } from '@/lib/admin/bulk';
import { runBulk } from '@/lib/admin/run-bulk';
import type {
  CreateCategoryInput,
  TermTranslationInput,
  UpdateCategoryInput,
} from '@cmstack-ts/config';
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

/** Delete many categories by looping the single-item endpoint (CASL-gated per item). */
export async function bulkDeleteCategoriesAction(
  ids: string[],
): Promise<ActionResult<BulkSummary>> {
  if (ids.length === 0) return { ok: false, error: 'No categories selected.' };
  const results = await runBulk(ids, (id) => apiSend('DELETE', `/categories/${id}`));
  revalidatePath('/admin/categories');
  // Deleting a category removes its chip from public posts.
  revalidatePath('/', 'layout');
  return { ok: true, data: summarizeBulk(results) };
}

export async function upsertCategoryTranslationAction(
  id: string,
  locale: string,
  input: TermTranslationInput,
): Promise<ActionResult> {
  try {
    await apiSend('PUT', `/categories/${id}/translations/${locale}`, input);
    revalidatePath('/admin/categories');
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to save translation',
    };
  }
}

export async function deleteCategoryTranslationAction(
  id: string,
  locale: string,
): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/categories/${id}/translations/${locale}`);
    revalidatePath('/admin/categories');
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to clear translation',
    };
  }
}
