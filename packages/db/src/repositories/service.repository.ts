import type { PrismaClient, Service } from '@prisma/client';
import { PrismaCrudRepository } from './crud.repository';

export type ServiceCreateData = { name: string; description: string; order: number };
export type ServiceUpdateData = { name?: string; description?: string; order?: number };

/** Data access for the GEO {@link Service} content type. */
export interface ServiceRepository {
  list(): Promise<Service[]>;
  create(data: ServiceCreateData): Promise<Service>;
  update(id: string, data: ServiceUpdateData): Promise<Service>;
  exists(id: string): Promise<boolean>;
  hardDelete(id: string): Promise<void>;
}

export const SERVICE_REPOSITORY = Symbol('SERVICE_REPOSITORY');

export class PrismaServiceRepository extends PrismaCrudRepository implements ServiceRepository {
  constructor(private readonly prisma: PrismaClient) {
    super(prisma.service);
  }

  list(): Promise<Service[]> {
    return this.prisma.service.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });
  }

  create(data: ServiceCreateData): Promise<Service> {
    return this.prisma.service.create({ data });
  }

  update(id: string, data: ServiceUpdateData): Promise<Service> {
    return this.prisma.service.update({ where: { id }, data });
  }
}
