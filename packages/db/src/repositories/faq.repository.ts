import type { FaqItem, PrismaClient } from '@prisma/client';
import { PrismaCrudRepository } from './crud.repository';

export type FaqCreateData = { question: string; answer: string; order: number };
export type FaqUpdateData = { question?: string; answer?: string; order?: number };

/** Data access for the GEO {@link FaqItem} content type. */
export interface FaqRepository {
  list(): Promise<FaqItem[]>;
  create(data: FaqCreateData): Promise<FaqItem>;
  update(id: string, data: FaqUpdateData): Promise<FaqItem>;
  exists(id: string): Promise<boolean>;
  hardDelete(id: string): Promise<void>;
}

export const FAQ_REPOSITORY = Symbol('FAQ_REPOSITORY');

export class PrismaFaqRepository extends PrismaCrudRepository implements FaqRepository {
  constructor(private readonly prisma: PrismaClient) {
    super(prisma.faqItem);
  }

  list(): Promise<FaqItem[]> {
    return this.prisma.faqItem.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });
  }

  create(data: FaqCreateData): Promise<FaqItem> {
    return this.prisma.faqItem.create({ data });
  }

  update(id: string, data: FaqUpdateData): Promise<FaqItem> {
    return this.prisma.faqItem.update({ where: { id }, data });
  }
}
