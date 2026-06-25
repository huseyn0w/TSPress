import type { Prisma, PrismaClient } from '@prisma/client';

export type PasswordResetTokenRow = Prisma.PasswordResetTokenGetPayload<Record<string, never>>;

export type PasswordResetTokenCreateData = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

/** Data access for {@link PasswordResetToken}. */
export interface PasswordResetTokenRepository {
  create(data: PasswordResetTokenCreateData): Promise<void>;
  /** Look a token up by its stored hash (expiry/used checks stay in the service). */
  findByHash(tokenHash: string): Promise<PasswordResetTokenRow | null>;
  /** Invalidate every token for a user (called on a successful reset, and before issuing a new one). */
  deleteAllForUser(userId: string): Promise<void>;
}

export const PASSWORD_RESET_TOKEN_REPOSITORY = Symbol('PASSWORD_RESET_TOKEN_REPOSITORY');

export class PrismaPasswordResetTokenRepository implements PasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: PasswordResetTokenCreateData): Promise<void> {
    await this.prisma.passwordResetToken.create({ data });
  }

  findByHash(tokenHash: string): Promise<PasswordResetTokenRow | null> {
    return this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.deleteMany({ where: { userId } });
  }
}
