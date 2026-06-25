import {
  CONTACT_SUBMISSION_REPOSITORY,
  PrismaContactSubmissionRepository,
  PrismaSiteProfileRepository,
  SITE_PROFILE_REPOSITORY,
} from '@cmstack-ts/db';
import { Module, type OnModuleInit } from '@nestjs/common';
import { AccountsModule } from '../auth/accounts.module';
import { MailModule } from '../mail/mail.module';
import { provideRepository } from '../persistence/repository.providers';
import { HookRegistry } from '../plugins/hook-registry';
import { PluginsModule } from '../plugins/plugins.module';
import { SpamModule } from '../spam/spam.module';
import { ContactMailListener } from './contact-mail.listener';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { PublicContactController } from './public-contact.controller';

@Module({
  // AccountsModule → admin guards; MailModule → delivery; SpamModule → reCAPTCHA;
  // PluginsModule → HookRegistry (the observer the listener subscribes to).
  imports: [AccountsModule, MailModule, SpamModule, PluginsModule],
  controllers: [ContactController, PublicContactController],
  providers: [
    ContactService,
    ContactMailListener,
    provideRepository(CONTACT_SUBMISSION_REPOSITORY, PrismaContactSubmissionRepository),
    provideRepository(SITE_PROFILE_REPOSITORY, PrismaSiteProfileRepository),
  ],
})
export class ContactModule implements OnModuleInit {
  constructor(
    private readonly hooks: HookRegistry,
    private readonly listener: ContactMailListener,
  ) {}

  onModuleInit(): void {
    this.hooks.addAction('contact.submitted', (payload) => this.listener.handle(payload));
  }
}
