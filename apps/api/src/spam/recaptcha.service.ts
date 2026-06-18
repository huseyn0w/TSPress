import { Injectable, Logger } from '@nestjs/common';

interface SiteVerifyResponse {
  success?: boolean;
  score?: number;
}

/** Pure decision: did a reCAPTCHA v3 verification pass the score threshold? */
export function recaptchaPasses(data: SiteVerifyResponse, minScore: number): boolean {
  return data.success === true && (data.score ?? 0) >= minScore;
}

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

/**
 * Verifies reCAPTCHA v3 tokens. **Optional by design**: when no secret is
 * configured the service is disabled and `verify` returns true, so the local /
 * demo stack runs without Google keys. When configured, a token is required and
 * must meet the score threshold.
 */
@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger('RecaptchaService');
  private readonly secret = process.env.RECAPTCHA_SECRET_KEY?.trim() || undefined;
  private readonly minScore = Number(process.env.RECAPTCHA_MIN_SCORE ?? 0.5);

  get enabled(): boolean {
    return this.secret !== undefined;
  }

  async verify(token: string | undefined): Promise<boolean> {
    if (!this.secret) return true; // not configured → skip
    if (!token) return false;

    try {
      const res = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: this.secret, response: token }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as SiteVerifyResponse;
      return recaptchaPasses(data, this.minScore);
    } catch (error) {
      this.logger.error('reCAPTCHA verification failed', error as Error);
      return false;
    }
  }
}
