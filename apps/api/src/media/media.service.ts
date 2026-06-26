import { randomBytes } from 'node:crypto';
import {
  type Media,
  type MediaList,
  type MediaListQuery,
  THUMBNAIL_SIZES,
  type Thumbnail,
  type UpdateMediaInput,
  thumbnailKey,
} from '@cmstack-ts/config';
import {
  MEDIA_REPOSITORY,
  type MediaRepository,
  type MediaUpdateData,
  type Prisma,
} from '@cmstack-ts/db';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import imageSize from 'image-size';
import { IMAGE_PROCESSOR, type ImageProcessor } from './image-processor';
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
  thumbnails: unknown;
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
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly media: MediaRepository,
    @Inject(STORAGE) private readonly storage: StorageDriver,
    @Inject(IMAGE_PROCESSOR) private readonly processor: ImageProcessor,
  ) {}

  async upload(file: UploadFile, uploaderId: string): Promise<Media> {
    const dimensions = this.validateAndMeasure(file);

    const key = `${Date.now()}-${randomBytes(8).toString('hex')}${extensionForMime(file.mimetype)}`;

    await this.storage.save(key, file.buffer);

    const { thumbnails, savedKeys } = await this.generateThumbnails(file, key);

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
        thumbnails: thumbnails as unknown as Prisma.InputJsonValue,
      });
      return this.toView(media);
    } catch (error) {
      // Roll back the original and every derivative if the row could not be written.
      await this.storage.delete(key);
      await Promise.all(savedKeys.map((k) => this.storage.delete(k)));
      throw error;
    }
  }

  /**
   * Generate + store WebP derivatives for image uploads. Fault-isolated: any
   * failure leaves the original intact, cleans up partial derivatives, and
   * yields an empty set rather than failing the whole upload.
   */
  private async generateThumbnails(
    file: UploadFile,
    key: string,
  ): Promise<{ thumbnails: Thumbnail[]; savedKeys: string[] }> {
    if (!file.mimetype.startsWith('image/')) return { thumbnails: [], savedKeys: [] };

    const thumbnails: Thumbnail[] = [];
    const savedKeys: string[] = [];
    try {
      const generated = await this.processor.makeThumbnails(file.buffer, THUMBNAIL_SIZES);
      for (const t of generated) {
        const thumbKey = thumbnailKey(key, t.label);
        await this.storage.save(thumbKey, t.data);
        savedKeys.push(thumbKey);
        thumbnails.push({
          label: t.label,
          width: t.width,
          height: t.height,
          url: `/uploads/${thumbKey}`,
          size: t.data.length,
        });
      }
      return { thumbnails, savedKeys };
    } catch (error) {
      this.logger.warn(`Thumbnail generation failed for ${key}: ${error}`);
      await Promise.all(savedKeys.map((k) => this.storage.delete(k)));
      return { thumbnails: [], savedKeys: [] };
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
    for (const t of (media.thumbnails as Thumbnail[] | null) ?? []) {
      // Derive the storage key from the public url (/uploads/<key>).
      await this.storage.delete(t.url.replace(/^\/uploads\//, ''));
    }
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
        // Decompression-bomb guard: reject on header dimensions, before any decode.
        // Read just this var (not the full env) so it stays default-safe in tests.
        const maxMegapixels = Number(process.env.MEDIA_MAX_MEGAPIXELS) || 40;
        if (width * height > maxMegapixels * 1_000_000) {
          throw new BadRequestException('Image is too large to process.');
        }
        return { width, height };
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
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
      thumbnails: (media.thumbnails as Thumbnail[]) ?? [],
      createdAt: media.createdAt.toISOString(),
      updatedAt: media.updatedAt.toISOString(),
    };
  }
}
