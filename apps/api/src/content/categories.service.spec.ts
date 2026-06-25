import type { Category, CategoryRepository } from '@cmstack-ts/db';
import { Prisma } from '@cmstack-ts/db';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
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
let service: CategoriesService;

beforeEach(() => {
  categories = {
    create: vi.fn(),
    slugsByIds: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    findIdBySlug: vi.fn(),
    exists: vi.fn(),
    hardDelete: vi.fn(),
  };
  service = new CategoriesService(categories as unknown as CategoryRepository);
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
  it('checks existence then hard-deletes', async () => {
    categories.exists.mockResolvedValue(true);
    await service.remove('c1');
    expect(categories.hardDelete).toHaveBeenCalledWith('c1');
  });
});
