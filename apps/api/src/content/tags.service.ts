import type {
  CreateTagInput,
  TermTranslation,
  TermTranslationInput,
  UpdateTagInput,
} from '@cmstack-ts/config';
import {
  Prisma,
  TAG_REPOSITORY,
  type TagRepository,
  type TagUpdateData,
  type TagWithTranslations,
} from '@cmstack-ts/db';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { HookRegistry } from '../plugins/hook-registry';
import { slugify } from './slug';

export interface TagView {
  id: string;
  name: string;
  slug: string;
  translations: TermTranslation[];
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class TagsService {
  constructor(
    @Inject(TAG_REPOSITORY) private readonly tags: TagRepository,
    private readonly hooks: HookRegistry,
  ) {}

  async create(input: CreateTagInput): Promise<TagView> {
    const slug = await this.uniqueSlug(input.slug ?? slugify(input.name));
    const tag = await this.tags.create({ name: input.name, slug });
    return this.toView(tag);
  }

  async update(id: string, input: UpdateTagInput): Promise<TagView> {
    const existing = await this.tags.findById(id);
    if (!existing) throw new NotFoundException('Tag not found.');

    const data: TagUpdateData = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.slug !== undefined) data.slug = await this.uniqueSlug(input.slug, id);

    const tag = await this.tags.update(id, data);
    if (input.name !== undefined) {
      await this.hooks.emit('term.changed', { termType: 'tag', id });
    }
    return this.toView(tag);
  }

  async list(): Promise<TagView[]> {
    const tags = await this.tags.list();
    return tags.map((t) => this.toView(t));
  }

  async findById(id: string): Promise<TagView> {
    const tag = await this.tags.findById(id);
    if (!tag) throw new NotFoundException('Tag not found.');
    return this.toView(tag);
  }

  async remove(id: string): Promise<void> {
    if (!(await this.tags.exists(id))) throw new NotFoundException('Tag not found.');
    await this.tags.hardDelete(id);
    await this.hooks.emit('term.changed', { termType: 'tag', id });
  }

  /** Create or replace a tag's name translation for a non-default locale. */
  async upsertTranslation(id: string, locale: string, input: TermTranslationInput): Promise<void> {
    if (!(await this.tags.exists(id))) throw new NotFoundException('Tag not found.');
    if (!input.name) {
      await this.deleteTranslation(id, locale);
      return;
    }
    await this.tags.upsertTranslation(id, locale, { name: input.name });
    await this.hooks.emit('term.changed', { termType: 'tag', id });
  }

  /** Remove a tag's translation for a locale (idempotent). */
  async deleteTranslation(id: string, locale: string): Promise<void> {
    if (!(await this.tags.exists(id))) throw new NotFoundException('Tag not found.');
    try {
      await this.tags.deleteTranslation(id, locale);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return;
      }
      throw error;
    }
    await this.hooks.emit('term.changed', { termType: 'tag', id });
  }

  private async uniqueSlug(desired: string, excludeId?: string): Promise<string> {
    let candidate = desired;
    let suffix = 1;
    while (true) {
      const existing = await this.tags.findIdBySlug(candidate);
      if (!existing || existing.id === excludeId) return candidate;
      suffix += 1;
      candidate = `${desired}-${suffix}`;
    }
  }

  private toView(tag: {
    id: string;
    name: string;
    slug: string;
    translations?: TagWithTranslations['translations'];
    createdAt: Date;
    updatedAt: Date;
  }): TagView {
    return {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      translations: (tag.translations ?? []).map((t) => ({ locale: t.locale, name: t.name })),
      createdAt: tag.createdAt.toISOString(),
      updatedAt: tag.updatedAt.toISOString(),
    };
  }
}
