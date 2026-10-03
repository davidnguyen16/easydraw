import { isWhiteboardDocument, type WhiteboardDocumentV1 } from '@easydraw/pack-whiteboard';
import { createDataCentreDocument, DATA_CENTRE_TITLE } from '@/lib/diagram3d/samples/data-centre';
import { createBuiltInPreview, type BuiltInPreview } from '../preview/built-in-preview';

/** Shipped with the static client so every signed-in account sees the same demo. */
export const DATA_CENTRE_WHITEBOARD_SAMPLE = {
  id: 'data-centre-whiteboard',
  title: 'Data Centre — Hand Sketch',
  category: 'Data centre',
  description: 'A hand-drawn floor plan ready for AI preview and refinement.',
  imagePath: '/samples/data-centre-hand-sketch.png',
  width: 1600,
  height: 1120,
  prompt: 'Turn this top-view sketch into a clean, editable data-centre floor plan in English. Preserve three zones: Compute Hall on the left, Infrastructure on the right, and Network Operations Centre across the bottom. Show three CRAC units, two rows of five separate racks labelled A-01 to A-05 and B-01 to B-05, and a cold aisle between them. Show UPS A, UPS B, PDU, Spine A, Spine B, and SAN 01 to SAN 03. Connect Spine A to every Row A rack with teal Fabric A cables; connect Spine B to every Row B rack and all three SAN units with blue Fabric B cables. Add Access, Monitoring, Network and Security in the operations centre. Make each device an editable shape and each cable an editable connector. Keep the layout close to the sketch; do not turn it into a software flowchart or add unshown devices.',
} as const;

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;

/** A sample click creates an independent, owner-scoped Whiteboard document. */
export async function createDataCentreWhiteboardDocument(): Promise<WhiteboardDocumentV1> {
  const response = await fetch(DATA_CENTRE_WHITEBOARD_SAMPLE.imagePath);
  if (!response.ok) throw new Error('Could not load the Data Centre sketch. Please try again.');
  const blob = await response.blob();
  const signature = new Uint8Array(await blob.slice(0, PNG_SIGNATURE.length).arrayBuffer());
  if (signature.length !== PNG_SIGNATURE.length || !PNG_SIGNATURE.every((byte, index) => signature[index] === byte)) {
    throw new Error('The Data Centre sketch is unavailable. Please try again.');
  }
  const image = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Could not read the Data Centre sketch.'));
    reader.onerror = () => reject(new Error('Could not read the Data Centre sketch.'));
    reader.readAsDataURL(new Blob([blob], { type: 'image/png' }));
  });
  const document = {
    version: 1,
    pack: 'whiteboard',
    width: DATA_CENTRE_WHITEBOARD_SAMPLE.width,
    height: DATA_CENTRE_WHITEBOARD_SAMPLE.height,
    image,
    // The copy remembers where it came from, so Generate preview keeps
    // answering with the built-in result after a reload or a repaint.
    sample: DATA_CENTRE_WHITEBOARD_SAMPLE.id,
  };
  if (!isWhiteboardDocument(document)) throw new Error('The Data Centre sketch could not be opened.');
  return document;
}

/** Generate preview on this sample answers with the dashboard's Data Centre
 * diagram, 3D equipment included, and Create saves that same diagram. No
 * request reaches the preview API or OpenAI. */
export function createDataCentreBuiltInPreview(): BuiltInPreview {
  return createBuiltInPreview({
    id: DATA_CENTRE_WHITEBOARD_SAMPLE.id,
    title: DATA_CENTRE_TITLE,
    category: DATA_CENTRE_WHITEBOARD_SAMPLE.category,
    document: createDataCentreDocument,
    openQuery: '?view=3d',
    // Hard-coded pause so the shipped answer arrives like a generated one.
    thinkMs: 2_000,
  });
}
