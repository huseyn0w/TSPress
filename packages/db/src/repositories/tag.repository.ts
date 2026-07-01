import { Prisma, type PrismaClient, type Tag } from '@prisma/client';
import type { TermTranslationData } from './category.repository';
import { PrismaCrudRepository } from './crud.repository';

export type TagCreateData = { name: string; slug: string };
export type TagUpdateData = { name?: string; slug?: string };

const tagWithTranslations = { translations: true } satisfies Prisma.TagInclude;
export type TagWithTranslations = Prisma.TagGetPayload<{ include: typeof tagWithTranslations }>;

/** Data access for {@link Tag}. */
export interface TagRepository {
  create(data: TagCreateData): Promise<Tag>;
  /** A tag with all its translation rows (admin edit prefill). */
  findById(id: string): Promise<TagWithTranslations | null>;
  /** All tags, each with its translation rows. */
  list(): Promise<TagWithTranslations[]>;
  update(id: string, data: TagUpdateData): Promise<Tag>;
  /** Returns the id of the tag owning `slug`, or null — used for slug de-duplication. */
  findIdBySlug(slug: string): Promise<{ id: string } | null>;
  /** Create or replace the tag's name translation for `locale` (full-row replace). */
  upsertTranslation(id: string, locale: string, data: TermTranslationData): Promise<void>;
  /** Remove the tag's translation for `locale` (no-op semantics handled by the service). */
  deleteTranslation(id: string, locale: string): Promise<void>;
  exists(id: string): Promise<boolean>;
  hardDelete(id: string): Promise<void>;
}

export const TAG_REPOSITORY = Symbol('TAG_REPOSITORY');

export class PrismaTagRepository extends PrismaCrudRepository implements TagRepository {
  constructor(private readonly prisma: PrismaClient) {
    super(prisma.tag);
  }

  create(data: TagCreateData): Promise<Tag> {
    return this.prisma.tag.create({ data });
  }

  findById(id: string): Promise<TagWithTranslations | null> {
    return this.prisma.tag.findUnique({ where: { id }, include: tagWithTranslations });
  }

  list(): Promise<TagWithTranslations[]> {
    return this.prisma.tag.findMany({ orderBy: { name: 'asc' }, include: tagWithTranslations });
  }

  update(id: string, data: TagUpdateData): Promise<Tag> {
    return this.prisma.tag.update({ where: { id }, data });
  }

  findIdBySlug(slug: string): Promise<{ id: string } | null> {
    return this.prisma.tag.findUnique({ where: { slug }, select: { id: true } });
  }

  async upsertTranslation(id: string, locale: string, data: TermTranslationData): Promise<void> {
    // Absent name becomes null so it falls back to the base at read time.
    const fields = { name: data.name ?? null };
    await this.prisma.tagTranslation.upsert({
      where: { tagId_locale: { tagId: id, locale } },
      create: { tagId: id, locale, ...fields },
      update: fields,
    });
  }

  async deleteTranslation(id: string, locale: string): Promise<void> {
    await this.prisma.tagTranslation.delete({ where: { tagId_locale: { tagId: id, locale } } });
  }
}
