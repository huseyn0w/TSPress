import type { MailMessage } from './mail-transport';

/** Escape the five HTML-significant characters so a URL can't break out of markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build the email-verification email. Pure (no I/O) so the copy and escaping are
 * unit-tested in isolation. The verify URL is escaped before being placed in the
 * HTML body and `href`.
 */
export function emailVerificationEmail(
  verifyUrl: string,
  ttlMinutes: number,
): Omit<MailMessage, 'to'> {
  const safeUrl = escapeHtml(verifyUrl);
  const text = [
    'Confirm your email address for your Cmstack-TS account.',
    '',
    `Open this link to verify your email (valid for ${ttlMinutes} minutes):`,
    verifyUrl,
    '',
    "If you didn't create this account, you can safely ignore this email.",
  ].join('\n');

  const html = [
    '<p>Confirm your email address for your Cmstack-TS account.</p>',
    `<p>Open this link to verify your email (valid for ${ttlMinutes} minutes):</p>`,
    `<p><a href="${safeUrl}">${safeUrl}</a></p>`,
    "<p>If you didn't create this account, you can safely ignore this email.</p>",
  ].join('\n');

  return { subject: 'Verify your Cmstack-TS email', text, html };
}
