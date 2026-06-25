import type { ContactSubmission, PrismaClient } from '@prisma/client';
import { PrismaCrudRepository } from './crud.repository';

export type ContactSubmissionCreateData = {
  name: string;
  email: string;
  subject: string | null;
  message: string;
};

/** Data access for {@link ContactSubmission} (public contact form + admin inbox). */
export interface ContactSubmissionRepository {
  create(data: ContactSubmissionCreateData): Promise<ContactSubmission>;
  list(): Promise<ContactSubmission[]>;
  setHandledAt(id: string, when: Date | null): Promise<ContactSubmission>;
  exists(id: string): Promise<boolean>;
  hardDelete(id: string): Promise<void>;
}

export const CONTACT_SUBMISSION_REPOSITORY = Symbol('CONTACT_SUBMISSION_REPOSITORY');

export class PrismaContactSubmissionRepository
  extends PrismaCrudRepository
  implements ContactSubmissionRepository
{
  constructor(private readonly prisma: PrismaClient) {
    super(prisma.contactSubmission);
  }

  create(data: ContactSubmissionCreateData): Promise<ContactSubmission> {
    return this.prisma.contactSubmission.create({ data });
  }

  list(): Promise<ContactSubmission[]> {
    return this.prisma.contactSubmission.findMany({ orderBy: { createdAt: 'desc' } });
  }

  setHandledAt(id: string, when: Date | null): Promise<ContactSubmission> {
    return this.prisma.contactSubmission.update({ where: { id }, data: { handledAt: when } });
  }
}
