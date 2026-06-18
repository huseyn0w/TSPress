import { Module } from '@nestjs/common';
import { AccountsModule } from '../auth/accounts.module';
import { PluginsModule } from '../plugins/plugins.module';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { HtmlSanitizerService } from './html-sanitizer.service';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { PublicContentController } from './public-content.controller';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Module({
  // AccountsModule provides the JwtAuthGuard/PoliciesGuard (and their deps) used
  // to protect the authoring controllers below. PluginsModule provides the
  // HookRegistry the post service uses to run content filters / emit events.
  imports: [AccountsModule, PluginsModule],
  controllers: [
    PostsController,
    PagesController,
    CategoriesController,
    TagsController,
    PublicContentController,
  ],
  providers: [PostsService, PagesService, CategoriesService, TagsService, HtmlSanitizerService],
})
export class ContentModule {}
