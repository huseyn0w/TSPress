import { resolveContactRecipient } from '@cmstack-ts/config';
import { SITE_PROFILE_REPOSITORY, type SiteProfileRepository } from '@cmstack-ts/db';
import { Inject, Injectable } from '@nestjs/common';
import { contactNotificationEmail } from '../mail/contact-notification-email';
import { MailService } from '../mail/mail.service';
import type { ActionMap } from '../plugins/hooks';

/**
 * Sends the contact-form notification email when a submission is stored. Wired to
 * the `contact.submitted` action in the module's onModuleInit. emit() is
 * fault-isolated, so a failure here is logged and swallowed — it never fails the
 * public submit.
 */
@Injectable()
export class ContactMailListener {
  constructor(
    @Inject(SITE_PROFILE_REPOSITORY) private readonly profiles: SiteProfileRepository,
    private readonly mail: MailService,
  ) {}

  async handle(payload: ActionMap['contact.submitted']): Promise<void> {
    const profile = await this.profiles.get();
    const recipient = resolveContactRecipient(
      profile?.contactEmail ?? '',
      process.env.CONTACT_RECIPIENT_EMAIL,
      process.env.MAIL_FROM?.trim() || 'Cmstack-TS <noreply@localhost>',
    );
    const message = contactNotificationEmail({
      name: payload.name,
      email: payload.email,
      subject: payload.subject,
      message: payload.message,
    });
    await this.mail.send({ to: recipient, ...message });
  }
}
