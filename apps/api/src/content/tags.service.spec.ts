import type { Tag, TagRepository } from '@cmstack-ts/db';
import { Prisma } from '@cmstack-ts/db';
import { NotFoundException } from '@nestjs/common';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HookRegistry } from '../plugins/hook-registry';
import { TagsService } from './tags.service';

function row(over: Partial<Tag> = {}): Tag {
  return {
    id: 't1',
    name: 'News',
    slug: 'news',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...over,
  };
}

let tags: Record<keyof TagRepository, Mock>;
let hooks: { emit: Mock };
let service: TagsService;

beforeEach(() => {
  tags = {
    create: vi.fn(),
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
  service = new TagsService(tags as unknown as TagRepository, hooks as unknown as HookRegistry);
});

describe('TagsService', () => {
  it('create derives a slug from the name and serializes dates to ISO', async () => {
    tags.findIdBySlug.mockResolvedValue(null);
    tags.create.mockResolvedValue(row());
    const result = await service.create({ name: 'News' });
    expect(tags.create).toHaveBeenCalledWith({ name: 'News', slug: 'news' });
    expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('create de-duplicates a colliding slug with a numeric suffix', async () => {
    tags.findIdBySlug.mockResolvedValueOnce({ id: 'other' }).mockResolvedValueOnce(null);
    tags.create.mockResolvedValue(row({ slug: 'news-2' }));
    await service.create({ name: 'News' });
    expect(tags.create).toHaveBeenCalledWith({ name: 'News', slug: 'news-2' });
  });

  it('update allows keeping the same slug (excludeId matches the owner)', async () => {
    tags.findById.mockResolvedValue(row());
    tags.findIdBySlug.mockResolvedValue({ id: 't1' });
    tags.update.mockResolvedValue(row({ slug: 'news' }));
    await service.update('t1', { slug: 'news' });
    expect(tags.update).toHaveBeenCalledWith('t1', { slug: 'news' });
  });

  it('update throws NotFound when the tag is absent', async () => {
    tags.findById.mockResolvedValue(null);
    await expect(service.update('missing', { name: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tags.update).not.toHaveBeenCalled();
  });

  it('remove checks existence then hard-deletes', async () => {
    tags.exists.mockResolvedValue(true);
    await service.remove('t1');
    expect(tags.hardDelete).toHaveBeenCalledWith('t1');
  });

  it('remove throws NotFound when absent', async () => {
    tags.exists.mockResolvedValue(false);
    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(tags.hardDelete).not.toHaveBeenCalled();
  });

  it('upsertTranslation stores a non-empty name and flushes the term cache', async () => {
    tags.exists.mockResolvedValue(true);
    await service.upsertTranslation('t1', 'ru', { name: 'Новости' });
    expect(tags.upsertTranslation).toHaveBeenCalledWith('t1', 'ru', { name: 'Новости' });
    expect(hooks.emit).toHaveBeenCalledWith('term.changed', { termType: 'tag', id: 't1' });
  });

  it('upsertTranslation with an empty name clears the row', async () => {
    tags.exists.mockResolvedValue(true);
    await service.upsertTranslation('t1', 'ru', {});
    expect(tags.upsertTranslation).not.toHaveBeenCalled();
    expect(tags.deleteTranslation).toHaveBeenCalledWith('t1', 'ru');
  });

  it('deleteTranslation swallows a P2025 (idempotent)', async () => {
    tags.exists.mockResolvedValue(true);
    tags.deleteTranslation.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('gone', { code: 'P2025', clientVersion: '6' }),
    );
    await expect(service.deleteTranslation('t1', 'ru')).resolves.toBeUndefined();
  });
});
