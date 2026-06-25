import { type ContactSubmissionRepository, Prisma } from '@cmstack-ts/db';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactService } from './contact.service';

let repo: Record<keyof ContactSubmissionRepository, Mock>;
let recaptcha: { verify: Mock };
let hooks: { emit: Mock };
let service: ContactService;

const row = {
  id: 'c1',
  name: 'Ada',
  email: 'a@x.test',
  subject: null,
  message: 'hi',
  handledAt: null,
  createdAt: new Date('2026-06-25T00:00:00.000Z'),
};

beforeEach(() => {
  repo = {
    create: vi.fn().mockResolvedValue(row),
    list: vi.fn(),
    setHandledAt: vi.fn(),
    exists: vi.fn(),
    hardDelete: vi.fn(),
  };
  recaptcha = { verify: vi.fn().mockResolvedValue(true) };
  hooks = { emit: vi.fn().mockResolvedValue(undefined) };
  service = new ContactService(
    repo as unknown as ContactSubmissionRepository,
    recaptcha as never,
    hooks as never,
  );
});

describe('submit', () => {
  it('drops a honeypot-filled submission without storing or emitting', async () => {
    await service.submit({ name: 'A', email: 'a@x.test', message: 'hi', company: 'bot' });
    expect(repo.create).not.toHaveBeenCalled();
    expect(hooks.emit).not.toHaveBeenCalled();
  });

  it('rejects when the recaptcha check fails', async () => {
    recaptcha.verify.mockResolvedValue(false);
    await expect(
      service.submit({ name: 'A', email: 'a@x.test', message: 'hi' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('persists then emits contact.submitted', async () => {
    await service.submit({ name: 'Ada', email: 'a@x.test', message: 'hi', subject: 'Hi' });
    expect(repo.create).toHaveBeenCalledWith({
      name: 'Ada',
      email: 'a@x.test',
      subject: 'Hi',
      message: 'hi',
    });
    expect(hooks.emit).toHaveBeenCalledWith('contact.submitted', {
      id: 'c1',
      name: 'Ada',
      email: 'a@x.test',
      subject: null,
      message: 'hi',
    });
  });
});

describe('admin', () => {
  it('lists submissions mapped to the response shape', async () => {
    repo.list.mockResolvedValue([row]);
    const list = await service.list();
    expect(list[0]).toMatchObject({ id: 'c1', email: 'a@x.test', handledAt: null });
    expect(typeof list[0]?.createdAt).toBe('string');
  });

  it('maps P2025 to 404 on setHandled', async () => {
    repo.setHandledAt.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('x', { code: 'P2025', clientVersion: '5' }),
    );
    await expect(service.setHandled('c1', true)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s removing a missing submission', async () => {
    repo.exists.mockResolvedValue(false);
    await expect(service.remove('c1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
