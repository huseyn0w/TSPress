import type { SearchQuery, SearchResponse, SearchResult } from '@cmstack-ts/config';
import { Prisma, type PrismaClient } from '@cmstack-ts/db';
import { Inject, Injectable } from '@nestjs/common';
import { PRISMA } from '../prisma/prisma.module';

interface SearchRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: Date | null;
}

/**
 * Postgres full-text search over published posts (title + excerpt + content).
 * Uses `websearch_to_tsquery` (tolerant of arbitrary user input) with `ts_rank`
 * ordering. Postgres-specific by design ("Postgres full-text first"); the user
 * query is always passed as a bound parameter, never interpolated.
 */
@Injectable()
export class SearchService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async search(query: SearchQuery): Promise<SearchResponse> {
    const { q, page, perPage } = query;
    const offset = (page - 1) * perPage;

    // The tsvector expression is repeated for filtering and ranking.
    const document = Prisma.sql`to_tsvector('english', coalesce("title",'') || ' ' || coalesce("excerpt",'') || ' ' || coalesce("content",''))`;
    const tsquery = Prisma.sql`websearch_to_tsquery('english', ${q})`;
    const matches = Prisma.sql`"status" = 'PUBLISHED' AND "deletedAt" IS NULL AND ${document} @@ ${tsquery}`;

    const rows = await this.prisma.$queryRaw<SearchRow[]>(Prisma.sql`
      SELECT "id", "title", "slug", "excerpt", "publishedAt"
      FROM "Post"
      WHERE ${matches}
      ORDER BY ts_rank(${document}, ${tsquery}) DESC, "publishedAt" DESC NULLS LAST
      LIMIT ${perPage} OFFSET ${offset}
    `);

    const countRows = await this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT count(*) AS count FROM "Post" WHERE ${matches}
    `);
    const total = Number(countRows[0]?.count ?? 0);

    return {
      query: q,
      items: rows.map((r) => this.toResult(r)),
      total,
      page,
      perPage,
    };
  }

  private toResult(row: SearchRow): SearchResult {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    };
  }
}
