import { captureAsPng } from './canvas-capture';
import { downloadDataUrl } from './download';
import type { Exporter } from './types';

export const pngExporter: Exporter = {
    id: 'png',
    label: 'PNG',
    extension: '.png',
    mimeType: 'image/png',
    async run({ fileName, canvasElement }) {
        const dataUrl = await captureAsPng(canvasElement);
        downloadDataUrl(dataUrl, `${fileName}.png`);
    }
};
