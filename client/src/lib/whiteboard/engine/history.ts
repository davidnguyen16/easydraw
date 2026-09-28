/**
 * Undo history as whole-board snapshots. A snapshot is taken *before* each
 * change, so undo restores the previous board and redo the one after.
 * Bounded to keep memory predictable: a 1280×800 board is 4 MB per entry.
 */
export class History {
  private past: ImageData[] = [];
  private future: ImageData[] = [];

  constructor(private readonly maxLevels = 50) {}

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Record the board as it is now; the next change moves away from it. */
  push(snapshot: ImageData): void {
    this.past.push(snapshot);
    if (this.past.length > this.maxLevels) this.past.shift();
    this.future = [];
  }

  /** Swap the current board for the previous one; returns what to restore. */
  undo(current: ImageData): ImageData | null {
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.push(current);
    return previous;
  }

  redo(current: ImageData): ImageData | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(current);
    return next;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }
}
