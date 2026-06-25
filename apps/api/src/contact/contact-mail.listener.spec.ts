import type { SiteProfileRepository } from '@cmstack-ts/db';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactMailListener } from './contact-mail.listener';

let profiles: { get: Mock };
let mail: { send: Mock };
let listener: ContactMailListener;

const payload = { id: 'c1', name: 'Ada', email: 'a@x.test', subject: null, message: 'hi' };

beforeEach(() => {
  profiles = { get: vi.fn() };
  mail = { send: vi.fn().mockResolvedValue(undefined) };
  listener = new ContactMailListener(profiles as unknown as SiteProfileRepository, mail as never);
});

describe('ContactMailListener', () => {
  it('sends to the profile contactEmail when set', async () => {
    profiles.get.mockResolvedValue({ contactEmail: 'owner@x.test' });
    await listener.handle(payload);
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0]?.[0].to).toBe('owner@x.test');
  });

  it('falls back to MAIL_FROM when no profile email and no env', async () => {
    const prev = process.env.CONTACT_RECIPIENT_EMAIL;
    process.env.CONTACT_RECIPIENT_EMAIL = '';
    profiles.get.mockResolvedValue({ contactEmail: '' });
    await listener.handle(payload);
    expect(mail.send.mock.calls[0]?.[0].to).toBeTruthy();
    process.env.CONTACT_RECIPIENT_EMAIL = prev;
  });

  it('does not throw when the profile lookup returns null', async () => {
    profiles.get.mockResolvedValue(null);
    await expect(listener.handle(payload)).resolves.toBeUndefined();
    expect(mail.send).toHaveBeenCalled();
  });
});
