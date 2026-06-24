'use server';

import { apiBaseUrl } from '@/app/lib/api';
import { auth } from '@/auth';
import { type LikeState, likeStateSchema } from '@cmstack-ts/config';

const NO_LIKES: LikeState = { likes: 0, liked: false };

async function fetchLikeState(url: string, token?: string): Promise<LikeState | null> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const parsed = likeStateSchema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Initial like state for SSR: signed-in users get their `liked` flag too. */
export async function getLikeState(slug: string): Promise<{ state: LikeState; signedIn: boolean }> {
  const session = await auth();
  const token = session?.accessToken;
  const signedIn = Boolean(token);
  const publicUrl = `${apiBaseUrl}/public/posts/${encodeURIComponent(slug)}/likes`;

  if (token) {
    const authed = await fetchLikeState(
      `${apiBaseUrl}/posts/${encodeURIComponent(slug)}/like`,
      token,
    );
    if (authed) return { state: authed, signedIn: true };
  }

  // Anonymous, or the authed fetch failed (e.g. expired token): use the count.
  const count = await fetchLikeState(publicUrl);
  return { state: count ?? NO_LIKES, signedIn };
}

type ToggleResult = { ok: true; state: LikeState } | { ok: false; needsAuth: boolean };

/** Toggle the signed-in user's like. The API bearer token stays server-side. */
export async function toggleLike(slug: string): Promise<ToggleResult> {
  const session = await auth();
  if (!session?.accessToken) return { ok: false, needsAuth: true };

  try {
    const res = await fetch(`${apiBaseUrl}/posts/${encodeURIComponent(slug)}/like`, {
      method: 'POST',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (!res.ok) return { ok: false, needsAuth: res.status === 401 };
    const parsed = likeStateSchema.safeParse(await res.json());
    if (!parsed.success) return { ok: false, needsAuth: false };
    return { ok: true, state: parsed.data };
  } catch {
    return { ok: false, needsAuth: false };
  }
}
