import { getSceneViewport } from './scene-viewport';
import { downloadDataUrl } from '@/lib/exporters/download';

/** Export the camera the user is looking through, not the hidden 2D viewport. */
export async function exportScene3D(format: string, fileName: string) {
  const viewport = getSceneViewport();
  if (!viewport) throw new Error('3D viewport is not ready');
  const png = await viewport.exportImage();
  if (format === 'png') { downloadDataUrl(png, `${fileName}.png`); return; }
  const image = new Image();
  image.src = png;
  await image.decode();
  if (format === 'jpeg') {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image export is unavailable');
    ctx.fillStyle = '#f6f5f1';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    downloadDataUrl(canvas.toDataURL('image/jpeg', 0.95), `${fileName}.jpg`);
    return;
  }
  const { jsPDF } = await import('jspdf');
  const scale = Math.min(1, 13952 / image.naturalWidth, 13952 / image.naturalHeight);
  const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
  const pdf = new jsPDF({ orientation: width >= height ? 'landscape' : 'portrait', unit: 'pt', format: [width + 48, height + 48] });
  pdf.addImage(png, 'PNG', 24, 24, width, height);
  pdf.save(`${fileName}.pdf`);
}
