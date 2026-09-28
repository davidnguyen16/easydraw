import assert from 'node:assert/strict';
import test from 'node:test';
import { KeyedSaveQueue } from '../client/src/lib/flow/save-queue.ts';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise((resolve) => queueMicrotask(resolve));

test('same-document saves start and complete in submission order', async () => {
  const queue = new KeyedSaveQueue();
  const firstGate = deferred(), secondGate = deferred();
  const events = [];
  const first = queue.enqueue('diagram-a', async () => {
    events.push('first-start'); await firstGate.promise; events.push('first-end'); return 1;
  });
  const second = queue.enqueue('diagram-a', async () => {
    events.push('second-start'); await secondGate.promise; events.push('second-end'); return 2;
  });
  await tick();
  assert.deepEqual(events, ['first-start']);
  assert.equal(queue.pendingKeyCount, 1);
  // Even if the second HTTP mock could resolve first, it cannot begin until
  // the older write completes, so the final server write is always the newer.
  secondGate.resolve();
  await tick();
  assert.deepEqual(events, ['first-start']);
  firstGate.resolve();
  assert.deepEqual(await Promise.all([first, second]), [1, 2]);
  assert.deepEqual(events, ['first-start', 'first-end', 'second-start', 'second-end']);
  assert.equal(queue.pendingKeyCount, 0);
});

test('a slow document does not block saves of another document', async () => {
  const queue = new KeyedSaveQueue();
  const gate = deferred();
  const slow = queue.enqueue('slow', () => gate.promise);
  const fast = queue.enqueue('fast', () => 'saved');
  assert.equal(await fast, 'saved');
  assert.equal(queue.pendingKeyCount, 1);
  gate.resolve('later');
  assert.equal(await slow, 'later');
  assert.equal(queue.pendingKeyCount, 0);
});

test('a rejection reaches its caller without poisoning subsequent saves', async () => {
  const queue = new KeyedSaveQueue();
  const gate = deferred();
  const failure = new Error('HTTP 503');
  const first = queue.enqueue('a', () => gate.promise);
  const rejects = assert.rejects(first, (error) => error === failure);
  const second = queue.enqueue('a', () => 'retry-saved');
  gate.reject(failure);
  await rejects;
  assert.equal(await second, 'retry-saved');
  assert.equal(queue.pendingKeyCount, 0);
});

test('a synchronous exception also releases the key and permits a retry', async () => {
  const queue = new KeyedSaveQueue();
  await assert.rejects(queue.enqueue('a', () => { throw new Error('serialization failed'); }), /serialization failed/);
  assert.equal(queue.pendingKeyCount, 0);
  assert.equal(await queue.enqueue('a', () => 42), 42);
  assert.equal(queue.pendingKeyCount, 0);
});

test('an earlier completion cannot remove a newer pending tail', async () => {
  const queue = new KeyedSaveQueue();
  const firstGate = deferred(), secondGate = deferred();
  const events = [];
  const first = queue.enqueue('a', () => firstGate.promise);
  const second = queue.enqueue('a', async () => { events.push('second-start'); await secondGate.promise; events.push('second-end'); });
  firstGate.resolve();
  await first;
  assert.equal(queue.pendingKeyCount, 1);
  const third = queue.enqueue('a', () => { events.push('third-start'); });
  await tick(); await tick();
  assert.ok(!events.includes('third-start'));
  secondGate.resolve();
  await Promise.all([second, third]);
  assert.deepEqual(events, ['second-start', 'second-end', 'third-start']);
  assert.equal(queue.pendingKeyCount, 0);
});

test('a drained key starts a fresh independent chain and retains no completed documents', async () => {
  const queue = new KeyedSaveQueue();
  assert.equal(await queue.enqueue('reused', () => 'first'), 'first');
  assert.equal(queue.pendingKeyCount, 0);
  assert.equal(await queue.enqueue('reused', () => Promise.resolve('second')), 'second');
  await Promise.all(Array.from({ length: 100 }, (_, index) => queue.enqueue(`document-${index}`, () => index)));
  assert.equal(queue.pendingKeyCount, 0);
});
