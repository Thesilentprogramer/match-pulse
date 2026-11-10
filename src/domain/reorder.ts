/**
 * Idempotent reorder buffer for a seq-numbered stream.
 * Duplicates are ignored. A future seq waits until the gap fills.
 * Callers reconnect from `buffer.next - 1` when a gap goes stale.
 */

export interface ReorderBuffer<T extends { seq: number }> {
  next: number;
  queued: Map<number, T>;
}

export interface ReorderResult<T extends { seq: number }> {
  buffer: ReorderBuffer<T>;
  ready: T[];
  duplicate: boolean;
}

export function createReorder<T extends { seq: number }>(next = 1): ReorderBuffer<T> {
  return { next, queued: new Map() };
}

export function pushReorder<T extends { seq: number }>(
  buffer: ReorderBuffer<T>,
  item: T,
): ReorderResult<T> {
  if (item.seq < buffer.next) {
    return { buffer, ready: [], duplicate: true };
  }

  const queued = new Map(buffer.queued);
  if (item.seq !== buffer.next) {
    const duplicate = buffer.queued.has(item.seq);
    if (!duplicate) queued.set(item.seq, item);
    return { buffer: { next: buffer.next, queued }, ready: [], duplicate };
  }

  const ready: T[] = [item];
  let next = item.seq + 1;
  while (queued.has(next)) {
    const follow = queued.get(next);
    if (!follow) break;
    ready.push(follow);
    queued.delete(next);
    next += 1;
  }
  return { buffer: { next, queued }, ready, duplicate: false };
}

export function hasGap<T extends { seq: number }>(buffer: ReorderBuffer<T>): boolean {
  return buffer.queued.size > 0;
}

export function contiguousCursor<T extends { seq: number }>(buffer: ReorderBuffer<T>): number {
  return buffer.next - 1;
}
