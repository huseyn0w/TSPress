'use client';

import { useTranslations } from 'next-intl';
import type React from 'react';
import { useState } from 'react';

export function ContactForm() {
  const t = useTranslations('contact');
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setStatus('idle');
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${base}/public/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'),
          email: data.get('email'),
          subject: data.get('subject') || undefined,
          message: data.get('message'),
          company: data.get('company') || undefined,
        }),
      });
      if (!res.ok) throw new Error('failed');
      setStatus('ok');
      form.reset();
    } catch {
      setStatus('err');
    } finally {
      setPending(false);
    }
  }

  const field: React.CSSProperties = {
    width: '100%',
    padding: '0.6rem 0.75rem',
    background: 'var(--bg)',
    color: 'var(--fg)',
    border: '1px solid var(--line)',
    borderRadius: 4,
    font: 'inherit',
  };
  const label: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 560 }}
    >
      {/* Honeypot: hidden from users; bots that fill it are silently dropped server-side. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }}
      />
      <label style={label}>
        <span>{t('name')}</span>
        <input name="name" required maxLength={120} style={field} />
      </label>
      <label style={label}>
        <span>{t('email')}</span>
        <input name="email" type="email" required maxLength={200} style={field} />
      </label>
      <label style={label}>
        <span>{t('subject')}</span>
        <input name="subject" maxLength={200} style={field} />
      </label>
      <label style={label}>
        <span>{t('message')}</span>
        <textarea name="message" required maxLength={5000} rows={6} style={field} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="ts-cta"
        style={{ alignSelf: 'flex-start', padding: '0.6rem 1.25rem', cursor: 'pointer' }}
      >
        {t('send')}
      </button>
      {status === 'ok' && <p style={{ color: 'var(--fg)' }}>{t('success')}</p>}
      {status === 'err' && <p style={{ color: 'crimson' }}>{t('error')}</p>}
    </form>
  );
}
