import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaContactSubmissionRepository } from './contact-submission.repository';

// biome-ignore lint/suspicious/noExplicitAny: in-test Prisma double
let p: any;
let repo: PrismaContactSubmissionRepository;

beforeEach(() => {
  p = {
    contactSubmission: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
  };
  repo = new PrismaContactSubmissionRepository(p);
});

describe('PrismaContactSubmissionRepository', () => {
  it('create persists the provided fields', async () => {
    p.contactSubmission.create.mockResolvedValue({ id: 'c1' });
    await repo.create({ name: 'Ada', email: 'a@x.test', subject: null, message: 'hi' });
    expect(p.contactSubmission.create).toHaveBeenCalledWith({
      data: { name: 'Ada', email: 'a@x.test', subject: null, message: 'hi' },
    });
  });

  it('list orders by createdAt desc', async () => {
    p.contactSubmission.findMany.mockResolvedValue([]);
    await repo.list();
    expect(p.contactSubmission.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
  });

  it('setHandledAt updates the timestamp', async () => {
    const when = new Date('2026-06-25T00:00:00.000Z');
    p.contactSubmission.update.mockResolvedValue({ id: 'c1', handledAt: when });
    await repo.setHandledAt('c1', when);
    expect(p.contactSubmission.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { handledAt: when },
    });
  });
});
