import type { Category, PrismaClient } from '@prisma/client';
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

/** Data access for the self-referential {@link Category} tree. */
export interface CategoryRepository {
  create(data: CategoryCreateData): Promise<Category>;
  findById(id: string): Promise<Category | null>;
  list(): Promise<Category[]>;
  update(id: string, data: CategoryUpdateData): Promise<Category>;
  findIdBySlug(slug: string): Promise<{ id: string } | null>;
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

  findById(id: string): Promise<Category | null> {
    return this.prisma.category.findUnique({ where: { id } });
  }

  list(): Promise<Category[]> {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  update(id: string, data: CategoryUpdateData): Promise<Category> {
    // Scalar `parentId` (unchecked update) preserves the service's
    // `'parentId' in input` set-to-null semantics.
    return this.prisma.category.update({ where: { id }, data });
  }

  findIdBySlug(slug: string): Promise<{ id: string } | null> {
    return this.prisma.category.findUnique({ where: { slug }, select: { id: true } });
  }
}
