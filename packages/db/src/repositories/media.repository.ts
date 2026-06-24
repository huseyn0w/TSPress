import type { Media, PrismaClient } from '@prisma/client';
import { PrismaCrudRepository } from './crud.repository';

export type MediaCreateData = {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  url: string;
  uploaderId: string;
};

export type MediaUpdateData = {
  alt?: string | null;
  title?: string | null;
  caption?: string | null;
};

/** Data access for {@link Media}. */
export interface MediaRepository {
  create(data: MediaCreateData): Promise<Media>;
  findById(id: string): Promise<Media | null>;
  /** Returns just the stored filename (for storage cleanup on delete), or null. */
  findFilename(id: string): Promise<{ filename: string } | null>;
  listAndCount(query: { page: number; perPage: number }): Promise<{
    items: Media[];
    total: number;
  }>;
  update(id: string, data: MediaUpdateData): Promise<Media>;
  exists(id: string): Promise<boolean>;
  hardDelete(id: string): Promise<void>;
}

export const MEDIA_REPOSITORY = Symbol('MEDIA_REPOSITORY');

export class PrismaMediaRepository extends PrismaCrudRepository implements MediaRepository {
  constructor(private readonly prisma: PrismaClient) {
    super(prisma.media);
  }

  create(data: MediaCreateData): Promise<Media> {
    return this.prisma.media.create({ data });
  }

  findById(id: string): Promise<Media | null> {
    return this.prisma.media.findUnique({ where: { id } });
  }

  findFilename(id: string): Promise<{ filename: string } | null> {
    return this.prisma.media.findUnique({ where: { id }, select: { filename: true } });
  }

  async listAndCount(query: {
    page: number;
    perPage: number;
  }): Promise<{ items: Media[]; total: number }> {
    // Snapshot-consistent batch: list + unfiltered count in one transaction.
    const [items, total] = await this.prisma.$transaction([
      this.prisma.media.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.media.count(),
    ]);
    return { items, total };
  }

  update(id: string, data: MediaUpdateData): Promise<Media> {
    return this.prisma.media.update({ where: { id }, data });
  }
}
