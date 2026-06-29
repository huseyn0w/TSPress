'use server';

import { apiBaseUrl } from '@/app/lib/api';
import { auth } from '@/auth';
import { changePasswordSchema, updateAccountSchema } from '@cmstack-ts/config';
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

export async function sendVerificationEmail(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.accessToken) return { ok: false, error: 'You are not signed in.' };

  try {
    const res = await fetch(`${apiBaseUrl}/auth/me/verify-email`, {
      method: 'POST',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (res.status === 202) return { ok: true };
    return { ok: false, error: 'Could not send the verification email.' };
  } catch {
    return { ok: false, error: 'Could not send the verification email.' };
  }
}

export async function changePassword(input: unknown): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'New password must be at least 8 characters.' };
  }

  const session = await auth();
  if (!session?.accessToken) return { ok: false, error: 'You are not signed in.' };

  try {
    const res = await fetch(`${apiBaseUrl}/auth/me/password`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify(parsed.data),
    });
    if (res.status === 204) return { ok: true };
    // Surface the API's reason (wrong current password, OAuth-only account, …).
    let message = 'Could not change your password.';
    try {
      const body = (await res.json()) as { message?: unknown };
      if (typeof body.message === 'string') message = body.message;
    } catch {
      // keep the default message
    }
    return { ok: false, error: message };
  } catch {
    return { ok: false, error: 'Could not change your password.' };
  }
}
