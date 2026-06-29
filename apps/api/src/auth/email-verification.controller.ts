import {
  type EmailVerificationConfirmInput,
  emailVerificationConfirmSchema,
} from '@cmstack-ts/config';
import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { AuthenticatedUser } from './authenticated-user';
import { CurrentUser } from './current-user.decorator';
import { EmailVerificationService } from './email-verification.service';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Email-verification endpoints. The request is authenticated (verify your own
 * address); the confirm is public (it carries the emailed token). Both are
 * rate-limited.
 */
@Controller('auth')
export class EmailVerificationController {
  constructor(private readonly verification: EmailVerificationService) {}

  @Post('me/verify-email')
  @HttpCode(202)
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async request(@CurrentUser() user: AuthenticatedUser): Promise<{ ok: true }> {
    await this.verification.request(user.id);
    return { ok: true };
  }

  @Post('verify-email/confirm')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async confirm(
    @Body(new ZodValidationPipe(emailVerificationConfirmSchema))
    body: EmailVerificationConfirmInput,
  ): Promise<{ ok: true }> {
    await this.verification.confirm(body);
    return { ok: true };
  }
}
