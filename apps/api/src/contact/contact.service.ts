import type { AdminContact, ContactSubmissionInput } from '@cmstack-ts/config';
import {
  CONTACT_SUBMISSION_REPOSITORY,
  type ContactSubmission,
  type ContactSubmissionRepository,
  Prisma,
} from '@cmstack-ts/db';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { HookRegistry } from '../plugins/hook-registry';
import { RecaptchaService } from '../spam/recaptcha.service';

@Injectable()
export class ContactService {
  constructor(
    @Inject(CONTACT_SUBMISSION_REPOSITORY) private readonly repo: ContactSubmissionRepository,
    private readonly recaptcha: RecaptchaService,
    private readonly hooks: HookRegistry,
  ) {}

  async submit(input: ContactSubmissionInput): Promise<void> {
    // Honeypot: a real browser never fills `company`. Silently accept + drop so a
    // bot can't tell it was filtered (no enumeration of the filter).
    if (input.company && input.company.trim() !== '') return;

    const passed = await this.recaptcha.verify(input.recaptchaToken);
    if (!passed) throw new BadRequestException('Spam check failed. Please try again.');

    const created = await this.repo.create({
      name: input.name,
      email: input.email,
      subject: input.subject ?? null,
      message: input.message,
    });
    // Side effect: notify the recipient. Fault-isolated — a mail failure can't fail
    // the already-stored submission or the public 201 (§2.7).
    await this.hooks.emit('contact.submitted', {
      id: created.id,
      name: created.name,
      email: created.email,
      subject: created.subject,
      message: created.message,
    });
  }

  async list(): Promise<AdminContact[]> {
    const rows = await this.repo.list();
    return rows.map((r) => this.toAdmin(r));
  }

  async setHandled(id: string, handled: boolean): Promise<AdminContact> {
    try {
      const row = await this.repo.setHandledAt(id, handled ? new Date() : null);
      return this.toAdmin(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Contact submission not found');
      }
      throw e;
    }
  }

  async remove(id: string): Promise<void> {
    if (!(await this.repo.exists(id))) throw new NotFoundException('Contact submission not found');
    await this.repo.hardDelete(id);
  }

  private toAdmin(r: ContactSubmission): AdminContact {
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      subject: r.subject,
      message: r.message,
      handledAt: r.handledAt ? r.handledAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
