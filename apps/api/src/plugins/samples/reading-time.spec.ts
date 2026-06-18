import { describe, expect, it } from 'vitest';
import { estimateReadingTimeMinutes, withReadingTime } from './reading-time.plugin';

describe('estimateReadingTimeMinutes', () => {
  it('counts words from text, ignoring HTML tags', () => {
    const html = '<p>one two three four five</p>';
    // 5 words at 200 wpm rounds up to a 1-minute read.
    expect(estimateReadingTimeMinutes(html)).toBe(1);
  });

  it('rounds up to whole minutes at ~200 wpm', () => {
    const words = Array.from({ length: 450 }, () => 'word').join(' ');
    // 450 / 200 = 2.25 -> 3 minutes.
    expect(estimateReadingTimeMinutes(`<p>${words}</p>`)).toBe(3);
  });

  it('never returns less than 1 minute, even for empty content', () => {
    expect(estimateReadingTimeMinutes('')).toBe(1);
    expect(estimateReadingTimeMinutes('<p></p>')).toBe(1);
  });
});

describe('withReadingTime', () => {
  it('prepends a reading-time badge to the content', () => {
    const out = withReadingTime('<p>hello world</p>');
    expect(out.startsWith('<p class="reading-time"')).toBe(true);
    expect(out).toContain('1 min read');
    expect(out).toContain('<p>hello world</p>');
  });

  it('is idempotent: it does not stack badges if applied twice', () => {
    const once = withReadingTime('<p>hello</p>');
    const twice = withReadingTime(once);
    const badges = twice.match(/class="reading-time"/g) ?? [];
    expect(badges).toHaveLength(1);
  });
});
