import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthorProfile } from '@typress/config';
import type { PrismaClient } from '@typress/db';
import { PRISMA } from '../prisma/prisma.module';
import { PostsService } from './posts.service';

@Injectable()
export class AuthorsService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly posts: PostsService,
  ) {}

  /** Public author profile: identity + their published posts. */
  async getProfile(id: string): Promise<AuthorProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, image: true, bio: true },
    });
    if (!user) throw new NotFoundException('Author not found.');

    const posts = await this.posts.publicByAuthor(id);
    return { id: user.id, name: user.name, image: user.image, bio: user.bio, posts };
  }
}
