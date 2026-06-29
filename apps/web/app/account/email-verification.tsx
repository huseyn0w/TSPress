'use client';

import { useState, useTransition } from 'react';
import { sendVerificationEmail } from './actions';

export function EmailVerification({ verified }: { verified: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (verified) {
    return (
      <p style={{ margin: 0, fontSize: 14, color: 'var(--accent)' }}>✓ Your email is verified.</p>
    );
  }

  function onSend() {
    setMessage(null);
    startTransition(async () => {
      const res = await sendVerificationEmail();
      setMessage(
        res.ok
          ? { ok: true, text: 'Verification email sent — check your inbox.' }
          : { ok: false, text: res.error },
      );
    });
  }

  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>
        Your email is not verified yet.
      </p>
      {message && (
        <p style={{ margin: 0, fontSize: 13, color: message.ok ? 'var(--accent)' : '#e06b6b' }}>
          {message.text}
        </p>
      )}
      <button
        type="button"
        onClick={onSend}
        disabled={isPending}
        style={{
          justifySelf: 'start',
          padding: '0.5rem 1rem',
          borderRadius: 999,
          border: '1px solid var(--line)',
          background: 'transparent',
          color: 'var(--fg)',
          fontSize: 14,
          cursor: isPending ? 'default' : 'pointer',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {isPending ? 'Sending…' : 'Send verification email'}
      </button>
    </div>
  );
}
