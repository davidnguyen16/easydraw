import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isSourceImageData, isVectorGeometry, vectorPathData, VECTOR_PATH_NODE_TYPE, SOURCE_IMAGE_NODE_TYPE,
  type SourceImageData, type VectorGeometry,
} from './index.js';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6LVsAAAAASUVORK5CYII=';
const geometry = (): VectorGeometry => ({
  version: 1,
  commands: [{ op: 'M', values: [0, 1000] }, { op: 'Q', values: [500, 0, 1000, 1000] }],
  stroke: '#2563EB', fill: 'none', strokeWidth: 3, dash: 'solid', startArrow: false, endArrow: false,
});
const source = (): SourceImageData => ({ version: 1, dataUrl: `data:image/png;base64,${PNG}`, width: 1, height: 1, reason: 'Preserve this detail.' });

test('public vector data emits numeric SVG commands and has stable renderer types', () => {
  assert.equal(VECTOR_PATH_NODE_TYPE, 'VectorPathNode');
  assert.equal(SOURCE_IMAGE_NODE_TYPE, 'SourceImageNode');
  assert.ok(isVectorGeometry(geometry()));
  assert.equal(vectorPathData(geometry()), 'M 0 1000 Q 500 0 1000 1000');
  const all = geometry();
  all.commands = [
    { op: 'M', values: [0, 0] }, { op: 'L', values: [10.5, 20] },
    { op: 'C', values: [30, 40, 50, 60, 70, 80] }, { op: 'Z', values: [] },
    { op: 'M', values: [80, 90] }, { op: 'Q', values: [90, 90, 100, 100] },
  ];
  assert.ok(isVectorGeometry(all));
  assert.match(vectorPathData(all), /^M 0 0 L 10\.5 20 C 30 40 50 60 70 80 Z M 80 90 Q 90 90 100 100$/);
});

test('commands reject unsupported operations, bad arity, nonfinite coordinates and broken subpaths', () => {
  const cases = [
    [], [{ op: 'M', values: [0, 0] }], [{ op: 'M', values: [0, 0] }, { op: 'Z', values: [] }],
    [{ op: 'L', values: [0, 0] }, { op: 'L', values: [1, 1] }],
    [{ op: 'M', values: [0, 0] }, { op: 'A', values: [1, 1] }],
    [{ op: 'M', values: [0, 0] }, { op: 'l', values: [1, 1] }],
    [{ op: 'M', values: [0, 0] }, { op: 'Q', values: [1, 2] }],
    [{ op: 'M', values: [0, 0] }, { op: 'L', values: [1, 1] }, { op: 'Z', values: [1] }],
    [{ op: 'M', values: [0, 0] }, { op: 'L', values: [1, 1] }, { op: 'Z', values: [] }, { op: 'L', values: [2, 2] }],
  ];
  for (const commands of cases) {
    assert.equal(isVectorGeometry({ ...geometry(), commands }), false);
    assert.equal(vectorPathData({ ...geometry(), commands }), '');
  }
  for (const value of [NaN, Infinity, -Infinity, -0.1, 1000.1, '0', '<script>', null]) {
    assert.equal(isVectorGeometry({ ...geometry(), commands: [{ op: 'M', values: [0, 0] }, { op: 'L', values: [value, 100] }] }), false);
  }
});

test('paint and style fields accept only bounded numeric values and explicit safe colors', () => {
  for (const key of ['stroke', 'fill']) {
    for (const value of ['url(https://evil.test/a)', 'url(#paint)', 'red', '#fff', '#12345678', '#12345g', '<svg>', 'none;stroke:red']) {
      assert.equal(isVectorGeometry({ ...geometry(), [key]: value }), false);
    }
    assert.ok(isVectorGeometry({ ...geometry(), [key]: 'none' }));
    assert.ok(isVectorGeometry({ ...geometry(), [key]: '#aAbBcC' }));
  }
  for (const value of [-1, 12.01, NaN, Infinity, '2']) assert.equal(isVectorGeometry({ ...geometry(), strokeWidth: value }), false);
  for (const strokeWidth of [0, 0.5, 12]) assert.ok(isVectorGeometry({ ...geometry(), strokeWidth }));
  for (const dash of ['solid', 'dashed', 'dotted']) assert.ok(isVectorGeometry({ ...geometry(), dash }));
  for (const patch of [{ version: 2 }, { dash: 'random' }, { startArrow: 'true' }, { endArrow: 1 },
    { svg: '<svg/>' }, { url: 'https://evil.test/' }, { onClick: 'alert(1)' }]) {
    assert.equal(isVectorGeometry({ ...geometry(), ...patch }), false);
  }
});

test('vector arrays are bounded and strict; getters, prototypes and proxies cannot escape the guard', () => {
  const max = geometry();
  max.commands = [{ op: 'M', values: [0, 0] }, ...Array.from({ length: 63 }, () => ({ op: 'L' as const, values: [1, 1] }))];
  assert.ok(isVectorGeometry(max));
  assert.equal(isVectorGeometry({ ...max, commands: [...max.commands, { op: 'L', values: [1, 1] }] }), false);
  assert.equal(isVectorGeometry({ ...max, commands: new Array(100_000) }), false);
  assert.equal(isVectorGeometry({ ...max, commands: new Array(2) }), false);
  const custom = Object.assign(Object.create({ unsafe: true }) as object, geometry());
  assert.equal(isVectorGeometry(custom), false);
  let reads = 0;
  for (const target of [geometry(), geometry().commands, geometry().commands[1]!, geometry().commands[1]!.values]) {
    const key = Array.isArray(target) ? '0' : 'op' in target ? 'op' : 'commands';
    Object.defineProperty(target, key, { enumerable: true, get() { reads += 1; throw new Error('not data'); } });
    const input = Array.isArray(target) ? (key === '0' && typeof target[1] === 'number'
      ? { ...geometry(), commands: [{ op: 'M', values: [0, 0] }, { op: 'L', values: target }] }
      : { ...geometry(), commands: target }) : 'op' in target ? { ...geometry(), commands: [geometry().commands[0], target] } : target;
    assert.equal(isVectorGeometry(input), false);
    assert.equal(vectorPathData(input), '');
  }
  assert.equal(reads, 0);
  const revoked = Proxy.revocable(geometry(), {}); revoked.revoke();
  assert.equal(isVectorGeometry(revoked.proxy), false);
  assert.equal(vectorPathData(revoked.proxy), '');
});

test('frozen vector values are accepted without mutation', () => {
  const value = geometry();
  const before = JSON.stringify(value);
  for (const command of value.commands) { Object.freeze(command.values); Object.freeze(command); }
  Object.freeze(value.commands); Object.freeze(value);
  assert.ok(isVectorGeometry(value));
  assert.equal(vectorPathData(value), 'M 0 1000 Q 500 0 1000 1000');
  assert.equal(JSON.stringify(value), before);
});

test('source crops require bounded PNG bytes and matching IHDR dimensions', () => {
  assert.ok(isSourceImageData(source()));
  assert.ok(isSourceImageData(Object.freeze(source())));
  for (const patch of [{ version: 2 }, { width: 0 }, { width: 1.5 }, { width: 1025 }, { width: Infinity },
    { height: NaN }, { height: 2 }, { reason: 'x'.repeat(501) }, { reason: null }, { url: 'https://evil.test/a' },
    { dataUrl: `data:image/svg+xml;base64,${PNG}` }, { dataUrl: `https://evil.test/${PNG}` },
    { dataUrl: 'data:image/png;base64,AAAA' }, { dataUrl: `data:image/png;base64,${'A'.repeat(180000)}` },
    { dataUrl: `data:image/png;base64,${PNG}\n` }]) assert.equal(isSourceImageData({ ...source(), ...patch }), false);
  const bomb = Buffer.from(PNG, 'base64'); bomb.writeUInt32BE(100_000, 16);
  assert.equal(isSourceImageData({ ...source(), dataUrl: `data:image/png;base64,${bomb.toString('base64')}` }), false);
  const getter = source(); let reads = 0;
  Object.defineProperty(getter, 'dataUrl', { enumerable: true, get() { reads += 1; return source().dataUrl; } });
  assert.equal(isSourceImageData(getter), false); assert.equal(reads, 0);
  const revoked = Proxy.revocable(source(), {}); revoked.revoke();
  assert.equal(isSourceImageData(revoked.proxy), false);
});

test('source crop guard rejects animated PNG chunks, truncation and trailing data', () => {
  const png = Buffer.from(PNG, 'base64');
  for (const type of ['acTL', 'fcTL', 'fdAT']) {
    const chunk = Buffer.alloc(12); chunk.write(type, 4, 'ascii');
    const animated = Buffer.concat([png.subarray(0, 33), chunk, png.subarray(33)]);
    assert.equal(isSourceImageData({ ...source(), dataUrl: `data:image/png;base64,${animated.toString('base64')}` }), false);
  }
  for (const bytes of [png.subarray(0, 30), png.subarray(0, png.length - 1), Buffer.concat([png, Buffer.from([0])])]) {
    assert.equal(isSourceImageData({ ...source(), dataUrl: `data:image/png;base64,${bytes.toString('base64')}` }), false);
  }
});
