import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaCategoryRepository } from './category.repository';
import { PrismaTagRepository } from './tag.repository';

describe('PrismaTagRepository', () => {
  function make() {
    const tag = { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() };
    const tagTranslation = { upsert: vi.fn(), delete: vi.fn() };
    const prisma = { tag, tagTranslation } as unknown as PrismaClient;
    return { repo: new PrismaTagRepository(prisma), tag, tagTranslation };
  }

  it('list() orders by name ascending and includes translations', async () => {
    const { repo, tag } = make();
    tag.findMany.mockResolvedValue([]);
    await repo.list();
    expect(tag.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
      include: { translations: true },
    });
  });

  it('upsertTranslation() full-row replaces name (absent → null)', async () => {
    const { repo, tagTranslation } = make();
    tagTranslation.upsert.mockResolvedValue({});
    await repo.upsertTranslation('t1', 'de', {});
    expect(tagTranslation.upsert).toHaveBeenCalledWith({
      where: { tagId_locale: { tagId: 't1', locale: 'de' } },
      create: { tagId: 't1', locale: 'de', name: null },
      update: { name: null },
    });
  });

  it('deleteTranslation() targets the composite key (never catches P2025)', async () => {
    const { repo, tagTranslation } = make();
    tagTranslation.delete.mockResolvedValue({});
    await repo.deleteTranslation('t1', 'ru');
    expect(tagTranslation.delete).toHaveBeenCalledWith({
      where: { tagId_locale: { tagId: 't1', locale: 'ru' } },
    });
  });

  it('findIdBySlug() selects only the id', async () => {
    const { repo, tag } = make();
    tag.findUnique.mockResolvedValue({ id: 't1' });
    expect(await repo.findIdBySlug('a-slug')).toEqual({ id: 't1' });
    expect(tag.findUnique).toHaveBeenCalledWith({
      where: { slug: 'a-slug' },
      select: { id: true },
    });
  });

  it('create() and update() forward the data', async () => {
    const { repo, tag } = make();
    tag.create.mockResolvedValue({});
    tag.update.mockResolvedValue({});
    await repo.create({ name: 'n', slug: 's' });
    await repo.update('t1', { name: 'n2' });
    expect(tag.create).toHaveBeenCalledWith({ data: { name: 'n', slug: 's' } });
    expect(tag.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { name: 'n2' } });
  });
});

describe('PrismaCategoryRepository', () => {
  function make() {
    const category = { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() };
    const categoryTranslation = { upsert: vi.fn(), delete: vi.fn() };
    const prisma = { category, categoryTranslation } as unknown as PrismaClient;
    return { repo: new PrismaCategoryRepository(prisma), category, categoryTranslation };
  }

  it('list() orders by name ascending and includes translations', async () => {
    const { repo, category } = make();
    category.findMany.mockResolvedValue([]);
    await repo.list();
    expect(category.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
      include: { translations: true },
    });
  });

  it('upsertTranslation() full-row replaces name (absent → null)', async () => {
    const { repo, categoryTranslation } = make();
    categoryTranslation.upsert.mockResolvedValue({});
    await repo.upsertTranslation('c1', 'de', { name: 'Anleitungen' });
    expect(categoryTranslation.upsert).toHaveBeenCalledWith({
      where: { categoryId_locale: { categoryId: 'c1', locale: 'de' } },
      create: { categoryId: 'c1', locale: 'de', name: 'Anleitungen' },
      update: { name: 'Anleitungen' },
    });
  });

  it('deleteTranslation() targets the composite key', async () => {
    const { repo, categoryTranslation } = make();
    categoryTranslation.delete.mockResolvedValue({});
    await repo.deleteTranslation('c1', 'ru');
    expect(categoryTranslation.delete).toHaveBeenCalledWith({
      where: { categoryId_locale: { categoryId: 'c1', locale: 'ru' } },
    });
  });

  it('update() forwards a scalar parentId (unchecked update shape)', async () => {
    const { repo, category } = make();
    category.update.mockResolvedValue({});
    await repo.update('c1', { parentId: null });
    expect(category.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { parentId: null } });
  });

  it('create() forwards name/slug/description/parentId', async () => {
    const { repo, category } = make();
    category.create.mockResolvedValue({});
    await repo.create({ name: 'n', slug: 's', description: null, parentId: 'p1' });
    expect(category.create).toHaveBeenCalledWith({
      data: { name: 'n', slug: 's', description: null, parentId: 'p1' },
    });
  });
});
