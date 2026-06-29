'use client';

import { type FormEvent, useState, useTransition } from 'react';
import { changePassword } from './actions';

export function PasswordEditor() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (newPassword !== confirm) {
      setMessage({ ok: false, text: 'The new passwords do not match.' });
      return;
    }
    startTransition(async () => {
      const res = await changePassword({ currentPassword, newPassword });
      if (res.ok) {
        setMessage({ ok: true, text: 'Password changed.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirm('');
      } else {
        setMessage({ ok: false, text: res.error });
      }
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
        <label htmlFor="pw-current" style={{ fontSize: 13, color: 'var(--muted)' }}>
          Current password
        </label>
        <input
          id="pw-current"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          style={field}
        />
      </div>
      <div style={{ display: 'grid', gap: '0.3rem' }}>
        <label htmlFor="pw-new" style={{ fontSize: 13, color: 'var(--muted)' }}>
          New password
        </label>
        <input
          id="pw-new"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="At least 8 characters"
          style={field}
        />
      </div>
      <div style={{ display: 'grid', gap: '0.3rem' }}>
        <label htmlFor="pw-confirm" style={{ fontSize: 13, color: 'var(--muted)' }}>
          Confirm new password
        </label>
        <input
          id="pw-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          style={field}
        />
      </div>
      {message && (
        <p style={{ margin: 0, fontSize: 13, color: message.ok ? 'var(--accent)' : '#e06b6b' }}>
          {message.text}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending || !currentPassword || !newPassword}
        style={{
          justifySelf: 'start',
          padding: '0.55rem 1.1rem',
          borderRadius: 999,
          border: '1px solid var(--line)',
          background: 'var(--fg)',
          color: 'var(--bg)',
          fontSize: 14,
          cursor: isPending ? 'default' : 'pointer',
          opacity: isPending || !currentPassword || !newPassword ? 0.6 : 1,
        }}
      >
        {isPending ? 'Saving…' : 'Change password'}
      </button>
    </form>
  );
}
