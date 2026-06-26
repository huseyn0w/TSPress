import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaMediaRepository } from './media.repository';

function make() {
  const media = {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  };
  const $transaction = vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
  const prisma = { media, $transaction } as unknown as PrismaClient;
  return { repo: new PrismaMediaRepository(prisma), media, $transaction };
}

describe('PrismaMediaRepository', () => {
  it('findFilename() selects the filename and thumbnails (for storage cleanup)', async () => {
    const { repo, media } = make();
    media.findUnique.mockResolvedValue({ filename: 'a.png', thumbnails: [] });
    expect(await repo.findFilename('m1')).toEqual({ filename: 'a.png', thumbnails: [] });
    expect(media.findUnique).toHaveBeenCalledWith({
      where: { id: 'm1' },
      select: { filename: true, thumbnails: true },
    });
  });

  it('listAndCount() runs an unfiltered count + paged list in one $transaction', async () => {
    const { repo, media, $transaction } = make();
    media.findMany.mockResolvedValue([{ id: 'm1' }]);
    media.count.mockResolvedValue(7);
    const result = await repo.listAndCount({ page: 2, perPage: 10 });
    // count() takes NO where filter (lists all media)
    expect(media.count).toHaveBeenCalledWith();
    expect(media.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      skip: 10,
      take: 10,
    });
    // both queries are batched through $transaction (snapshot consistency)
    expect($transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ items: [{ id: 'm1' }], total: 7 });
  });

  it('create()/update() forward the data and return the row', async () => {
    const { repo, media } = make();
    const created = { id: 'm1' };
    media.create.mockResolvedValue(created);
    media.update.mockResolvedValue({ id: 'm1', alt: 'x' });
    const data = {
      filename: 'k',
      originalName: 'o',
      mimeType: 'image/png',
      size: 1,
      width: 2,
      height: 3,
      url: '/uploads/k',
      uploaderId: 'u1',
      thumbnails: [],
    };
    expect(await repo.create(data)).toBe(created);
    expect(media.create).toHaveBeenCalledWith({ data });
    await repo.update('m1', { alt: 'x' });
    expect(media.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { alt: 'x' } });
  });
});
