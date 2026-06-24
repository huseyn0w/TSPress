import type { CreateTagInput, UpdateTagInput } from '@cmstack-ts/config';
import { TAG_REPOSITORY, type TagRepository, type TagUpdateData } from '@cmstack-ts/db';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { slugify } from './slug';

export interface TagView {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class TagsService {
  constructor(@Inject(TAG_REPOSITORY) private readonly tags: TagRepository) {}

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
    createdAt: Date;
    updatedAt: Date;
  }): TagView {
    return {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      createdAt: tag.createdAt.toISOString(),
      updatedAt: tag.updatedAt.toISOString(),
    };
  }
}
