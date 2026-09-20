import type { InvoiceDto } from '@stampp/shared';
import { PDFDocument, StandardFonts } from 'pdf-lib';

function money(amountMinor: number, currency: string): string {
  const digits = currency === 'JPY' ? 0 : 2;
  const major = amountMinor / 10 ** digits;
  return `${major.toFixed(digits)} ${currency}`;
}

export async function renderInvoicePdf(invoice: InvoiceDto): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { height, width } = page.getSize();
  let y = height - 48;

  page.drawText('Stampp Invoice', { x: 40, y, size: 18, font: bold });
  y -= 28;
  page.drawText(`Number: ${invoice.number}`, { x: 40, y, size: 11, font });
  y -= 16;
  page.drawText(`Status: ${invoice.status}`, { x: 40, y, size: 11, font });
  y -= 16;
  page.drawText(`Issue date: ${invoice.issueDate}`, { x: 40, y, size: 11, font });
  y -= 16;
  page.drawText(`Due date: ${invoice.dueDate ?? '—'}`, { x: 40, y, size: 11, font });
  y -= 16;
  page.drawText(`Currency: ${invoice.currency}`, { x: 40, y, size: 11, font });
  y -= 28;

  page.drawText('Lines', { x: 40, y, size: 13, font: bold });
  y -= 18;
  page.drawText('Description', { x: 40, y, size: 10, font: bold });
  page.drawText('Qty', { x: 300, y, size: 10, font: bold });
  page.drawText('Unit', { x: 340, y, size: 10, font: bold });
  page.drawText('Amount', { x: 430, y, size: 10, font: bold });
  y -= 14;

  for (const line of invoice.lines) {
    if (y < 80) break;
    const description =
      line.description.length > 48 ? `${line.description.slice(0, 45)}...` : line.description;
    page.drawText(description, { x: 40, y, size: 10, font });
    page.drawText(String(line.quantity), { x: 300, y, size: 10, font });
    page.drawText(money(line.unitAmountMinor, invoice.currency), { x: 340, y, size: 10, font });
    page.drawText(money(line.amountMinor, invoice.currency), { x: 430, y, size: 10, font });
    y -= 14;
  }

  y -= 10;
  page.drawLine({
    start: { x: 40, y },
    end: { x: width - 40, y },
    thickness: 0.5,
  });
  y -= 20;
  const totals: [string, string][] = [
    ['Subtotal', money(invoice.subtotalMinor, invoice.currency)],
    ['Discount', money(invoice.discountMinor, invoice.currency)],
    [`Tax (${(invoice.taxRateBps / 100).toFixed(2)}%)`, money(invoice.taxMinor, invoice.currency)],
    ['Total', money(invoice.totalMinor, invoice.currency)],
    ['Paid', money(invoice.paidMinor, invoice.currency)],
    ['Balance', money(invoice.balanceMinor, invoice.currency)],
  ];
  for (const [label, value] of totals) {
    page.drawText(label, { x: 400, y, size: 11, font: bold });
    page.drawText(value, { x: 480, y, size: 11, font });
    y -= 16;
  }

  if (invoice.notes) {
    y -= 8;
    page.drawText('Notes', { x: 40, y, size: 12, font: bold });
    y -= 16;
    const note = invoice.notes.length > 800 ? `${invoice.notes.slice(0, 800)}...` : invoice.notes;
    page.drawText(note, { x: 40, y, size: 10, font });
  }

  return doc.save();
}
