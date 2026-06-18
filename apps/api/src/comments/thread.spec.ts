import { describe, expect, it } from 'vitest';
import { type FlatComment, buildCommentThread } from './thread';

function c(id: string, parentId: string | null, name = id): FlatComment {
  return { id, parentId, authorName: name, content: `c-${id}`, createdAt: `2026-01-0${id}` };
}

describe('buildCommentThread', () => {
  it('returns an empty array for no comments', () => {
    expect(buildCommentThread([])).toEqual([]);
  });

  it('nests replies under their parent, preserving input order', () => {
    const tree = buildCommentThread([c('1', null), c('2', '1'), c('3', '1'), c('4', null)]);
    expect(tree.map((n) => n.id)).toEqual(['1', '4']);
    expect(tree[0]?.replies.map((n) => n.id)).toEqual(['2', '3']);
    expect(tree[1]?.replies).toEqual([]);
  });

  it('supports multiple levels of nesting', () => {
    const tree = buildCommentThread([c('1', null), c('2', '1'), c('3', '2')]);
    expect(tree[0]?.replies[0]?.replies[0]?.id).toBe('3');
  });

  it('promotes orphans (parent missing from the set) to top level', () => {
    // '2' replies to an unapproved/absent '99' — it should still surface.
    const tree = buildCommentThread([c('1', null), c('2', '99')]);
    expect(tree.map((n) => n.id)).toEqual(['1', '2']);
  });
});
