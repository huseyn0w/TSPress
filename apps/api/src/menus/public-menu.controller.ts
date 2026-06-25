import { type PublicMenu, localeSchema } from '@cmstack-ts/config';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { MenuService } from './menu.service';

/**
 * Public, unauthenticated navigation menu for the server-rendered site. The
 * theme fetches a menu by its location and renders the resolved, localized tree.
 */
@Controller('public/menus')
export class PublicMenuController {
  constructor(private readonly menus: MenuService) {}

  @Get(':location')
  getMenu(
    @Param('location') location: string,
    @Query('locale') locale?: string,
  ): Promise<PublicMenu> {
    const parsed = localeSchema.safeParse(locale);
    return this.menus.getPublicMenu(location, parsed.success ? parsed.data : 'en');
  }
}
