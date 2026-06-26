import { describe, expect, it } from 'vitest';
import { revisionToPageUpdate, revisionToPostUpdate } from './revision-snapshot';

describe('revisionToPostUpdate', () => {
  it('maps known scalar fields', () => {
    expect(
      revisionToPostUpdate({
        title: 'T',
        slug: 'old-slug',
        excerpt: 'E',
        content: '<p>x</p>',
        status: 'PUBLISHED',
      }),
    ).toEqual({
      title: 'T',
      slug: 'old-slug',
      excerpt: 'E',
      content: '<p>x</p>',
      status: 'PUBLISHED',
    });
  });

  it('omits a null excerpt and an unknown status', () => {
    expect(revisionToPostUpdate({ title: 'T', excerpt: null, status: 'WAT' })).toEqual({
      title: 'T',
    });
  });

  it('tolerates a non-object snapshot', () => {
    expect(revisionToPostUpdate(null)).toEqual({});
  });
});

describe('revisionToPageUpdate', () => {
  it('maps page scalar fields (no excerpt)', () => {
    expect(revisionToPageUpdate({ title: 'P', slug: 's', content: 'c', status: 'DRAFT' })).toEqual({
      title: 'P',
      slug: 's',
      content: 'c',
      status: 'DRAFT',
    });
  });
});
