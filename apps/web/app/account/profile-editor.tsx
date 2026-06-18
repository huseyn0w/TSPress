'use client';

import { type FormEvent, useState, useTransition } from 'react';
import { updateAccount } from './actions';

export function ProfileEditor({
  initialName,
  initialBio,
}: {
  initialName: string;
  initialBio: string;
}) {
  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await updateAccount({ name, bio });
      setMessage(res.ok ? { ok: true, text: 'Profile saved.' } : { ok: false, text: res.error });
    });
  }

  const field: React.CSSProperties = {
    width: '100%',
    padding: '0.6rem 0.7rem',
    background: 'transparent',
    border: '1px solid var(--line)',
    borderRadius: 8,
    color: 'var(--fg)',
    fontSize: 14,
    fontFamily: 'inherit',
  };

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gap: '0.3rem' }}>
        <label htmlFor="acc-name" style={{ fontSize: 13, color: 'var(--muted)' }}>
          Display name
        </label>
        <input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} style={field} />
      </div>
      <div style={{ display: 'grid', gap: '0.3rem' }}>
        <label htmlFor="acc-bio" style={{ fontSize: 13, color: 'var(--muted)' }}>
          Bio
        </label>
        <textarea
          id="acc-bio"
          rows={3}
          value={bio}
          placeholder="A short bio shown on your public author page."
          onChange={(e) => setBio(e.target.value)}
          style={{ ...field, resize: 'vertical' }}
        />
      </div>
      {message && (
        <p style={{ margin: 0, fontSize: 13, color: message.ok ? 'var(--accent)' : '#e06b6b' }}>
          {message.text}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        style={{
          justifySelf: 'start',
          padding: '0.55rem 1.1rem',
          borderRadius: 999,
          border: '1px solid var(--line)',
          background: 'var(--fg)',
          color: 'var(--bg)',
          fontSize: 14,
          cursor: isPending ? 'default' : 'pointer',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {isPending ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  );
}
