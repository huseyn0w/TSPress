import { describe, expect, it, vi } from 'vitest';
import { type CrudDelegate, PrismaCrudRepository } from './crud.repository';

class TestRepo extends PrismaCrudRepository {
  constructor(delegate: CrudDelegate) {
    super(delegate);
  }
}

function makeRepo() {
  const delegate = { count: vi.fn(), delete: vi.fn() } as unknown as CrudDelegate & {
    count: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  return { repo: new TestRepo(delegate), delegate };
}

describe('PrismaCrudRepository', () => {
  it('exists() is true when count > 0', async () => {
    const { repo, delegate } = makeRepo();
    delegate.count.mockResolvedValue(1);
    expect(await repo.exists('x')).toBe(true);
    expect(delegate.count).toHaveBeenCalledWith({ where: { id: 'x' } });
  });

  it('exists() is false when count is 0', async () => {
    const { repo, delegate } = makeRepo();
    delegate.count.mockResolvedValue(0);
    expect(await repo.exists('x')).toBe(false);
  });

  it('hardDelete() deletes by id', async () => {
    const { repo, delegate } = makeRepo();
    delegate.delete.mockResolvedValue({});
    await repo.hardDelete('x');
    expect(delegate.delete).toHaveBeenCalledWith({ where: { id: 'x' } });
  });
});
