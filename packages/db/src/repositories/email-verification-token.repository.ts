import type { Prisma, PrismaClient } from '@prisma/client';

export type EmailVerificationTokenRow = Prisma.EmailVerificationTokenGetPayload<
  Record<string, never>
>;

export type EmailVerificationTokenCreateData = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

/** Data access for {@link EmailVerificationToken} (mirrors PasswordResetToken). */
export interface EmailVerificationTokenRepository {
  create(data: EmailVerificationTokenCreateData): Promise<void>;
  /** Look a token up by its stored hash (expiry/used checks stay in the service). */
  findByHash(tokenHash: string): Promise<EmailVerificationTokenRow | null>;
  /** Mark a token consumed so it can never be replayed (single-use). */
  markUsed(id: string): Promise<void>;
  /** Clear every token for a user (called before issuing a new one). */
  deleteAllForUser(userId: string): Promise<void>;
}

export const EMAIL_VERIFICATION_TOKEN_REPOSITORY = Symbol('EMAIL_VERIFICATION_TOKEN_REPOSITORY');

export class PrismaEmailVerificationTokenRepository implements EmailVerificationTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: EmailVerificationTokenCreateData): Promise<void> {
    await this.prisma.emailVerificationToken.create({ data });
  }

  findByHash(tokenHash: string): Promise<EmailVerificationTokenRow | null> {
    return this.prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.emailVerificationToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.prisma.emailVerificationToken.deleteMany({ where: { userId } });
  }
}
