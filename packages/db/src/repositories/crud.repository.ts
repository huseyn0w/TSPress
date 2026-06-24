/**
 * Minimal shape of a Prisma model delegate needed by {@link PrismaCrudRepository}.
 * Both methods accept an id-only `where`, which every aggregate with a string `id`
 * primary key satisfies.
 */
export interface CrudDelegate {
  count(args: { where: { id: string } }): Promise<number>;
  delete(args: { where: { id: string } }): Promise<unknown>;
}

/**
 * Shared base for the trivial, identical data-access operations every aggregate
 * needs (`exists`, `hardDelete`). Concrete repositories extend this and add the
 * methods that carry real query shape. Keeps one-repository-per-aggregate without
 * hand-writing the same two forwards on every repository.
 */
export abstract class PrismaCrudRepository {
  protected constructor(private readonly delegate: CrudDelegate) {}

  /** True when a row with this id exists. */
  async exists(id: string): Promise<boolean> {
    return (await this.delegate.count({ where: { id } })) > 0;
  }

  /** Permanently deletes the row by id (propagates Prisma P2025 if absent). */
  async hardDelete(id: string): Promise<void> {
    await this.delegate.delete({ where: { id } });
  }
}
