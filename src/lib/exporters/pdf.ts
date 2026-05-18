import { jsPDF } from 'jspdf';
import { captureAsPng, getViewportSize } from './canvas-capture';
import type { Exporter } from './types';

const PDF_MARGIN_PT = 24;

export const pdfExporter: Exporter = {
    id: 'pdf',
    label: 'PDF',
    extension: '.pdf',
    mimeType: 'application/pdf',
    async run({ fileName, canvasElement }) {
        const dataUrl = await captureAsPng(canvasElement);
        const { width, height } = getViewportSize(canvasElement);

        // Orient the page along the longer side so the diagram isn't cropped.
        const orientation = width >= height ? 'landscape' : 'portrait';
        const pdf = new jsPDF({
            orientation,
            unit: 'pt',
            format: [width + PDF_MARGIN_PT * 2, height + PDF_MARGIN_PT * 2]
        });

        pdf.addImage(dataUrl, 'PNG', PDF_MARGIN_PT, PDF_MARGIN_PT, width, height);
        pdf.save(`${fileName}.pdf`);
    }
};
