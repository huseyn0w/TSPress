import { type Category, Prisma, type PrismaClient } from '@prisma/client';
import { PrismaCrudRepository } from './crud.repository';

export type CategoryCreateData = {
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
};
export type CategoryUpdateData = {
  name?: string;
  slug?: string;
  description?: string | null;
  parentId?: string | null;
};

/** The per-locale field a term translation write defines (name only). */
export type TermTranslationData = { name?: string };

const categoryWithTranslations = { translations: true } satisfies Prisma.CategoryInclude;
export type CategoryWithTranslations = Prisma.CategoryGetPayload<{
  include: typeof categoryWithTranslations;
}>;
export type CategoryTranslationRow = CategoryWithTranslations['translations'][number];

/** Data access for the self-referential {@link Category} tree. */
export interface CategoryRepository {
  create(data: CategoryCreateData): Promise<Category>;
  /** A category with all its translation rows (admin edit prefill). */
  findById(id: string): Promise<CategoryWithTranslations | null>;
  /** All categories, each with its translation rows. */
  list(): Promise<CategoryWithTranslations[]>;
  update(id: string, data: CategoryUpdateData): Promise<Category>;
  findIdBySlug(slug: string): Promise<{ id: string } | null>;
  /** Map of id → slug for the given ids (menu item URL resolution; no N+1). */
  slugsByIds(ids: string[]): Promise<Record<string, string>>;
  /** Create or replace the category's name translation for `locale` (full-row replace). */
  upsertTranslation(id: string, locale: string, data: TermTranslationData): Promise<void>;
  /** Remove the category's translation for `locale` (no-op semantics handled by the service). */
  deleteTranslation(id: string, locale: string): Promise<void>;
  exists(id: string): Promise<boolean>;
  hardDelete(id: string): Promise<void>;
}

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');

export class PrismaCategoryRepository extends PrismaCrudRepository implements CategoryRepository {
  constructor(private readonly prisma: PrismaClient) {
    super(prisma.category);
  }

  create(data: CategoryCreateData): Promise<Category> {
    return this.prisma.category.create({ data });
  }

  findById(id: string): Promise<CategoryWithTranslations | null> {
    return this.prisma.category.findUnique({ where: { id }, include: categoryWithTranslations });
  }

  list(): Promise<CategoryWithTranslations[]> {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: categoryWithTranslations,
    });
  }

  update(id: string, data: CategoryUpdateData): Promise<Category> {
    // Scalar `parentId` (unchecked update) preserves the service's
    // `'parentId' in input` set-to-null semantics.
    return this.prisma.category.update({ where: { id }, data });
  }

  findIdBySlug(slug: string): Promise<{ id: string } | null> {
    return this.prisma.category.findUnique({ where: { slug }, select: { id: true } });
  }

  async slugsByIds(ids: string[]): Promise<Record<string, string>> {
    if (ids.length === 0) return {};
    const rows = await this.prisma.category.findMany({
      where: { id: { in: ids } },
      select: { id: true, slug: true },
    });
    return Object.fromEntries(rows.map((r) => [r.id, r.slug]));
  }

  async upsertTranslation(id: string, locale: string, data: TermTranslationData): Promise<void> {
    // Absent name becomes null so it falls back to the base at read time.
    const fields = { name: data.name ?? null };
    await this.prisma.categoryTranslation.upsert({
      where: { categoryId_locale: { categoryId: id, locale } },
      create: { categoryId: id, locale, ...fields },
      update: fields,
    });
  }

  async deleteTranslation(id: string, locale: string): Promise<void> {
    await this.prisma.categoryTranslation.delete({
      where: { categoryId_locale: { categoryId: id, locale } },
    });
  }
}
