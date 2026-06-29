import { createHash, randomBytes } from 'node:crypto';
import type { EmailVerificationConfirmInput } from '@cmstack-ts/config';
import {
  EMAIL_VERIFICATION_TOKEN_REPOSITORY,
  type EmailVerificationTokenRepository,
  USER_REPOSITORY,
  type UserRepository,
} from '@cmstack-ts/db';
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { emailVerificationEmail } from '../mail/email-verification-email';
import { MailService } from '../mail/mail.service';

/** SHA-256 hex digest — only the hash of a token is ever persisted. */
function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Email verification: issue a single-use, expiring, hashed token to the signed-in
 * user's address, then accept it to stamp `User.emailVerified`. Mirrors the
 * password-reset flow — only the SHA-256 hash of the token is stored; the raw
 * token lives only in the emailed link.
 */
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger('EmailVerificationService');
  private readonly ttlMinutes = Number(process.env.EMAIL_VERIFICATION_TTL_MINUTES ?? 60 * 24);
  private readonly webOrigin = process.env.WEB_ORIGIN?.trim() || 'http://localhost:3000';

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(EMAIL_VERIFICATION_TOKEN_REPOSITORY)
    private readonly tokens: EmailVerificationTokenRepository,
    private readonly mail: MailService,
  ) {}

  /**
   * Email a verification link to the signed-in user. A no-op (no email) if the
   * address is already verified, so a verified user can't be spammed.
   */
  async request(userId: string): Promise<void> {
    const user = await this.users.findByIdWithRole(userId);
    if (!user || user.emailVerified !== null) return;

    // Only one active verification token per user.
    await this.tokens.deleteAllForUser(user.id);

    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.ttlMinutes * 60_000);
    await this.tokens.create({ userId: user.id, tokenHash: hashToken(rawToken), expiresAt });

    const verifyUrl = `${this.webOrigin}/verify-email?token=${rawToken}`;
    // A mail failure must not fail the request (the token is already stored and
    // can be re-requested) — log it and resolve.
    try {
      await this.mail.send({
        to: user.email,
        ...emailVerificationEmail(verifyUrl, this.ttlMinutes),
      });
    } catch (error) {
      this.logger.error('Failed to send verification email', error as Error);
    }
  }

  /** Stamp the user's email verified if the token is valid, unused, and unexpired. */
  async confirm(input: EmailVerificationConfirmInput): Promise<void> {
    const row = await this.tokens.findByHash(hashToken(input.token));
    if (!row || row.usedAt !== null || row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired verification token.');
    }

    await this.users.setEmailVerified(row.userId, new Date());
    await this.tokens.markUsed(row.id);
  }
}
