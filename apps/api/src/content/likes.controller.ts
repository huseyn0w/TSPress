import { Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { LikeState } from '@cmstack-ts/config';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LikesService } from './likes.service';

/** Post likes for signed-in users (one like per user). */
@Controller('posts/:slug/like')
@UseGuards(JwtAuthGuard)
export class LikesController {
  constructor(private readonly likes: LikesService) {}

  @Get()
  state(@Param('slug') slug: string, @CurrentUser() user: AuthenticatedUser): Promise<LikeState> {
    return this.likes.state(slug, user.id);
  }

  @Post()
  @HttpCode(200)
  toggle(@Param('slug') slug: string, @CurrentUser() user: AuthenticatedUser): Promise<LikeState> {
    return this.likes.toggle(slug, user.id);
  }
}

/** Public like count for a post (visitors who aren't signed in). */
@Controller('public/posts/:slug/likes')
export class PublicLikesController {
  constructor(private readonly likes: LikesService) {}

  @Get()
  count(@Param('slug') slug: string): Promise<LikeState> {
    return this.likes.publicCount(slug);
  }
}
