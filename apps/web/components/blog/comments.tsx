'use client';

import { getRecaptchaToken } from '@/lib/recaptcha';
import type { CommentNode, CommentThread } from '@cmstack-ts/config';
import { type FormEvent, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium' });
}

function CommentItem({
  comment,
  depth,
  onReply,
}: {
  comment: CommentNode;
  depth: number;
  onReply: (c: CommentNode) => void;
}) {
  return (
    <li style={{ marginLeft: depth > 0 ? '1.5rem' : 0, marginTop: '1.25rem' }}>
      <div style={{ borderLeft: '2px solid var(--line)', paddingLeft: '0.9rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{comment.authorName}</span>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>
            {formatDate(comment.createdAt)}
          </span>
        </div>
        <p style={{ margin: '0.3rem 0 0.4rem', fontSize: 15, whiteSpace: 'pre-wrap' }}>
          {comment.content}
        </p>
        <button
          type="button"
          onClick={() => onReply(comment)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            fontSize: 12,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          Reply
        </button>
      </div>
      {comment.replies.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} depth={depth + 1} onReply={onReply} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Comments({ slug, initialThread }: { slug: string; initialThread: CommentThread }) {
  const [replyTo, setReplyTo] = useState<CommentNode | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const recaptchaToken = await getRecaptchaToken('comment');
      const res = await fetch(`${API_URL}/public/posts/${encodeURIComponent(slug)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: name,
          authorEmail: email,
          content,
          parentId: replyTo?.id,
          recaptchaToken,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: unknown };
        const text =
          res.status === 429
            ? 'You are commenting too fast. Please wait a moment.'
            : typeof body.message === 'string'
              ? body.message
              : 'Could not submit your comment.';
        setMessage({ ok: false, text });
        return;
      }
      setMessage({ ok: true, text: 'Thanks! Your comment is awaiting moderation.' });
      setName('');
      setEmail('');
      setContent('');
      setReplyTo(null);
    } catch {
      setMessage({ ok: false, text: 'Could not submit your comment.' });
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
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
    <section
      style={{ marginTop: '3.5rem', borderTop: '1px solid var(--line)', paddingTop: '2rem' }}
    >
      <h2 style={{ fontSize: 20, margin: '0 0 1rem' }}>
        Comments{initialThread.total > 0 ? ` (${initialThread.total})` : ''}
      </h2>

      {initialThread.items.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>
          No comments yet. Be the first to comment.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {initialThread.items.map((comment) => (
            <CommentItem key={comment.id} comment={comment} depth={0} onReply={setReplyTo} />
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} style={{ marginTop: '2.5rem', display: 'grid', gap: '0.75rem' }}>
        <h3 style={{ fontSize: 16, margin: 0 }}>
          {replyTo ? `Reply to ${replyTo.authorName}` : 'Leave a comment'}
        </h3>
        {replyTo && (
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            style={{
              justifySelf: 'start',
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              fontSize: 12,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Cancel reply
          </button>
        )}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            aria-label="Name"
            placeholder="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 180 }}
          />
          <input
            aria-label="Email"
            type="email"
            placeholder="Email (not published)"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 180 }}
          />
        </div>
        <textarea
          aria-label="Comment"
          placeholder="Your comment…"
          required
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
        {message && (
          <p style={{ fontSize: 13, color: message.ok ? 'var(--accent)' : '#e06b6b', margin: 0 }}>
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          style={{
            justifySelf: 'start',
            padding: '0.6rem 1.2rem',
            border: '1px solid var(--line)',
            borderRadius: 999,
            background: 'var(--fg)',
            color: 'var(--bg)',
            fontSize: 14,
            cursor: submitting ? 'default' : 'pointer',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'Submitting…' : 'Post comment'}
        </button>
      </form>
    </section>
  );
}
