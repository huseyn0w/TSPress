import type { LikeState } from '@cmstack-ts/config';
import { Prisma, type PrismaClient } from '@cmstack-ts/db';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PRISMA } from '../prisma/prisma.module';

@Injectable()
export class LikesService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  private async requirePostId(slug: string): Promise<string> {
    const post = await this.prisma.post.findFirst({
      where: { slug, status: 'PUBLISHED', deletedAt: null },
      select: { id: true },
    });
    if (!post) throw new NotFoundException('Post not found.');
    return post.id;
  }

  /** Toggle the signed-in user's like on a post; returns the new state. */
  async toggle(slug: string, userId: string): Promise<LikeState> {
    const postId = await this.requirePostId(slug);
    const where = { postId_userId: { postId, userId } };
    const existing = await this.prisma.postLike.findUnique({ where, select: { id: true } });

    try {
      if (existing) {
        await this.prisma.postLike.delete({ where });
      } else {
        await this.prisma.postLike.create({ data: { postId, userId } });
      }
    } catch (error) {
      // Concurrent toggle already created/removed the like (P2002 unique race,
      // P2025 record-not-found). The final state is recomputed below either way.
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        !['P2002', 'P2025'].includes(error.code)
      ) {
        throw error;
      }
    }

    return this.state(slug, userId);
  }

  /** Current like state for a signed-in user. */
  async state(slug: string, userId: string): Promise<LikeState> {
    const postId = await this.requirePostId(slug);
    const [likes, mine] = await Promise.all([
      this.prisma.postLike.count({ where: { postId } }),
      this.prisma.postLike.findUnique({
        where: { postId_userId: { postId, userId } },
        select: { id: true },
      }),
    ]);
    return { likes, liked: mine !== null };
  }

  /** Public like count (for visitors who aren't signed in). */
  async publicCount(slug: string): Promise<LikeState> {
    const postId = await this.requirePostId(slug);
    const likes = await this.prisma.postLike.count({ where: { postId } });
    return { likes, liked: false };
  }
}
