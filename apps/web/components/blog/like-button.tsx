'use client';

import { toggleLike } from '@/app/blog/[slug]/like-actions';
import Link from 'next/link';
import { useState, useTransition } from 'react';

export function LikeButton({
  slug,
  initialLikes,
  initialLiked,
  signedIn,
}: {
  slug: string;
  initialLikes: number;
  initialLiked: boolean;
  signedIn: boolean;
}) {
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(initialLiked);
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const res = await toggleLike(slug);
      if (res.ok) {
        setLikes(res.state.likes);
        setLiked(res.state.liked);
      }
    });
  }

  const label = `${likes} ${likes === 1 ? 'like' : 'likes'}`;

  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    borderRadius: 999,
    border: '1px solid var(--line)',
    fontSize: 14,
    textDecoration: 'none',
    transition: 'border-color 150ms ease, color 150ms ease, transform 150ms ease',
  };

  if (!signedIn) {
    return (
      <Link
        href={`/signin?callbackUrl=/blog/${slug}`}
        style={{ ...base, color: 'var(--muted)' }}
        title="Sign in to like"
      >
        <span aria-hidden style={{ fontSize: 15 }}>
          ♡
        </span>
        {label}
        <span style={{ color: 'var(--line)' }}>·</span>
        <span style={{ color: 'var(--accent)' }}>Sign in to like</span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      aria-pressed={liked}
      style={{
        ...base,
        cursor: isPending ? 'default' : 'pointer',
        background: 'transparent',
        color: liked ? 'var(--accent)' : 'var(--fg)',
        borderColor: liked ? 'var(--accent)' : 'var(--line)',
        opacity: isPending ? 0.6 : 1,
        fontFamily: 'inherit',
      }}
    >
      <span aria-hidden style={{ fontSize: 15 }}>
        {liked ? '♥' : '♡'}
      </span>
      {label}
    </button>
  );
}
