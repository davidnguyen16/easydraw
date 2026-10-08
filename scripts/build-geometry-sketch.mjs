/** Original vector artwork, rasterized for the whiteboard's editable bitmap.
 * Run from the repo root: node scripts/build-geometry-sketch.mjs.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ink = '#25384b';
const blue = '#2563eb';
const amber = '#cf8516';
const green = '#16845b';
const red = '#d43b43';
const root3 = Math.sqrt(3);
// y is vertical. Every construction point uses the same mathematical model
// as the editable 3D lesson, with a = 1. H and F lie on the target plane.
const model = {
  A: [0, 0, root3 / 2], B: [-0.5, 0, 0], C: [0.5, 0, 0],
  "A'": [0, 1.5, root3 / 2], "B'": [-0.5, 1.5, 0], "C'": [0.5, 1.5, 0],
  N: [0, 0, 0], K: [0, 1.5, 0], M: [0, 0.75, root3 / 2],
  H: [0, 1.125, root3 / 8], F: [0, 0.5625, 5 * root3 / 16],
};
const project = ([x, y, z]) => [470 + 500 * x - 210 * z, 920 - 300 * y - 170 * z + 60 * x];
const points = Object.fromEntries(Object.entries(model).map(([name, point]) => [name, project(point)]));
let sequence = 0;
// Small, deterministic deviations mimic a marker stroke without changing endpoints.
function line(a, b, color = ink, width = 4, dashed = false) {
  const [x1, y1] = Array.isArray(a) ? a : points[a];
  const [x2, y2] = Array.isArray(b) ? b : points[b];
  const wobble = (++sequence % 2 ? 1 : -1) * 1.8;
  return `<path d="M ${x1} ${y1} Q ${(x1 + x2) / 2 + wobble} ${(y1 + y2) / 2 - wobble} ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" ${dashed ? 'stroke-dasharray="13 11" opacity="0.7"' : ''}/>`;
}
function text(x, y, label, size = 32, color = ink, angle = 0) {
  const escape = label.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  return `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" transform="rotate(${angle} ${x} ${y})">${escape}</text>`;
}
function triangle(names, color, opacity = 0.09, width = 3) {
  return `<polygon points="${names.map((name) => points[name].join(',')).join(' ')}" fill="${color}" fill-opacity="${opacity}"/>`
    + names.map((name, index) => line(name, names[(index + 1) % names.length], color, width)).join('\n');
}
function rightAngle(vertex, toward1, toward2, color, size = 0.065) {
  const origin = model[vertex];
  const direction = (name) => {
    const delta = model[name].map((value, index) => value - origin[index]);
    const length = Math.hypot(...delta);
    return delta.map((value) => size * value / length);
  };
  const u = direction(toward1), v = direction(toward2);
  const p = (du, dv) => project(origin.map((value, index) => value + du * u[index] + dv * v[index]));
  return line(p(1, 0), p(1, 1), color, 2.5) + line(p(1, 1), p(0, 1), color, 2.5);
}
function angleArc(vertex, toward1, toward2, radius = 60) {
  const [x, y] = points[vertex];
  const angle = (name) => Math.atan2(points[name][1] - y, points[name][0] - x);
  const start = angle(toward1), end = angle(toward2);
  const p = (theta) => [x + radius * Math.cos(theta), y + radius * Math.sin(theta)];
  const a = p(start), b = p(end);
  return `<path d="M ${a.join(' ')} A ${radius} ${radius} 0 0 1 ${b.join(' ')}" fill="none" stroke="${amber}" stroke-width="3.5" stroke-linecap="round"/>`;
}

const labelLayout = {
  A: [261, 804], B: [175, 917], C: [738, 978],
  "A'": [265, 298], "B'": [170, 436], "C'": [739, 508],
  M: [249, 559], N: [460, 973], K: [490, 462],
  H: [444, 558], F: [368, 684],
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1120" viewBox="0 0 1600 1120">
<rect width="1600" height="1120" fill="#fffefb"/>
<g font-family="Segoe Print, Comic Sans MS, cursive">
${text(72, 83, 'Triangular Prism — Teacher Sketch', 49, ink, -0.5)}
${line([76, 109], [1499, 108], '#d1dce4', 3)}
${text(77, 157, 'Right prism ABC.A′B′C′ with equilateral triangular bases, AB = a.', 33)}
${text(77, 204, 'Angle between (ABC) and (A′BC) = 60°. M is the midpoint of AA′.', 32)}
${text(77, 250, 'Find: 1) volume V;  2) the distance from M to plane (AB′C′).', 33, green)}
${triangle(['A', 'B', 'C'], blue, 0.11, 4)}
${triangle(["A'", 'B', 'C'], amber, 0.025, 3)}
${triangle(['A', "B'", "C'"], green, 0.15, 4)}
${line('A', "A'", ink, 4.5)}
${line('B', "B'", ink, 4.5)}
${line('C', "C'", ink, 4.5)}
${line("A'", "B'", ink, 4)}
${line("A'", "C'", ink, 4)}
${line("B'", "C'", ink, 4)}
${line('A', 'B', blue, 4)}
${line('B', 'C', blue, 4)}
${line('C', 'A', blue, 4)}
${line('A', 'N', blue, 3, true)}
${line("A'", 'N', amber, 3, true)}
${line('A', 'K', green, 3.5, true)}
${line("A'", 'H', red, 3, true)}
${line('M', 'F', red, 5)}
${rightAngle('A', 'N', "A'", blue)}
${rightAngle('N', 'A', 'C', blue)}
${rightAngle('H', "A'", 'K', red)}
${rightAngle('F', 'M', 'K', red)}
${angleArc('N', 'A', "A'")}
${text(391, 865, '60°', 26, amber, 1)}
${text(171, 832, 'a', 35, blue, -59)}
${text(598, 882, '(ABC)', 30, blue, 1)}
${text(547, 594, '(AB′C′)', 30, green, 1)}
${Object.entries(points).map(([name, point]) => `<circle cx="${point[0]}" cy="${point[1]}" r="${['M', 'F'].includes(name) ? 5 : 4}" fill="${['M', 'F'].includes(name) ? red : ink}"/>`).join('\n')}
${Object.entries(labelLayout).map(([name, [x, y]]) => text(x, y, name.replaceAll("'", '′'), 34, ['M', 'F', 'H'].includes(name) ? red : ink, sequence++ % 2 ? -2 : 1)).join('\n')}
${line([909, 317], [903, 996], '#e2e8ed', 2)}
${text(959, 359, 'Teacher construction', 37, ink, -1)}
${text(965, 419, '1. Volume', 34, blue, 1)}
${text(978, 469, 'N is the midpoint of BC.', 28)}
${text(978, 513, 'Use right triangle ANA′', 28)}
${text(978, 557, 'and the 60° angle at N.', 28, amber)}
${text(978, 601, 'V = base area × height', 28, blue)}
${text(965, 678, '2. Distance', 34, green, -1)}
${text(978, 726, 'K is the midpoint of B′C′.', 28)}
${text(978, 770, 'A′H ⟂ AK, with H on AK.', 28)}
${text(978, 814, 'F is the midpoint of AH.', 28)}
${text(978, 858, 'MF ∥ A′H; MF ⟂ (AB′C′).', 28, red)}
${line([951, 886], [1488, 887], '#d1dce4', 2)}
${text(963, 929, 'Amber: given plane (A′BC)', 26, amber)}
${text(963, 969, 'Green: target plane (AB′C′)', 26, green)}
${text(963, 1009, 'Red MF: the distance to find', 26, red)}
${text(77, 1074, 'Sketch not to scale — use the construction to explain each step.', 29, '#708090', -0.2)}
</g></svg>`;

const destination = fileURLToPath(new URL('../client/public/samples/geometry-hand-sketch', import.meta.url));
await writeFile(`${destination}.svg`, svg, 'utf8');
await sharp(Buffer.from(svg)).png().toFile(`${destination}.png`);
console.log('Created geometry-hand-sketch.svg and geometry-hand-sketch.png (1600 × 1120).');
