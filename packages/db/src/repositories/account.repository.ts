import type { Prisma, PrismaClient } from '@prisma/client';

const accountWithUserInclude = {
  user: { include: { role: { include: { permissions: true } } } },
} satisfies Prisma.AccountInclude;

export type AccountWithUserRole = Prisma.AccountGetPayload<{
  include: typeof accountWithUserInclude;
}>;

export type AccountLinkData = { provider: string; providerAccountId: string };

/** Data access for OAuth {@link Account} links. */
export interface AccountRepository {
  /** The linked account (with its user + role + permissions) for a provider id, or null. */
  findByProvider(provider: string, providerAccountId: string): Promise<AccountWithUserRole | null>;
  linkToUser(userId: string, data: AccountLinkData): Promise<void>;
}

export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');

export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByProvider(provider: string, providerAccountId: string): Promise<AccountWithUserRole | null> {
    return this.prisma.account.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      include: accountWithUserInclude,
    });
  }

  async linkToUser(userId: string, data: AccountLinkData): Promise<void> {
    await this.prisma.account.create({
      data: { userId, provider: data.provider, providerAccountId: data.providerAccountId },
    });
  }
}
