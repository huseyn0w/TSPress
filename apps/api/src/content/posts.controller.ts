import {
  type CreatePostInput,
  type PostDetail,
  type PostList,
  type PostListQuery,
  type PostTranslationInput,
  type UpdatePostInput,
  createPostSchema,
  localeSchema,
  postListQuerySchema,
  postTranslationInputSchema,
  updatePostSchema,
} from '@cmstack-ts/config';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../authz/check-policies.decorator';
import { PoliciesGuard } from '../authz/policies.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PostsService, type RevisionView } from './posts.service';

/** Authoring endpoints — every mutation and read is CASL policy-gated. */
@Controller('posts')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Post'))
  list(@Query(new ZodValidationPipe(postListQuerySchema)) query: PostListQuery): Promise<PostList> {
    return this.posts.list(query, { publicOnly: false });
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can('read', 'Post'))
  findOne(@Param('id') id: string): Promise<PostDetail> {
    return this.posts.findById(id);
  }

  @Get(':id/revisions')
  @CheckPolicies((ability) => ability.can('read', 'Post'))
  revisions(@Param('id') id: string): Promise<RevisionView[]> {
    return this.posts.revisions(id);
  }

  @Post(':id/revisions/:revisionId/restore')
  @CheckPolicies((ability) => ability.can('update', 'Post'))
  restoreRevision(
    @Param('id') id: string,
    @Param('revisionId') revisionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PostDetail> {
    return this.posts.restoreRevision(id, revisionId, user.id);
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Post'))
  create(
    @Body(new ZodValidationPipe(createPostSchema)) body: CreatePostInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PostDetail> {
    return this.posts.create(body, user.id);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can('update', 'Post'))
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePostSchema)) body: UpdatePostInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PostDetail> {
    return this.posts.update(id, body, user.id);
  }

  @Put(':id/translations/:locale')
  @CheckPolicies((ability) => ability.can('update', 'Post'))
  async upsertTranslation(
    @Param('id') id: string,
    @Param('locale', new ZodValidationPipe(localeSchema)) locale: string,
    @Body(new ZodValidationPipe(postTranslationInputSchema)) body: PostTranslationInput,
  ): Promise<void> {
    await this.posts.upsertTranslation(id, locale, body);
  }

  @Delete(':id/translations/:locale')
  @HttpCode(204)
  @CheckPolicies((ability) => ability.can('update', 'Post'))
  async deleteTranslation(
    @Param('id') id: string,
    @Param('locale', new ZodValidationPipe(localeSchema)) locale: string,
  ): Promise<void> {
    await this.posts.deleteTranslation(id, locale);
  }

  @Delete(':id')
  @HttpCode(204)
  @CheckPolicies((ability) => ability.can('delete', 'Post'))
  async remove(@Param('id') id: string): Promise<void> {
    await this.posts.softDelete(id);
  }

  @Post(':id/restore')
  @CheckPolicies((ability) => ability.can('update', 'Post'))
  restore(@Param('id') id: string): Promise<PostDetail> {
    return this.posts.restore(id);
  }

  @Delete(':id/permanent')
  @HttpCode(204)
  @CheckPolicies((ability) => ability.can('delete', 'Post'))
  async destroy(@Param('id') id: string): Promise<void> {
    await this.posts.destroy(id);
  }
}
