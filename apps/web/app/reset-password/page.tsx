import { ResetPasswordForm } from './reset-password-form';

/** Complete a password reset using the emailed `?token=`. Outside locale routing. */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = '' } = await searchParams;

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
        <h1 style={{ fontSize: 28, margin: '0 0 2rem', lineHeight: 1.1 }}>Choose a new password</h1>
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <p style={{ margin: 0, fontSize: 15, color: '#f08c8c', lineHeight: 1.6 }}>
            This reset link is missing its token. Request a new link from{' '}
            <a href="/forgot-password" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              the reset page
            </a>
            .
          </p>
        )}
      </div>
    </main>
  );
}
