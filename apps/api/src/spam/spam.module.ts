import { Module } from '@nestjs/common';
import { RecaptchaService } from './recaptcha.service';

/** Spam protection primitives (Phase 8): reCAPTCHA verification. */
@Module({
  providers: [RecaptchaService],
  exports: [RecaptchaService],
})
export class SpamModule {}
