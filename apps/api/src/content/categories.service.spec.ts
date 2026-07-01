import type { Category, CategoryRepository } from '@cmstack-ts/db';
import { Prisma } from '@cmstack-ts/db';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HookRegistry } from '../plugins/hook-registry';
import { CategoriesService } from './categories.service';

function row(over: Partial<Category> = {}): Category {
  return {
    id: 'c1',
    name: 'Guides',
    slug: 'guides',
    description: null,
    parentId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...over,
  };
}

let categories: Record<keyof CategoryRepository, Mock>;
let hooks: { emit: Mock };
let service: CategoriesService;

beforeEach(() => {
  categories = {
    create: vi.fn(),
    slugsByIds: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    findIdBySlug: vi.fn(),
    upsertTranslation: vi.fn(),
    deleteTranslation: vi.fn(),
    exists: vi.fn(),
    hardDelete: vi.fn(),
  };
  hooks = { emit: vi.fn().mockResolvedValue(undefined) };
  service = new CategoriesService(
    categories as unknown as CategoryRepository,
    hooks as unknown as HookRegistry,
  );
});

describe('CategoriesService create', () => {
  it('rejects a non-existent parent before creating', async () => {
    categories.findIdBySlug.mockResolvedValue(null);
    categories.exists.mockResolvedValue(false);
    await expect(service.create({ name: 'Guides', parentId: 'ghost' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(categories.create).not.toHaveBeenCalled();
  });

  it('creates with null description/parent defaults', async () => {
    categories.findIdBySlug.mockResolvedValue(null);
    categories.create.mockResolvedValue(row());
    await service.create({ name: 'Guides' });
    expect(categories.create).toHaveBeenCalledWith({
      name: 'Guides',
      slug: 'guides',
      description: null,
      parentId: null,
    });
  });

  it('maps a P2025 write race to a BadRequest (invalid parent)', async () => {
    categories.findIdBySlug.mockResolvedValue(null);
    categories.exists.mockResolvedValue(true);
    categories.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('fk', { code: 'P2025', clientVersion: '6' }),
    );
    await expect(service.create({ name: 'Guides', parentId: 'p1' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('CategoriesService update', () => {
  it('throws NotFound when the category is absent', async () => {
    categories.findById.mockResolvedValue(null);
    await expect(service.update('missing', { name: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('forbids a category becoming its own parent', async () => {
    categories.findById.mockResolvedValue(row());
    await expect(service.update('c1', { parentId: 'c1' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('clears the parent when parentId is explicitly null (key present)', async () => {
    categories.findById.mockResolvedValue(row({ parentId: 'p1' }));
    categories.update.mockResolvedValue(row());
    await service.update('c1', { parentId: null });
    expect(categories.update).toHaveBeenCalledWith('c1', { parentId: null });
    // exists() must NOT be consulted for a null parent
    expect(categories.exists).not.toHaveBeenCalled();
  });
});

describe('CategoriesService remove', () => {
  it('checks existence then hard-deletes and flushes the term cache', async () => {
    categories.exists.mockResolvedValue(true);
    await service.remove('c1');
    expect(categories.hardDelete).toHaveBeenCalledWith('c1');
    expect(hooks.emit).toHaveBeenCalledWith('term.changed', { termType: 'category', id: 'c1' });
  });
});

describe('CategoriesService update emits term.changed only on a name change', () => {
  it('emits when the name changes', async () => {
    categories.findById.mockResolvedValue(row());
    categories.update.mockResolvedValue(row({ name: 'Renamed' }));
    await service.update('c1', { name: 'Renamed' });
    expect(hooks.emit).toHaveBeenCalledWith('term.changed', { termType: 'category', id: 'c1' });
  });

  it('does not emit when only the slug/description change', async () => {
    categories.findById.mockResolvedValue(row());
    categories.findIdBySlug.mockResolvedValue(null);
    categories.update.mockResolvedValue(row());
    await service.update('c1', { slug: 'new-slug' });
    expect(hooks.emit).not.toHaveBeenCalled();
  });
});

describe('CategoriesService translations', () => {
  it('upserts a non-empty name override and flushes the cache', async () => {
    categories.exists.mockResolvedValue(true);
    await service.upsertTranslation('c1', 'de', { name: 'Anleitungen' });
    expect(categories.upsertTranslation).toHaveBeenCalledWith('c1', 'de', { name: 'Anleitungen' });
    expect(hooks.emit).toHaveBeenCalledWith('term.changed', { termType: 'category', id: 'c1' });
  });

  it('an empty name clears the translation instead of storing it', async () => {
    categories.exists.mockResolvedValue(true);
    await service.upsertTranslation('c1', 'de', {});
    expect(categories.upsertTranslation).not.toHaveBeenCalled();
    expect(categories.deleteTranslation).toHaveBeenCalledWith('c1', 'de');
  });

  it('throws NotFound when the category is absent', async () => {
    categories.exists.mockResolvedValue(false);
    await expect(service.upsertTranslation('ghost', 'de', { name: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deleting an absent translation (P2025) is a no-op, not a 404', async () => {
    categories.exists.mockResolvedValue(true);
    categories.deleteTranslation.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('gone', { code: 'P2025', clientVersion: '6' }),
    );
    await expect(service.deleteTranslation('c1', 'de')).resolves.toBeUndefined();
  });
});
