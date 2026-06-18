import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminComment,
  AdminCommentList,
  AdminCommentListQuery,
  CommentThread,
  CreateCommentInput,
  ModerateCommentInput,
} from '@typress/config';
import { Prisma, type PrismaClient } from '@typress/db';
import { PRISMA } from '../prisma/prisma.module';
import { RecaptchaService } from '../spam/recaptcha.service';
import { buildCommentThread } from './thread';

@Injectable()
export class CommentsService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly recaptcha: RecaptchaService,
  ) {}

  /** Public submission. New comments are PENDING until an editor approves them. */
  async submit(slug: string, input: CreateCommentInput): Promise<{ status: 'PENDING' }> {
    const passed = await this.recaptcha.verify(input.recaptchaToken);
    if (!passed) {
      throw new BadRequestException('Spam check failed. Please try again.');
    }

    const post = await this.prisma.post.findFirst({
      where: { slug, status: 'PUBLISHED', deletedAt: null },
      select: { id: true },
    });
    if (!post) throw new NotFoundException('Post not found.');

    if (input.parentId) {
      // Only allow replies to an already-approved comment on the same post.
      const parent = await this.prisma.comment.findFirst({
        where: { id: input.parentId, postId: post.id, status: 'APPROVED' },
        select: { id: true },
      });
      if (!parent) throw new BadRequestException('Invalid parent comment.');
    }

    await this.prisma.comment.create({
      data: {
        postId: post.id,
        parentId: input.parentId ?? null,
        authorName: input.authorName,
        authorEmail: input.authorEmail,
        content: input.content,
        status: 'PENDING',
      },
    });

    return { status: 'PENDING' };
  }

  /** Public threaded read: only APPROVED comments for a published post. */
  async listForPost(slug: string): Promise<CommentThread> {
    const post = await this.prisma.post.findFirst({
      where: { slug, status: 'PUBLISHED', deletedAt: null },
      select: { id: true },
    });
    if (!post) throw new NotFoundException('Post not found.');

    const rows = await this.prisma.comment.findMany({
      where: { postId: post.id, status: 'APPROVED' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, parentId: true, authorName: true, content: true, createdAt: true },
    });

    const items = buildCommentThread(
      rows.map((r) => ({
        id: r.id,
        parentId: r.parentId,
        authorName: r.authorName,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
      })),
    );
    return { items, total: rows.length };
  }

  // --- Admin moderation ------------------------------------------------------

  async list(query: AdminCommentListQuery): Promise<AdminCommentList> {
    const where: Prisma.CommentWhereInput = {};
    if (query.status) where.status = query.status;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        include: { post: { select: { slug: true, title: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.comment.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.toAdmin(r)),
      total,
      page: query.page,
      perPage: query.perPage,
    };
  }

  async moderate(id: string, input: ModerateCommentInput): Promise<AdminComment> {
    await this.ensureExists(id);
    const row = await this.prisma.comment.update({
      where: { id },
      data: { status: input.status },
      include: { post: { select: { slug: true, title: true } } },
    });
    return this.toAdmin(row);
  }

  async remove(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.comment.delete({ where: { id } });
  }

  private async ensureExists(id: string): Promise<void> {
    const row = await this.prisma.comment.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException('Comment not found.');
  }

  private toAdmin(row: {
    id: string;
    parentId: string | null;
    authorName: string;
    authorEmail: string;
    content: string;
    status: AdminComment['status'];
    createdAt: Date;
    post: { slug: string; title: string };
  }): AdminComment {
    return {
      id: row.id,
      postSlug: row.post.slug,
      postTitle: row.post.title,
      parentId: row.parentId,
      authorName: row.authorName,
      authorEmail: row.authorEmail,
      content: row.content,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
