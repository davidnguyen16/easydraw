import type { Node } from '@xyflow/react';
import type { VectorGeometry, Visual3DPart, Visual3DRecipe, Visual3DVector } from '@easydraw/diagram-schema';
import type { EditorState } from '../../stores/editor-doc.store';

export const GEOMETRY_TITLE = 'Triangular Prism — Volume & Distance';
type Point3D = [number, number, number];
const COLORS = {
  ink: '#243650', base: '#2563eb', angle: '#d68b19',
  target: '#169b72', distance: '#b91c3b', auxiliary: '#718096',
};

/** A right equilateral triangular prism. Four world units represent a;
 * every construction uses that same scale, including the perpendicular MF. */
export function createGeometryDocument(): EditorState {
  const nodes: Node[] = [];
  const parts: Visual3DPart[] = [];
  const a = 4, altitude = Math.sqrt(3) * a / 2, height = 3 * a / 2;
  const A: Point3D = [2.8, 0.45, 4.2];
  const B: Point3D = [A[0] - a / 2, A[1], A[2] - altitude];
  const C: Point3D = [A[0] + a / 2, A[1], B[2]];
  const top = (point: Point3D): Point3D => [point[0], point[1] + height, point[2]];
  const Ap = top(A), Bp = top(B), Cp = top(C);
  const N: Point3D = [A[0], A[1], B[2]], K = top(N);
  const M: Point3D = [A[0], A[1] + height / 2, A[2]];
  const alongAK = (t: number): Point3D => A.map((value, axis) => value + t * (K[axis] - value)) as Point3D;
  const H = alongAK(3 / 4), F = alongAK(3 / 8);

  // Numeric vector triangles are normal editable nodes, with genuine planar
  // geometry in 3D. The given angle plane and the distance plane are distinct.
  function triangle(id: string, center: Point3D, length: number, rotationX: number,
    color: string, opacity: number, outline = false) {
    const width = a * 100, nodeHeight = length * 100;
    nodes.push({ id, type: 'VectorPathNode',
      position: { x: (center[0] - a / 2) * 100, y: (center[2] - length / 2) * 100 },
      width, height: nodeHeight, style: { width, height: nodeHeight }, zIndex: -1,
      data: { label: '', fillColor: outline ? 'none' : color, borderColor: color,
        borderWidth: outline ? 2 : 0, opacity,
        vector: { version: 1, commands: [
          { op: 'M', values: [0, 0] }, { op: 'L', values: [1000, 0] },
          { op: 'L', values: [500, 1000] }, { op: 'Z', values: [] },
        ], stroke: color, fill: outline ? 'none' : color, strokeWidth: outline ? 2 : 0,
        dash: 'solid', startArrow: false, endArrow: false } satisfies VectorGeometry,
        spatial3d: { depth: 0.02, elevation: center[1] - 0.01, rotationX },
      },
    });
  }
  const centerZ = (A[2] + N[2]) / 2;
  triangle('geometry-base-plane', [A[0], A[1], centerZ], altitude, 0, COLORS.base, 15);
  const slope = Math.hypot(altitude, height);
  triangle('geometry-angle-plane', [A[0], A[1] + height / 2, centerZ], slope, -Math.PI / 3,
    COLORS.angle, 65, true);
  triangle('geometry-target-plane', [A[0], A[1] + height / 2, centerZ], slope, Math.PI / 3,
    COLORS.target, 26);

  const minimum: Point3D = [0.35, 0.15, 0.3], box: Point3D = [5, 6.6, 4.5];
  const center = minimum.map((value, axis) => value + box[axis] / 2) as Point3D;
  const relative = (point: Point3D): Visual3DVector =>
    point.map((value, axis) => (value - center[axis]) / box[axis]) as Visual3DVector;
  function lerp(from: Point3D, to: Point3D, t: number): Point3D {
    return from.map((value, axis) => value + t * (to[axis] - value)) as Point3D;
  }
  // Normalize endpoints before rotation so unequal recipe dimensions do not
  // distort physical lengths, the 60-degree angle, or the perpendicular foot.
  function segment(from: Point3D, to: Point3D, color: string, thickness = 0.006) {
    const start = relative(from), end = relative(to);
    const [dx, dy, dz] = end.map((value, axis) => value - start[axis]);
    parts.push({ shape: 'box', material: 'custom', color,
      position: start.map((value, axis) => (value + end[axis]) / 2) as Visual3DVector,
      size: [thickness, thickness, Math.hypot(dx, dy, dz)],
      rotation: [-Math.atan2(dy, dz), Math.atan2(dx, Math.hypot(dy, dz)), 0],
    });
  }
  function dashed(from: Point3D, to: Point3D, color: string, count = 9) {
    for (let index = 0; index < count; index++) {
      segment(lerp(from, to, index / count), lerp(from, to, (index + 0.55) / count), color, 0.0035);
    }
  }
  function rightAngle(at: Point3D, toward1: Point3D, toward2: Point3D, color: string) {
    const offset = (toward: Point3D): Point3D => {
      const distance = Math.hypot(...toward.map((value, axis) => value - at[axis]));
      return toward.map((value, axis) => (value - at[axis]) * 0.23 / distance) as Point3D;
    };
    const u = offset(toward1), v = offset(toward2);
    const p = at.map((value, axis) => value + u[axis]) as Point3D;
    const q = p.map((value, axis) => value + v[axis]) as Point3D;
    const r = at.map((value, axis) => value + v[axis]) as Point3D;
    segment(p, q, color, 0.0045); segment(q, r, color, 0.0045);
  }

  for (const [from, to] of [[A, B], [B, C], [C, A], [Ap, Bp], [Bp, Cp], [Cp, Ap],
    [A, Ap], [B, Bp], [C, Cp]]) segment(from, to, COLORS.ink);
  // Green is the requested plane (AB'C'); amber is the given plane (A'BC).
  segment(A, Bp, COLORS.target, 0.008); segment(A, Cp, COLORS.target, 0.008);
  segment(Bp, Cp, COLORS.target, 0.008);
  segment(Ap, B, COLORS.angle, 0.005); segment(Ap, C, COLORS.angle, 0.005);
  dashed(A, N, COLORS.base); dashed(N, Ap, COLORS.angle);
  dashed(A, K, COLORS.target); dashed(Ap, H, COLORS.auxiliary, 7);
  // This solid red segment is exactly the shortest distance to the green plane.
  segment(M, F, COLORS.distance, 0.014);
  rightAngle(A, N, Ap, COLORS.auxiliary);
  rightAngle(H, A, Ap, COLORS.auxiliary);
  rightAngle(F, A, M, COLORS.distance);
  const arcRadius = 0.62, arcSteps = 12;
  for (let index = 0; index < arcSteps; index++) {
    const arcPoint = (step: number): Point3D => [N[0], N[1] + arcRadius * Math.sin(step * Math.PI / 3 / arcSteps),
      N[2] + arcRadius * Math.cos(step * Math.PI / 3 / arcSteps)];
    segment(arcPoint(index), arcPoint(index + 1), COLORS.angle, 0.006);
  }
  // Equal ticks on AM and MA' identify the given midpoint without assuming a length.
  for (const t of [1 / 4, 3 / 4]) {
    const point = lerp(A, Ap, t);
    segment([point[0] - 0.12, point[1], point[2]], [point[0] + 0.12, point[1], point[2]], COLORS.ink);
  }
  for (const [label, point] of Object.entries({ A, B, C, "A'": Ap, "B'": Bp, "C'": Cp, M, N, K, H, F })) {
    parts.push({ shape: 'sphere', material: 'custom', color: label === 'M' || label === 'F' ? COLORS.distance : COLORS.ink,
      position: relative(point), size: box.map((length) => 0.11 / length) as Visual3DVector });
  }
  nodes.push({ id: 'geometry-prism-construction', type: 'CubeNode',
    position: { x: minimum[0] * 100, y: minimum[2] * 100 },
    width: box[0] * 100, height: box[2] * 100, style: { width: box[0] * 100, height: box[2] * 100 },
    data: { label: '', fillColor: 'transparent', borderColor: COLORS.ink, borderWidth: 0,
      visual3d: { version: 2, parts } satisfies Visual3DRecipe,
      spatial3d: { depth: box[1], elevation: minimum[1] } },
  });

  function caption(id: string, x: number, z: number, width: number, nodeHeight: number,
    label: string, fontSize: number, elevation: number, color = COLORS.ink) {
    nodes.push({ id, type: 'TextNode', position: { x, y: z }, width, height: nodeHeight,
      style: { width, height: nodeHeight },
      data: { label, fontSize, textColor: color, textAlign: 'left', bold: true,
        fillColor: 'transparent', borderWidth: 0,
        spatial3d: { depth: 0.02, elevation, rotationX: Math.PI / 2 } },
    });
  }
  // Upright labels are fixed to the drawing, rather than facing the camera.
  for (const [id, label, point, dx, dy] of [
    ['a', 'A', A, 8, -0.3], ['b', 'B', B, -64, -0.22], ['c', 'C', C, 10, -0.22],
    ['ap', "A'", Ap, 8, 0.28], ['bp', "B'", Bp, -68, 0.28], ['cp', "C'", Cp, 10, 0.28],
    ['m', 'M', M, -72, 0], ['n', 'N', N, -58, -0.12], ['k', 'K', K, 4, 0.27],
    ['h', 'H', H, 9, 0.09], ['f', 'F', F, 9, -0.02],
  ] as const) {
    caption(`geometry-vertex-${id}`, point[0] * 100 + dx, point[2] * 100 + 4, 80, 64,
      label, 30, point[1] + dy, id === 'm' || id === 'f' ? COLORS.distance : COLORS.ink);
  }
  caption('geometry-base-length', 130, 290, 135, 64, 'AB = a', 27, 0.57, COLORS.base);
  caption('geometry-given-angle', 292, 128, 170, 64, '60°', 30, 1.05, COLORS.angle);
  caption('geometry-distance-label', -15, 420, 235, 64, 'MF = 3a / 8', 27, 2.87, COLORS.distance);
  caption('geometry-target-label', 351, 222, 240, 64, "(AB'C')", 28, 4.68, COLORS.target);
  caption('geometry-teaching-card', 680, -300, 780, 760,
    "TRIANGULAR PRISM\nRight prism; equilateral bases.\nAB = a; M is the midpoint of AA'.\nAngle: (ABC) to (A'BC) = 60°.\n\n1. HEIGHT & VOLUME\nN is the midpoint of BC.\nAN = √3 a / 2\nAA' = AN tan 60° = 3a / 2\nV = (√3 a² / 4) × (3a / 2)\nV = 3√3 a³ / 8\n\n2. DISTANCE TO (AB'C')\nK is the midpoint of B'C'.\nA'H ⟂ AK; A'H ⟂ (AB'C').\nAK = √3 a; A'H = 3a / 4\nF is the midpoint of AH.\nMF ∥ A'H, so MF ⟂ (AB'C').\nMF = 3a / 8",
    30, 3.5);
  caption('geometry-color-key', 44, 464, 550, 95,
    "Blue: base   Amber: 60° plane\nGreen: target plane   Red: distance", 23, 0.08);

  return { schemaVersion: 1, activePageId: 'geometry-triangular-prism', fileName: GEOMETRY_TITLE, status: 'draft',
    pages: [{ id: 'geometry-triangular-prism', name: 'Volume & Distance', nodes, edges: [],
      view3d: { version: 1, orientation: 'floor', showGrid: false, origin: [7.2, 0, 3.3],
        camera: { position: [7.6, 8.8, 14], target: [0, 3.2, 0.1] } },
    }],
  };
}
