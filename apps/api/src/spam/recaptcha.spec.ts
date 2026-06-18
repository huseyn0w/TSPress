import { describe, expect, it } from 'vitest';
import { recaptchaPasses } from './recaptcha.service';

describe('recaptchaPasses', () => {
  it('passes when successful and score meets the threshold', () => {
    expect(recaptchaPasses({ success: true, score: 0.7 }, 0.5)).toBe(true);
    expect(recaptchaPasses({ success: true, score: 0.5 }, 0.5)).toBe(true);
  });

  it('fails when unsuccessful or below the threshold', () => {
    expect(recaptchaPasses({ success: false, score: 0.9 }, 0.5)).toBe(false);
    expect(recaptchaPasses({ success: true, score: 0.3 }, 0.5)).toBe(false);
  });

  it('treats a missing score as 0 (fails)', () => {
    expect(recaptchaPasses({ success: true }, 0.5)).toBe(false);
  });
});
