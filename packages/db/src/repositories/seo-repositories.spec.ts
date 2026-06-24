import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaFaqRepository } from './faq.repository';
import { PrismaServiceRepository } from './service.repository';
import { PrismaSiteProfileRepository, SITE_PROFILE_ID } from './site-profile.repository';

describe('PrismaSiteProfileRepository', () => {
  function make() {
    const siteProfile = { findUnique: vi.fn(), upsert: vi.fn() };
    const prisma = { siteProfile } as unknown as PrismaClient;
    return { repo: new PrismaSiteProfileRepository(prisma), siteProfile };
  }

  it('get() reads the singleton row by its fixed id', async () => {
    const { repo, siteProfile } = make();
    siteProfile.findUnique.mockResolvedValue(null);
    expect(await repo.get()).toBeNull();
    expect(siteProfile.findUnique).toHaveBeenCalledWith({ where: { id: SITE_PROFILE_ID } });
  });

  it('upsert() seeds the id on create but not on update (asymmetric branches)', async () => {
    const { repo, siteProfile } = make();
    const data = {
      organizationName: 'Acme',
      tagline: 't',
      description: 'd',
      url: '',
      logoUrl: '',
      geoStatement: 'g',
    };
    siteProfile.upsert.mockResolvedValue({ id: SITE_PROFILE_ID, ...data });
    await repo.upsert(data);
    expect(siteProfile.upsert).toHaveBeenCalledWith({
      where: { id: SITE_PROFILE_ID },
      create: { id: SITE_PROFILE_ID, ...data },
      update: data,
    });
  });
});

describe('PrismaServiceRepository', () => {
  function make() {
    const service = { findMany: vi.fn(), create: vi.fn(), update: vi.fn() };
    const prisma = { service } as unknown as PrismaClient;
    return { repo: new PrismaServiceRepository(prisma), service };
  }

  it('list() orders by order then createdAt ascending', async () => {
    const { repo, service } = make();
    service.findMany.mockResolvedValue([]);
    await repo.list();
    expect(service.findMany).toHaveBeenCalledWith({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('create() and update() pass the data through unchanged', async () => {
    const { repo, service } = make();
    service.create.mockResolvedValue({});
    service.update.mockResolvedValue({});
    await repo.create({ name: 'n', description: 'd', order: 2 });
    await repo.update('id1', { order: 5 });
    expect(service.create).toHaveBeenCalledWith({
      data: { name: 'n', description: 'd', order: 2 },
    });
    expect(service.update).toHaveBeenCalledWith({ where: { id: 'id1' }, data: { order: 5 } });
  });
});

describe('PrismaFaqRepository', () => {
  function make() {
    const faqItem = { findMany: vi.fn(), create: vi.fn(), update: vi.fn() };
    const prisma = { faqItem } as unknown as PrismaClient;
    return { repo: new PrismaFaqRepository(prisma), faqItem };
  }

  it('list() orders by order then createdAt ascending', async () => {
    const { repo, faqItem } = make();
    faqItem.findMany.mockResolvedValue([]);
    await repo.list();
    expect(faqItem.findMany).toHaveBeenCalledWith({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('create() and update() pass the data through unchanged', async () => {
    const { repo, faqItem } = make();
    faqItem.create.mockResolvedValue({});
    faqItem.update.mockResolvedValue({});
    await repo.create({ question: 'q', answer: 'a', order: 0 });
    await repo.update('id2', { question: 'q2' });
    expect(faqItem.create).toHaveBeenCalledWith({ data: { question: 'q', answer: 'a', order: 0 } });
    expect(faqItem.update).toHaveBeenCalledWith({ where: { id: 'id2' }, data: { question: 'q2' } });
  });
});
