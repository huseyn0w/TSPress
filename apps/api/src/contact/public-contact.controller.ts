import { type ContactSubmissionInput, contactSubmissionSchema } from '@cmstack-ts/config';
import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ContactService } from './contact.service';

/**
 * Public, unauthenticated contact form. Rate-limited per IP and spam-checked
 * (honeypot + reCAPTCHA in the service). Returns 201 on accept; a honeypot hit
 * also returns 201 (silent drop — no enumeration of the filter).
 */
@Controller('public/contact')
export class PublicContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async submit(
    @Body(new ZodValidationPipe(contactSubmissionSchema)) body: ContactSubmissionInput,
  ): Promise<{ ok: true }> {
    await this.contact.submit(body);
    return { ok: true };
  }
}
