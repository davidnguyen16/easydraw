import { jsPDF } from 'jspdf';
import { captureAsPng, getExportSize } from './canvas-capture';
import type { Exporter } from './types';

const PDF_MARGIN_PT = 24;
const MAX_PDF_PAGE_SIDE_PT = 14_000;

export const pdfExporter: Exporter = {
	id: 'pdf',
	label: 'PDF',
	extension: '.pdf',
	mimeType: 'application/pdf',
	async run({ fileName, canvasElement, diagramBounds }) {
		const dataUrl = await captureAsPng(canvasElement, diagramBounds);
		const exportSize = getExportSize(canvasElement, diagramBounds);
		const availableSide = MAX_PDF_PAGE_SIDE_PT - PDF_MARGIN_PT * 2;
		const scale = Math.min(
			1,
			availableSide / exportSize.width,
			availableSide / exportSize.height
		);
		const width = exportSize.width * scale;
		const height = exportSize.height * scale;

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
