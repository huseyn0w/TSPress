import type { Media, MediaRepository } from '@cmstack-ts/db';
import { NotFoundException } from '@nestjs/common';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaService, type UploadFile, extensionForMime } from './media.service';
import type { StorageDriver } from './storage';

describe('extensionForMime', () => {
  it('maps each allowed MIME type to a safe extension', () => {
    expect(extensionForMime('image/jpeg')).toBe('.jpg');
    expect(extensionForMime('image/png')).toBe('.png');
    expect(extensionForMime('image/gif')).toBe('.gif');
    expect(extensionForMime('image/webp')).toBe('.webp');
    expect(extensionForMime('application/pdf')).toBe('.pdf');
  });

  it('never derives a dangerous extension from an unknown/forged MIME type', () => {
    // A polyglot attack relies on getting a .html (or similar) extension; the
    // map returns empty for anything not explicitly allowed.
    expect(extensionForMime('text/html')).toBe('');
    expect(extensionForMime('image/svg+xml')).toBe('');
    expect(extensionForMime('application/octet-stream')).toBe('');
  });
});

function mediaRow(over: Partial<Media> = {}): Media {
  return {
    id: 'm1',
    filename: 'k.pdf',
    originalName: 'doc.pdf',
    mimeType: 'application/pdf',
    size: 10,
    width: null,
    height: null,
    alt: null,
    title: null,
    caption: null,
    url: '/uploads/k.pdf',
    uploaderId: 'u1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...over,
  };
}

let media: Record<keyof MediaRepository, Mock>;
let storage: Record<keyof StorageDriver, Mock>;
let service: MediaService;

beforeEach(() => {
  media = {
    create: vi.fn(),
    findById: vi.fn(),
    findFilename: vi.fn(),
    listAndCount: vi.fn(),
    update: vi.fn(),
    exists: vi.fn(),
    hardDelete: vi.fn(),
  };
  storage = { save: vi.fn(), delete: vi.fn(), pathFor: vi.fn(), root: vi.fn() };
  service = new MediaService(
    media as unknown as MediaRepository,
    storage as unknown as StorageDriver,
  );
});

const pdf: UploadFile = {
  originalname: 'doc.pdf',
  mimetype: 'application/pdf',
  size: 10,
  buffer: Buffer.from('%PDF-1.4 hello'),
};

/** Invocation order of a mock's first call (1-based; 0 if never called). */
const order = (m: Mock): number => m.mock.invocationCallOrder[0] ?? 0;
/** First argument of a mock's first call. */
const firstArg = (m: Mock): string => m.mock.calls[0]?.[0] as string;

describe('MediaService.upload', () => {
  it('saves the file to storage BEFORE writing the row, with a MIME-derived key', async () => {
    media.create.mockResolvedValue(mediaRow());
    await service.upload(pdf, 'u1');

    expect(storage.save).toHaveBeenCalledTimes(1);
    expect(media.create).toHaveBeenCalledTimes(1);
    expect(order(storage.save)).toBeLessThan(order(media.create));

    const key = firstArg(storage.save);
    expect(key.endsWith('.pdf')).toBe(true);
    expect(media.create).toHaveBeenCalledWith(
      expect.objectContaining({ filename: key, url: `/uploads/${key}`, uploaderId: 'u1' }),
    );
  });

  it('rolls back the stored file (delete with the same key) when the row write fails', async () => {
    media.create.mockRejectedValue(new Error('db down'));
    await expect(service.upload(pdf, 'u1')).rejects.toThrow('db down');

    expect(storage.delete).toHaveBeenCalledWith(firstArg(storage.save));
  });
});

describe('MediaService.remove', () => {
  it('deletes the stored file BEFORE the row, using the looked-up filename', async () => {
    media.findFilename.mockResolvedValue({ filename: 'stored.png' });
    await service.remove('m1');

    expect(storage.delete).toHaveBeenCalledWith('stored.png');
    expect(media.hardDelete).toHaveBeenCalledWith('m1');
    expect(order(storage.delete)).toBeLessThan(order(media.hardDelete));
  });

  it('throws NotFound and touches neither storage nor the row when absent', async () => {
    media.findFilename.mockResolvedValue(null);
    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.delete).not.toHaveBeenCalled();
    expect(media.hardDelete).not.toHaveBeenCalled();
  });
});

describe('MediaService.update', () => {
  it('checks existence then updates only the provided metadata fields', async () => {
    media.exists.mockResolvedValue(true);
    media.update.mockResolvedValue(mediaRow({ alt: 'pic' }));
    await service.update('m1', { alt: 'pic' });
    expect(media.update).toHaveBeenCalledWith('m1', { alt: 'pic' });
  });

  it('throws NotFound when the media is absent', async () => {
    media.exists.mockResolvedValue(false);
    await expect(service.update('missing', { alt: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    expect(media.update).not.toHaveBeenCalled();
  });
});
