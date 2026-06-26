import { describe, expect, it, vi } from 'vitest';
import { PrismaRevisionRepository } from './revision.repository';

describe('PrismaRevisionRepository.findById', () => {
  it('looks up a revision by id', async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: 'r1', postId: 'p1' });
    const prisma = { revision: { findUnique } } as never;
    const repo = new PrismaRevisionRepository(prisma);
    const row = await repo.findById('r1');
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'r1' } });
    expect(row).toEqual({ id: 'r1', postId: 'p1' });
  });
});
