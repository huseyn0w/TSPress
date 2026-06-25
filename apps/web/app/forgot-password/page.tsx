import { ForgotPasswordForm } from './forgot-password-form';

/** Request a password-reset link. Lives outside locale routing, like sign-in. */
export default function ForgotPasswordPage() {
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <p
          style={{
            margin: '0 0 0.5rem',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            fontSize: 12,
            color: 'var(--accent)',
          }}
        >
          Cmstack-TS
        </p>
        <h1 style={{ fontSize: 28, margin: '0 0 0.75rem', lineHeight: 1.1 }}>
          Reset your password
        </h1>
        <p style={{ margin: '0 0 2rem', color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
          Enter your account email and we'll send you a link to choose a new password.
        </p>
        <ForgotPasswordForm />
        <p style={{ marginTop: '1.5rem', color: 'var(--muted)', fontSize: 14 }}>
          Remembered it?{' '}
          <a href="/signin" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Back to sign in →
          </a>
        </p>
      </div>
    </main>
  );
}
