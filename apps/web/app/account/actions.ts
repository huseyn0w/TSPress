'use server';

import { apiBaseUrl } from '@/app/lib/api';
import { auth } from '@/auth';
import { updateAccountSchema } from '@cmstack-ts/config';
import { revalidatePath } from 'next/cache';

type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateAccount(input: unknown): Promise<ActionResult> {
  const parsed = updateAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please check your details.' };

  const session = await auth();
  if (!session?.accessToken) return { ok: false, error: 'You are not signed in.' };

  try {
    const res = await fetch(`${apiBaseUrl}/auth/me`, {
      method: 'PATCH',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify(parsed.data),
    });
    if (!res.ok) return { ok: false, error: 'Could not save your profile.' };
    revalidatePath('/account');
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not save your profile.' };
  }
}
