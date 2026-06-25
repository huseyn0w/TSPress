'use server';

import { apiSend } from '@/lib/admin/api';
import {
  createMenuItemSchema,
  createMenuSchema,
  menuStructureSchema,
  updateMenuItemSchema,
  updateMenuSchema,
} from '@cmstack-ts/config';
import { revalidatePath } from 'next/cache';

type ActionResult = { ok: true } | { ok: false; error: string };

function fail(err: unknown, fallback: string): ActionResult {
  return { ok: false, error: err instanceof Error ? err.message : fallback };
}

/** Revalidate the builder screen and the public layout (header/footer menus). */
function revalidateMenus(id?: string): void {
  revalidatePath('/admin/menus');
  if (id) revalidatePath(`/admin/menus/${id}`);
  revalidatePath('/', 'layout');
}

export async function createMenu(input: unknown): Promise<ActionResult> {
  const parsed = createMenuSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'A name and location are required.' };
  try {
    await apiSend('POST', '/menus', parsed.data);
    revalidateMenus();
    return { ok: true };
  } catch (err) {
    return fail(err, 'Failed to create menu');
  }
}

export async function updateMenu(id: string, input: unknown): Promise<ActionResult> {
  const parsed = updateMenuSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please check the menu fields.' };
  try {
    await apiSend('PATCH', `/menus/${id}`, parsed.data);
    revalidateMenus(id);
    return { ok: true };
  } catch (err) {
    return fail(err, 'Failed to update menu');
  }
}

export async function deleteMenu(id: string): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/menus/${id}`);
    revalidateMenus();
    return { ok: true };
  } catch (err) {
    return fail(err, 'Failed to delete menu');
  }
}

export async function createItem(menuId: string, input: unknown): Promise<ActionResult> {
  const parsed = createMenuItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please check the item fields.' };
  try {
    await apiSend('POST', `/menus/${menuId}/items`, parsed.data);
    revalidateMenus(menuId);
    return { ok: true };
  } catch (err) {
    return fail(err, 'Failed to add item');
  }
}

export async function updateItem(
  menuId: string,
  itemId: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = updateMenuItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please check the item fields.' };
  try {
    await apiSend('PATCH', `/menus/${menuId}/items/${itemId}`, parsed.data);
    revalidateMenus(menuId);
    return { ok: true };
  } catch (err) {
    return fail(err, 'Failed to update item');
  }
}

export async function deleteItem(menuId: string, itemId: string): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/menus/${menuId}/items/${itemId}`);
    revalidateMenus(menuId);
    return { ok: true };
  } catch (err) {
    return fail(err, 'Failed to delete item');
  }
}

export async function saveStructure(menuId: string, input: unknown): Promise<ActionResult> {
  const parsed = menuStructureSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid menu structure.' };
  try {
    await apiSend('PUT', `/menus/${menuId}/structure`, parsed.data);
    revalidateMenus(menuId);
    return { ok: true };
  } catch (err) {
    return fail(err, 'Failed to save order');
  }
}

export async function upsertItemTranslation(
  menuId: string,
  itemId: string,
  locale: string,
  label: string,
): Promise<ActionResult> {
  try {
    await apiSend('PUT', `/menus/${menuId}/items/${itemId}/translations/${locale}`, { label });
    revalidateMenus(menuId);
    return { ok: true };
  } catch (err) {
    return fail(err, 'Failed to save translation');
  }
}

export async function deleteItemTranslation(
  menuId: string,
  itemId: string,
  locale: string,
): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/menus/${menuId}/items/${itemId}/translations/${locale}`);
    revalidateMenus(menuId);
    return { ok: true };
  } catch (err) {
    return fail(err, 'Failed to clear translation');
  }
}
