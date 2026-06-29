'use client';

import { useEffect, useRef, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type Status = 'pending' | 'done' | 'error';

export function VerifyEmailClient({ token }: { token: string }) {
  const [status, setStatus] = useState<Status>('pending');
  const ran = useRef(false);

  useEffect(() => {
    // Confirm exactly once (guards React 18 StrictMode double-invoke).
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/verify-email/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        setStatus(res.ok ? 'done' : 'error');
      } catch {
        setStatus('error');
      }
    })();
  }, [token]);

  if (status === 'pending') {
    return <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>Verifying your email…</p>;
  }

  if (status === 'done') {
    return (
      <p style={{ margin: 0, fontSize: 15, color: 'var(--fg)', lineHeight: 1.6 }}>
        Your email is now verified.{' '}
        <a href="/account" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          Back to your account →
        </a>
      </p>
    );
  }

  return (
    <p style={{ margin: 0, fontSize: 15, color: '#f08c8c', lineHeight: 1.6 }}>
      This verification link is invalid or has expired. Request a new one from your{' '}
      <a href="/account" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
        account page
      </a>
      .
    </p>
  );
}
