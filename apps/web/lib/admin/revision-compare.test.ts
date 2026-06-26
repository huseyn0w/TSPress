import { describe, expect, it } from 'vitest';
import { compareRevisionFields } from './revision-compare';

const FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'content', label: 'Content' },
];

describe('compareRevisionFields', () => {
  it('flags changed fields and renders both values', () => {
    const result = compareRevisionFields(
      { title: 'New', content: 'body' },
      { title: 'Old', content: 'body' },
      FIELDS,
    );
    expect(result).toEqual([
      { key: 'title', label: 'Title', current: 'New', revision: 'Old', changed: true },
      { key: 'content', label: 'Content', current: 'body', revision: 'body', changed: false },
    ]);
  });

  it('treats null/undefined as empty strings', () => {
    const [title] = compareRevisionFields({ title: null }, {}, [{ key: 'title', label: 'Title' }]);
    expect(title).toEqual({ key: 'title', label: 'Title', current: '', revision: '', changed: false });
  });
});
