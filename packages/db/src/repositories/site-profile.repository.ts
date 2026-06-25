import type { Prisma, PrismaClient, SiteProfile } from '@prisma/client';

/** The singleton SiteProfile row id (a persistence detail). */
export const SITE_PROFILE_ID = 'default';

/**
 * Writable profile fields (everything except the id and managed timestamp). The
 * `customVerificationTags` Json column is typed as Prisma's input value (which,
 * unlike the read-side `JsonValue`, excludes `null`) so callers can write it.
 */
export type SiteProfileWritableData = Omit<
  SiteProfile,
  'id' | 'updatedAt' | 'customVerificationTags'
> & {
  customVerificationTags: Prisma.InputJsonValue;
};

/**
 * Data access for the singleton {@link SiteProfile}. Framework-free; returns the
 * raw row or `null` (the service substitutes its own default).
 */
export interface SiteProfileRepository {
  get(): Promise<SiteProfile | null>;
  upsert(data: SiteProfileWritableData): Promise<SiteProfile>;
}

export const SITE_PROFILE_REPOSITORY = Symbol('SITE_PROFILE_REPOSITORY');

export class PrismaSiteProfileRepository implements SiteProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  get(): Promise<SiteProfile | null> {
    return this.prisma.siteProfile.findUnique({ where: { id: SITE_PROFILE_ID } });
  }

  upsert(data: SiteProfileWritableData): Promise<SiteProfile> {
    // Asymmetric branches: create must seed the singleton id, update must not.
    return this.prisma.siteProfile.upsert({
      where: { id: SITE_PROFILE_ID },
      create: { id: SITE_PROFILE_ID, ...data },
      update: data,
    });
  }
}
