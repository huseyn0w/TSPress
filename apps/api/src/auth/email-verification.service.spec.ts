import type {
  EmailVerificationTokenRepository,
  EmailVerificationTokenRow,
  UserRepository,
} from '@cmstack-ts/db';
import { BadRequestException } from '@nestjs/common';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MailService } from '../mail/mail.service';
import { EmailVerificationService } from './email-verification.service';

let users: { findByIdWithRole: Mock; setEmailVerified: Mock };
let tokens: Record<keyof EmailVerificationTokenRepository, Mock>;
let mail: { send: Mock };
let service: EmailVerificationService;

function tokenRow(over: Partial<EmailVerificationTokenRow> = {}): EmailVerificationTokenRow {
  return {
    id: 't1',
    userId: 'u1',
    tokenHash: 'h',
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    createdAt: new Date(),
    ...over,
  } as EmailVerificationTokenRow;
}

beforeEach(() => {
  process.env.WEB_ORIGIN = 'https://site.test';
  users = { findByIdWithRole: vi.fn(), setEmailVerified: vi.fn() };
  tokens = {
    create: vi.fn(),
    findByHash: vi.fn(),
    markUsed: vi.fn(),
    deleteAllForUser: vi.fn(),
  };
  mail = { send: vi.fn().mockResolvedValue(undefined) };
  service = new EmailVerificationService(
    users as unknown as UserRepository,
    tokens as unknown as EmailVerificationTokenRepository,
    mail as unknown as MailService,
  );
});

describe('EmailVerificationService.request', () => {
  it('for an unverified user: clears old tokens, stores a hashed token, emails a link', async () => {
    users.findByIdWithRole.mockResolvedValue({
      id: 'u1',
      email: 'a@test.local',
      emailVerified: null,
    });
    await service.request('u1');
    expect(tokens.deleteAllForUser).toHaveBeenCalledWith('u1');
    const created = tokens.create.mock.calls[0]?.[0];
    expect(created.userId).toBe('u1');
    expect(created.tokenHash).toMatch(/^[a-f0-9]{64}$/); // sha-256 hex, not the raw token
    const sent = mail.send.mock.calls[0]?.[0];
    expect(sent.to).toBe('a@test.local');
    expect(sent.text).toContain('https://site.test/verify-email?token=');
    const urlToken = sent.text.match(/token=([a-f0-9]+)/)?.[1];
    expect(urlToken).not.toBe(created.tokenHash);
  });

  it('for an already-verified user: no token, no email (idempotent)', async () => {
    users.findByIdWithRole.mockResolvedValue({
      id: 'u1',
      email: 'a@test.local',
      emailVerified: new Date(),
    });
    await service.request('u1');
    expect(tokens.create).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('a mail-send failure does not surface (the token is still issued)', async () => {
    users.findByIdWithRole.mockResolvedValue({
      id: 'u1',
      email: 'a@test.local',
      emailVerified: null,
    });
    mail.send.mockRejectedValueOnce(new Error('SMTP down'));
    await expect(service.request('u1')).resolves.toBeUndefined();
    expect(tokens.create).toHaveBeenCalled();
  });
});

describe('EmailVerificationService.confirm', () => {
  it('stamps emailVerified and marks the token used on a valid token', async () => {
    tokens.findByHash.mockResolvedValue(tokenRow());
    await service.confirm({ token: 'raw' });
    expect(users.setEmailVerified).toHaveBeenCalledWith('u1', expect.any(Date));
    expect(tokens.markUsed).toHaveBeenCalledWith('t1');
  });

  it('rejects an unknown token', async () => {
    tokens.findByHash.mockResolvedValue(null);
    await expect(service.confirm({ token: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    expect(users.setEmailVerified).not.toHaveBeenCalled();
  });

  it('rejects an expired token', async () => {
    tokens.findByHash.mockResolvedValue(tokenRow({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(service.confirm({ token: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    expect(users.setEmailVerified).not.toHaveBeenCalled();
  });

  it('rejects an already-used token (no replay)', async () => {
    tokens.findByHash.mockResolvedValue(tokenRow({ usedAt: new Date() }));
    await expect(service.confirm({ token: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    expect(users.setEmailVerified).not.toHaveBeenCalled();
  });
});
