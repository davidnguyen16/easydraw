import { captureAsJpeg } from './canvas-capture';
import { downloadDataUrl } from './download';
import type { Exporter } from './types';

export const jpegExporter: Exporter = {
  id: 'jpeg',
  label: 'JPEG',
  extension: '.jpeg',
  mimeType: 'image/jpeg',
  async run({ fileName, canvasElement, diagramBounds }) {
    const dataUrl = await captureAsJpeg(canvasElement, diagramBounds);
    downloadDataUrl(dataUrl, `${fileName}.jpeg`);
  },
};
