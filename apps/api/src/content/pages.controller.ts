import {
  type CreatePageInput,
  type PageDetail,
  type PageTranslationInput,
  type UpdatePageInput,
  createPageSchema,
  localeSchema,
  pageTranslationInputSchema,
  updatePageSchema,
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
import { PagesService } from './pages.service';
import type { RevisionView } from './posts.service';

@Controller('pages')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Page'))
  list(@Query('includeTrashed') includeTrashed?: string): Promise<PageDetail[]> {
    return this.pages.list({ includeTrashed: includeTrashed === 'true' });
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can('read', 'Page'))
  findOne(@Param('id') id: string): Promise<PageDetail> {
    return this.pages.findById(id);
  }

  @Get(':id/revisions')
  @CheckPolicies((ability) => ability.can('read', 'Page'))
  revisions(@Param('id') id: string): Promise<RevisionView[]> {
    return this.pages.revisions(id);
  }

  @Post(':id/revisions/:revisionId/restore')
  @CheckPolicies((ability) => ability.can('update', 'Page'))
  restoreRevision(
    @Param('id') id: string,
    @Param('revisionId') revisionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PageDetail> {
    return this.pages.restoreRevision(id, revisionId, user.id);
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Page'))
  create(
    @Body(new ZodValidationPipe(createPageSchema)) body: CreatePageInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PageDetail> {
    return this.pages.create(body, user.id);
  }

  @Patch(':id')
  @CheckPolicies((ability) => ability.can('update', 'Page'))
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePageSchema)) body: UpdatePageInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PageDetail> {
    return this.pages.update(id, body, user.id);
  }

  @Put(':id/translations/:locale')
  @CheckPolicies((ability) => ability.can('update', 'Page'))
  async upsertTranslation(
    @Param('id') id: string,
    @Param('locale', new ZodValidationPipe(localeSchema)) locale: string,
    @Body(new ZodValidationPipe(pageTranslationInputSchema)) body: PageTranslationInput,
  ): Promise<void> {
    await this.pages.upsertTranslation(id, locale, body);
  }

  @Delete(':id/translations/:locale')
  @HttpCode(204)
  @CheckPolicies((ability) => ability.can('update', 'Page'))
  async deleteTranslation(
    @Param('id') id: string,
    @Param('locale', new ZodValidationPipe(localeSchema)) locale: string,
  ): Promise<void> {
    await this.pages.deleteTranslation(id, locale);
  }

  @Delete(':id')
  @HttpCode(204)
  @CheckPolicies((ability) => ability.can('delete', 'Page'))
  async remove(@Param('id') id: string): Promise<void> {
    await this.pages.softDelete(id);
  }

  @Post(':id/restore')
  @CheckPolicies((ability) => ability.can('update', 'Page'))
  restore(@Param('id') id: string): Promise<PageDetail> {
    return this.pages.restore(id);
  }

  @Delete(':id/permanent')
  @HttpCode(204)
  @CheckPolicies((ability) => ability.can('delete', 'Page'))
  async destroy(@Param('id') id: string): Promise<void> {
    await this.pages.destroy(id);
  }
}
