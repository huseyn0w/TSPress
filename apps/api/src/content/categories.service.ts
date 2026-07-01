import type {
  CreateCategoryInput,
  TermTranslation,
  TermTranslationInput,
  UpdateCategoryInput,
} from '@cmstack-ts/config';
import {
  CATEGORY_REPOSITORY,
  type CategoryRepository,
  type CategoryUpdateData,
  type CategoryWithTranslations,
  Prisma,
} from '@cmstack-ts/db';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { HookRegistry } from '../plugins/hook-registry';
import { slugify } from './slug';

export interface CategoryView {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  translations: TermTranslation[];
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
    private readonly hooks: HookRegistry,
  ) {}

  async create(input: CreateCategoryInput): Promise<CategoryView> {
    const slug = await this.uniqueSlug(input.slug ?? slugify(input.name));

    if (input.parentId != null && !(await this.categories.exists(input.parentId))) {
      throw new BadRequestException('Invalid parent category.');
    }

    try {
      const category = await this.categories.create({
        name: input.name,
        slug,
        description: input.description ?? null,
        parentId: input.parentId ?? null,
      });
      return this.toView(category);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async update(id: string, input: UpdateCategoryInput): Promise<CategoryView> {
    const existing = await this.categories.findById(id);
    if (!existing) throw new NotFoundException('Category not found.');

    if (input.parentId != null) {
      if (input.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent.');
      }
      if (!(await this.categories.exists(input.parentId))) {
        throw new BadRequestException('Invalid parent category.');
      }
    }

    const data: CategoryUpdateData = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.slug !== undefined) data.slug = await this.uniqueSlug(input.slug, id);
    if (input.description !== undefined) data.description = input.description ?? null;
    if ('parentId' in input) data.parentId = input.parentId ?? null;

    try {
      const category = await this.categories.update(id, data);
      // A base-name change alters the chip shown on posts (default locale) → flush.
      if (input.name !== undefined) {
        await this.hooks.emit('term.changed', { termType: 'category', id });
      }
      return this.toView(category);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async list(): Promise<CategoryView[]> {
    const categories = await this.categories.list();
    return categories.map((c) => this.toView(c));
  }

  async findById(id: string): Promise<CategoryView> {
    const category = await this.categories.findById(id);
    if (!category) throw new NotFoundException('Category not found.');
    return this.toView(category);
  }

  async remove(id: string): Promise<void> {
    if (!(await this.categories.exists(id))) throw new NotFoundException('Category not found.');
    await this.categories.hardDelete(id);
    // The removed category's chips vanish from posts → flush.
    await this.hooks.emit('term.changed', { termType: 'category', id });
  }

  /** Create or replace a category's name translation for a non-default locale. */
  async upsertTranslation(id: string, locale: string, input: TermTranslationInput): Promise<void> {
    if (!(await this.categories.exists(id))) throw new NotFoundException('Category not found.');
    // An empty name is "no override" (falls back to the base) → clear the row.
    if (!input.name) {
      await this.deleteTranslation(id, locale);
      return;
    }
    await this.categories.upsertTranslation(id, locale, { name: input.name });
    await this.hooks.emit('term.changed', { termType: 'category', id });
  }

  /** Remove a category's translation for a locale (idempotent). */
  async deleteTranslation(id: string, locale: string): Promise<void> {
    if (!(await this.categories.exists(id))) throw new NotFoundException('Category not found.');
    try {
      await this.categories.deleteTranslation(id, locale);
    } catch (error) {
      // Deleting an absent translation is a no-op, not a 404.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return;
      }
      throw error;
    }
    await this.hooks.emit('term.changed', { termType: 'category', id });
  }

  private async uniqueSlug(desired: string, excludeId?: string): Promise<string> {
    let candidate = desired;
    let suffix = 1;
    while (true) {
      const existing = await this.categories.findIdBySlug(candidate);
      if (!existing || existing.id === excludeId) return candidate;
      suffix += 1;
      candidate = `${desired}-${suffix}`;
    }
  }

  private mapError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return new BadRequestException('Invalid parent category.');
    }
    return error instanceof Error ? error : new Error('Unknown error');
  }

  private toView(category: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    parentId: string | null;
    translations?: CategoryWithTranslations['translations'];
    createdAt: Date;
    updatedAt: Date;
  }): CategoryView {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: category.parentId,
      translations: (category.translations ?? []).map((t) => ({ locale: t.locale, name: t.name })),
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }
}
