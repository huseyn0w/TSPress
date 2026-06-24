import { randomBytes } from 'node:crypto';
import type { Media, MediaList, MediaListQuery, UpdateMediaInput } from '@cmstack-ts/config';
import { MEDIA_REPOSITORY, type MediaRepository, type MediaUpdateData } from '@cmstack-ts/db';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import imageSize from 'image-size';
import { STORAGE, type StorageDriver } from './storage';

const EXT_FROM_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

/**
 * The stored-file extension, derived ONLY from the validated MIME type — never
 * from the user-supplied filename. This prevents a polyglot (e.g. a valid GIF
 * whose bytes also contain markup) being stored as `*.html` and then served as
 * text/html, which would be stored XSS.
 */
export function extensionForMime(mime: string): string {
  return EXT_FROM_MIME[mime] ?? '';
}

type MediaRow = {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  title: string | null;
  caption: string | null;
  url: string;
  createdAt: Date;
  updatedAt: Date;
};

export interface UploadFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class MediaService {
  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly media: MediaRepository,
    @Inject(STORAGE) private readonly storage: StorageDriver,
  ) {}

  async upload(file: UploadFile, uploaderId: string): Promise<Media> {
    const dimensions = this.validateAndMeasure(file);

    const key = `${Date.now()}-${randomBytes(8).toString('hex')}${extensionForMime(file.mimetype)}`;

    await this.storage.save(key, file.buffer);

    try {
      const media = await this.media.create({
        filename: key,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
        url: `/uploads/${key}`,
        uploaderId,
      });
      return this.toView(media);
    } catch (error) {
      // Roll back the stored file if the row could not be written.
      await this.storage.delete(key);
      throw error;
    }
  }

  async list(query: MediaListQuery): Promise<MediaList> {
    const { items, total } = await this.media.listAndCount({
      page: query.page,
      perPage: query.perPage,
    });
    return {
      items: items.map((m) => this.toView(m)),
      total,
      page: query.page,
      perPage: query.perPage,
    };
  }

  async findById(id: string): Promise<Media> {
    const media = await this.media.findById(id);
    if (!media) throw new NotFoundException('Media not found.');
    return this.toView(media);
  }

  async update(id: string, input: UpdateMediaInput): Promise<Media> {
    await this.ensureExists(id);
    const data: MediaUpdateData = {
      ...(input.alt !== undefined ? { alt: input.alt } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.caption !== undefined ? { caption: input.caption } : {}),
    };
    const media = await this.media.update(id, data);
    return this.toView(media);
  }

  async remove(id: string): Promise<void> {
    const media = await this.media.findFilename(id);
    if (!media) throw new NotFoundException('Media not found.');
    await this.storage.delete(media.filename);
    await this.media.hardDelete(id);
  }

  private async ensureExists(id: string): Promise<void> {
    if (!(await this.media.exists(id))) throw new NotFoundException('Media not found.');
  }

  /**
   * Validates the uploaded bytes actually match a supported type (not just the
   * client-claimed MIME) and returns image dimensions when applicable.
   */
  private validateAndMeasure(file: UploadFile): { width?: number; height?: number } | null {
    if (file.mimetype.startsWith('image/')) {
      try {
        const { width, height } = imageSize(file.buffer);
        if (!width || !height) throw new Error('no dimensions');
        return { width, height };
      } catch {
        throw new BadRequestException('Uploaded file is not a valid image.');
      }
    }
    if (file.mimetype === 'application/pdf') {
      if (!file.buffer.subarray(0, 5).toString('latin1').startsWith('%PDF-')) {
        throw new BadRequestException('Uploaded file is not a valid PDF.');
      }
      return null;
    }
    throw new BadRequestException('Unsupported file type.');
  }

  private toView(media: MediaRow): Media {
    return {
      id: media.id,
      filename: media.filename,
      originalName: media.originalName,
      mimeType: media.mimeType,
      size: media.size,
      width: media.width,
      height: media.height,
      alt: media.alt,
      title: media.title,
      caption: media.caption,
      url: media.url,
      createdAt: media.createdAt.toISOString(),
      updatedAt: media.updatedAt.toISOString(),
    };
  }
}
