/** Serialize saves per document so an older HTTP write cannot finish after a
 * newer write from this editor. Different documents never block one another.
 * The caller still owns HTTP retries, session freshness and save indicators. */
export class KeyedSaveQueue {
  private readonly tails = new Map<string, Promise<void>>();

  get pendingKeyCount(): number { return this.tails.size; }

  enqueue<T>(key: string, operation: () => T | PromiseLike<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const result: Promise<T> = previous.then(operation).finally(() => {
      // A later save may already have extended this key's chain. An earlier
      // completion must not remove its tail and let a third save bypass it.
      if (this.tails.get(key) === tail) this.tails.delete(key);
    });
    // Only the internal sequencing tail swallows failures. Return the original
    // result so callers can display the failed save and explicitly retry it.
    const tail: Promise<void> = result.then(() => undefined, () => undefined);
    this.tails.set(key, tail);
    return result;
  }
}
