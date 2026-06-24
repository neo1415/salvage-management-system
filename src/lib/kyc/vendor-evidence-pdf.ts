import { jsPDF } from 'jspdf';
import { PDFTemplateService } from '@/features/documents/services/pdf-template.service';

export type VendorEvidenceKeyValue = {
  label: string;
  value: string;
};

export type VendorEvidenceTable = {
  title: string;
  headers: string[];
  rows: string[][];
};

export type VendorEvidencePdfInput = {
  title: string;
  subtitle?: string;
  keyValueSections: Array<{ title: string; rows: VendorEvidenceKeyValue[] }>;
  tables: VendorEvidenceTable[];
  footerNote?: string;
};

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function addPageIfNeeded(doc: jsPDF, y: number, required = 18, maxY: number): number {
  if (y + required <= maxY) return y;
  doc.addPage();
  return 60;
}

function addSectionTitle(doc: jsPDF, title: string, y: number, maxY: number): number {
  y = addPageIfNeeded(doc, y, 16, maxY);
  doc.setFillColor(79, 70, 229);
  doc.rect(14, y, 182, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, 17, y + 5.5);
  doc.setTextColor(17, 24, 39);
  return y + 14;
}

function addKeyValues(doc: jsPDF, rows: VendorEvidenceKeyValue[], y: number, maxY: number): number {
  doc.setFontSize(9);
  for (const row of rows) {
    y = addPageIfNeeded(doc, y, 8, maxY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(75, 85, 99);
    doc.text(text(row.label), 16, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 24, 39);
    const lines = doc.splitTextToSize(text(row.value), 118);
    doc.text(lines, 70, y);
    y += Math.max(6, lines.length * 4.5);
  }
  return y + 2;
}

function addTable(doc: jsPDF, headers: string[], rows: string[][], y: number, maxY: number): number {
  y = addPageIfNeeded(doc, y, 12, maxY);
  const x = 14;
  const width = 182;
  const colWidth = width / headers.length;

  doc.setFillColor(243, 244, 246);
  doc.rect(x, y - 5, width, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  headers.forEach((header, index) => {
    doc.text(header, x + index * colWidth + 2, y);
  });
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(17, 24, 39);
  for (const row of rows) {
    y = addPageIfNeeded(doc, y, 10, maxY);
    row.forEach((cell, index) => {
      const lines = doc.splitTextToSize(text(cell), colWidth - 4);
      doc.text(lines.slice(0, 2), x + index * colWidth + 2, y);
    });
    doc.setDrawColor(229, 231, 235);
    doc.line(x, y + 3, x + width, y + 3);
    y += 8;
  }

  if (rows.length === 0) {
    doc.text('No records found.', x + 2, y);
    y += 8;
  }

  return y + 4;
}

export async function generateVendorEvidencePdf(input: VendorEvidencePdfInput): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await PDFTemplateService.addLetterhead(doc, input.title);

  let y = 60;
  const maxY = PDFTemplateService.getMaxContentY(doc);

  if (input.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    doc.text(input.subtitle, 14, y);
    y += 8;
  }

  for (const section of input.keyValueSections) {
    y = addSectionTitle(doc, section.title, y, maxY);
    y = addKeyValues(doc, section.rows, y, maxY);
  }

  for (const table of input.tables) {
    y = addSectionTitle(doc, table.title, y, maxY);
    y = addTable(doc, table.headers, table.rows, y, maxY);
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    await PDFTemplateService.addFooter(doc, input.footerNote ?? 'Confidential');
  }

  return Buffer.from(doc.output('arraybuffer'));
}
