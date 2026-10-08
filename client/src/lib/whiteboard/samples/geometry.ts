import { isWhiteboardDocument, type WhiteboardDocumentV1 } from '@easydraw/pack-whiteboard';
import { createGeometryDocument, GEOMETRY_TITLE } from '@/lib/diagram3d/samples/geometry';
import { createBuiltInPreview, type BuiltInPreview } from '../preview/built-in-preview';

/** A classroom demonstration with a fixed, reviewed result, not a live AI request. */
export const GEOMETRY_WHITEBOARD_SAMPLE = {
  id: 'geometry-whiteboard',
  title: 'Triangular Prism — Teacher Sketch',
  category: 'Education',
  description: 'An equilateral triangular prism, a 60° angle between planes, and editable steps for volume and distance.',
  imagePath: '/samples/geometry-hand-sketch.png',
  width: 1600,
  height: 1120,
  prompt: "Turn this teacher's sketch into an editable 3D lesson about the right prism ABC.A'B'C' with equilateral triangular bases and AB = a. The angle between planes (ABC) and (A'BC) is 60 degrees. M is the midpoint of AA'. Find the prism's volume V and the perpendicular distance from M to plane (AB'C'). Use a translucent blue base (ABC), an amber outline for the given plane (A'BC), and a translucent green triangle for the target plane (AB'C'); these are different planes. Label all six prism vertices and M. Let N be the midpoint of BC, and mark the 60-degree angle at N between NA and NA'. Let K be the midpoint of B'C'. For the distance construction, draw A'H perpendicular to AK with H on AK, then let F be the midpoint of AH and draw the actual perpendicular segment MF in red. Keep H three quarters along AK from A and F three eighths along AK from A; mark the right angles at H and F. Place English teacher steps beside the diagram: AN = sqrt(3)a / 2; AA' = AN tan 60 degrees = 3a / 2; V = 3sqrt(3)a^3 / 8. In right triangle AA'K, AK = sqrt(3)a, so A'H = 3a / 4. Since M and F are midpoints, MF is parallel to A'H and perpendicular to (AB'C'), giving d(M, (AB'C')) = MF = 3a / 8. Keep all shapes, construction lines, labels, and teacher notes editable. Include a clear 2D teaching view and a rotatable 3D view.",
} as const;

export async function createGeometryWhiteboardDocument(): Promise<WhiteboardDocumentV1> {
  const response = await fetch(GEOMETRY_WHITEBOARD_SAMPLE.imagePath);
  if (!response.ok) throw new Error('Could not load the geometry sketch. Please try again.');
  const blob = await response.blob();
  const signature = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
  if (![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => signature[index] === byte)) {
    throw new Error('The geometry sketch is unavailable. Please try again.');
  }
  const image = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result) : reject(new Error('Could not read the geometry sketch.'));
    reader.onerror = () => reject(new Error('Could not read the geometry sketch.'));
    reader.readAsDataURL(new Blob([blob], { type: 'image/png' }));
  });
  const document = { version: 1, pack: 'whiteboard', width: GEOMETRY_WHITEBOARD_SAMPLE.width,
    height: GEOMETRY_WHITEBOARD_SAMPLE.height, image, sample: GEOMETRY_WHITEBOARD_SAMPLE.id };
  if (!isWhiteboardDocument(document)) throw new Error('The geometry sketch could not be opened.');
  return document;
}

export function createGeometryBuiltInPreview(): BuiltInPreview {
  return createBuiltInPreview({
    id: GEOMETRY_WHITEBOARD_SAMPLE.id,
    title: GEOMETRY_TITLE,
    category: GEOMETRY_WHITEBOARD_SAMPLE.category,
    document: createGeometryDocument,
    openQuery: '?view=3d',
    initialView: '3D',
    thinkMs: 2_000,
  });
}
