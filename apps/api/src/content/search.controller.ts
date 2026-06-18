import { Controller, Get, Query } from '@nestjs/common';
import { type SearchQuery, type SearchResponse, searchQuerySchema } from '@typress/config';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SearchService } from './search.service';

/** Public full-text search over published posts. */
@Controller('public/search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  run(
    @Query(new ZodValidationPipe(searchQuerySchema)) query: SearchQuery,
  ): Promise<SearchResponse> {
    return this.search.search(query);
  }
}
