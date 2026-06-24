import type { PrismaClient, Tag } from '@prisma/client';
import { PrismaCrudRepository } from './crud.repository';

export type TagCreateData = { name: string; slug: string };
export type TagUpdateData = { name?: string; slug?: string };

/** Data access for {@link Tag}. */
export interface TagRepository {
  create(data: TagCreateData): Promise<Tag>;
  findById(id: string): Promise<Tag | null>;
  list(): Promise<Tag[]>;
  update(id: string, data: TagUpdateData): Promise<Tag>;
  /** Returns the id of the tag owning `slug`, or null — used for slug de-duplication. */
  findIdBySlug(slug: string): Promise<{ id: string } | null>;
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

  findById(id: string): Promise<Tag | null> {
    return this.prisma.tag.findUnique({ where: { id } });
  }

  list(): Promise<Tag[]> {
    return this.prisma.tag.findMany({ orderBy: { name: 'asc' } });
  }

  update(id: string, data: TagUpdateData): Promise<Tag> {
    return this.prisma.tag.update({ where: { id }, data });
  }

  findIdBySlug(slug: string): Promise<{ id: string } | null> {
    return this.prisma.tag.findUnique({ where: { slug }, select: { id: true } });
  }
}
