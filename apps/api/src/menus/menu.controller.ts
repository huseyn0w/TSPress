import {
  type CreateMenuInput,
  type CreateMenuItemInput,
  type MenuItemTranslationInput,
  type MenuStructureInput,
  type MenuSummary,
  type UpdateMenuInput,
  type UpdateMenuItemInput,
  createMenuItemSchema,
  createMenuSchema,
  localeSchema,
  menuItemTranslationInputSchema,
  menuStructureSchema,
  updateMenuItemSchema,
  updateMenuSchema,
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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../authz/check-policies.decorator';
import { PoliciesGuard } from '../authz/policies.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { type AdminMenu, type AdminMenuItem, MenuService } from './menu.service';

/**
 * Admin menu builder API. Gated by the `Menu` subject (Administrators via
 * manage-all, and Editors who own site structure). Bodies validated with shared
 * schemas; the public render path lives in {@link PublicMenuController}.
 */
@Controller('menus')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class MenuController {
  constructor(private readonly menus: MenuService) {}

  @Get()
  @CheckPolicies((a) => a.can('read', 'Menu'))
  list(): Promise<MenuSummary[]> {
    return this.menus.listMenus();
  }

  @Get(':id')
  @CheckPolicies((a) => a.can('read', 'Menu'))
  getMenu(@Param('id') id: string): Promise<AdminMenu> {
    return this.menus.getMenu(id);
  }

  @Post()
  @CheckPolicies((a) => a.can('create', 'Menu'))
  createMenu(
    @Body(new ZodValidationPipe(createMenuSchema)) body: CreateMenuInput,
  ): Promise<MenuSummary> {
    return this.menus.createMenu(body);
  }

  @Patch(':id')
  @CheckPolicies((a) => a.can('update', 'Menu'))
  updateMenu(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateMenuSchema)) body: UpdateMenuInput,
  ): Promise<MenuSummary> {
    return this.menus.updateMenu(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @CheckPolicies((a) => a.can('delete', 'Menu'))
  async deleteMenu(@Param('id') id: string): Promise<void> {
    await this.menus.deleteMenu(id);
  }

  @Post(':id/items')
  @CheckPolicies((a) => a.can('update', 'Menu'))
  createItem(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createMenuItemSchema)) body: CreateMenuItemInput,
  ): Promise<AdminMenuItem> {
    return this.menus.createItem(id, body);
  }

  @Patch(':id/items/:itemId')
  @CheckPolicies((a) => a.can('update', 'Menu'))
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body(new ZodValidationPipe(updateMenuItemSchema)) body: UpdateMenuItemInput,
  ): Promise<AdminMenuItem> {
    return this.menus.updateItem(id, itemId, body);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(204)
  @CheckPolicies((a) => a.can('update', 'Menu'))
  async deleteItem(@Param('id') id: string, @Param('itemId') itemId: string): Promise<void> {
    await this.menus.deleteItem(id, itemId);
  }

  @Put(':id/structure')
  @HttpCode(204)
  @CheckPolicies((a) => a.can('update', 'Menu'))
  async applyStructure(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(menuStructureSchema)) body: MenuStructureInput,
  ): Promise<void> {
    await this.menus.applyStructure(id, body);
  }

  @Put(':id/items/:itemId/translations/:locale')
  @HttpCode(204)
  @CheckPolicies((a) => a.can('update', 'Menu'))
  async upsertTranslation(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Param('locale', new ZodValidationPipe(localeSchema)) locale: string,
    @Body(new ZodValidationPipe(menuItemTranslationInputSchema)) body: MenuItemTranslationInput,
  ): Promise<void> {
    await this.menus.upsertTranslation(id, itemId, locale, body);
  }

  @Delete(':id/items/:itemId/translations/:locale')
  @HttpCode(204)
  @CheckPolicies((a) => a.can('update', 'Menu'))
  async deleteTranslation(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Param('locale', new ZodValidationPipe(localeSchema)) locale: string,
  ): Promise<void> {
    await this.menus.deleteTranslation(id, itemId, locale);
  }
}
