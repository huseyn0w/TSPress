import { Controller, Get, Param } from '@nestjs/common';
import type { AuthorProfile } from '@typress/config';
import { AuthorsService } from './authors.service';

/** Public author profiles (identity + their published posts). */
@Controller('public/authors')
export class PublicAuthorsController {
  constructor(private readonly authors: AuthorsService) {}

  @Get(':id')
  getProfile(@Param('id') id: string): Promise<AuthorProfile> {
    return this.authors.getProfile(id);
  }
}
