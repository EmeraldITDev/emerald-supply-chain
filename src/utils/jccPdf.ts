import { jsPDF } from 'jspdf';
import {
  fetchUrlAsDataUrl,
} from '@/utils/emeraldPOPdf';
import { getEmeraldPoLogoPublicPath } from '@/utils/emeraldPoDocumentModel';
import type { JccDisplayModel, JccSignatoryBlock } from '@/utils/jccDocumentModel';

const M = 14;
const PAGE_BOTTOM = 285;
const COL_L = M;
const COL_W = 182;

function ensureY(doc: jsPDF, y: number, need: number): number {
  if (y + need > PAGE_BOTTOM) {
    doc.addPage();
    return M;
  }
  return y;
}

async function drawEmeraldHeader(doc: jsPDF, model: JccDisplayModel): Promise<number> {
  let y = M;
  const teal: [number, number, number] = [32, 112, 125];
  const logoY = 10;
  const logoMaxW = 58;
  const logoMaxH = 24;
  let drew = false;
  try {
    const rel = getEmeraldPoLogoPublicPath();
    const url =
      typeof window !== 'undefined' && window.location?.origin
        ? new URL(rel, window.location.origin).href
        : rel;
    const data = await fetchUrlAsDataUrl(url);
    if (data) {
      let drawW = logoMaxW;
      let drawH = logoMaxH;
      try {
        const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
          img.onerror = () => reject(new Error('logo'));
          img.src = data;
        });
        if (dims.w > 0 && dims.h > 0) {
          const scale = Math.min(logoMaxW / dims.w, logoMaxH / dims.h);
          drawW = dims.w * scale;
          drawH = dims.h * scale;
        }
      } catch {
        // ignore
      }
      const right = COL_L + COL_W;
      doc.addImage(data, 'PNG', right - drawW, logoY, drawW, drawH);
      drew = true;
    }
  } catch {
    // ignore
  }
  if (!drew) {
    const phW = 50;
    const phH = 22;
    const phX = COL_L + COL_W - phW;
    doc.setFillColor(teal[0], teal[1], teal[2]);
    doc.roundedRect(phX, logoY, phW, phH, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('E', phX + 7, logoY + 15);
    doc.setFontSize(7);
    doc.text('EMERALD', phX + 18, logoY + 10);
    doc.text('INDUSTRIAL', phX + 18, logoY + 14);
    doc.text('CO. FZE', phX + 18, logoY + 18);
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(model.companyName, COL_L, y + 4);
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  for (const line of model.companyAddressLines) {
    doc.text(line, COL_L, y);
    y += 4.2;
  }
  doc.text(model.companyEmail, COL_L, y);
  y += 4.2;
  doc.setTextColor(0, 80, 140);
  doc.text(model.companyWebsite, COL_L, y);
  doc.setTextColor(0, 0, 0);
  y += 8;
  return y;
}

function drawSignatoryBlock(doc: jsPDF, x: number, y: number, w: number, s: JccSignatoryBlock): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(s.heading, x, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Name: ${s.name}`, x, y);
  y += 5;
  doc.text(`Position: ${s.position}`, x, y);
  y += 7;
  // signature line
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  if (s.signatureDataUrl) {
    try {
      const fmt = s.signatureDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(s.signatureDataUrl, fmt, x + 2, y - 14, 48, 14);
    } catch {
      // ignore
    }
  }
  doc.line(x, y, x + w - 4, y);
  doc.setLineWidth(0.2);
  y += 4;
  doc.text(`Sign / Date: ${s.signDate}`, x, y);
  return y;
}

export async function buildJccPdf(model: JccDisplayModel): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = await drawEmeraldHeader(doc, model);

  // Reference & date line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(model.referenceNumber, COL_L, y);
  doc.text(model.dateIssuedDisplay, COL_L + COL_W, y, { align: 'right' });
  y += 7;

  // Recipient block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(model.vendorName, COL_L, y);
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  for (const line of model.vendorAddressLines) {
    doc.text(line, COL_L, y);
    y += 4.2;
  }
  y += 4;

  // Linked records strip
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`Trip Ref: ${model.tripReference}`, COL_L, y);
  doc.text(`PO No.: ${model.poNumber}`, COL_L + 90, y);
  y += 7;

  // Salutation + title
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(model.salutation, COL_L, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const titleLines = doc.splitTextToSize(model.title, COL_W);
  doc.text(titleLines, COL_L, y);
  y += titleLines.length * 5 + 3;

  // Certification statement
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const stmt = doc.splitTextToSize(model.certificationStatement, COL_W);
  doc.text(stmt, COL_L, y);
  y += stmt.length * 4.6 + 4;

  doc.text('See below the list of leased and utilised vehicles / services;', COL_L, y);
  y += 6;

  // Line items table
  const colXs = {
    sn: COL_L,
    desc: COL_L + 14,
    trip: COL_L + 96,
    dur: COL_L + 116,
    rem: COL_L + 142,
  };
  const headH = 8;
  doc.setFillColor(200, 228, 240);
  doc.rect(COL_L, y, COL_W, headH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(45, 65, 82);
  doc.text('SN', colXs.sn + 2, y + 5.5);
  doc.text('DESCRIPTION OF GOODS / VEHICLE', colXs.desc + 1, y + 5.5);
  doc.text('TRIP', colXs.trip + 1, y + 5.5);
  doc.text('DURATION', colXs.dur + 1, y + 5.5);
  doc.text('REMARKS', colXs.rem + 1, y + 5.5);
  doc.setTextColor(0, 0, 0);
  y += headH;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const widths = {
    desc: colXs.trip - colXs.desc - 2,
    trip: colXs.dur - colXs.trip - 2,
    dur: colXs.rem - colXs.dur - 2,
    rem: COL_L + COL_W - colXs.rem - 2,
  };
  if (model.lineItems.length === 0) {
    y = ensureY(doc, y, 10);
    doc.setTextColor(120, 120, 120);
    doc.text('No line items.', COL_L + 2, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 9;
  } else {
    for (const item of model.lineItems) {
      const descLines = doc.splitTextToSize(item.description, widths.desc);
      const tripLines = doc.splitTextToSize(item.trip, widths.trip);
      const durLines = doc.splitTextToSize(item.durationDate, widths.dur);
      const remLines = doc.splitTextToSize(item.remarks, widths.rem);
      const rowH = Math.max(8, Math.max(descLines.length, tripLines.length, durLines.length, remLines.length) * 4 + 3);
      y = ensureY(doc, y, rowH + 2);
      doc.text(String(item.sn), colXs.sn + 2, y + 5);
      doc.text(descLines, colXs.desc + 1, y + 5);
      doc.text(tripLines, colXs.trip + 1, y + 5);
      doc.text(durLines, colXs.dur + 1, y + 5);
      doc.text(remLines, colXs.rem + 1, y + 5);
      y += rowH;
      doc.setDrawColor(220, 220, 220);
      doc.line(COL_L, y, COL_L + COL_W, y);
    }
  }
  y += 8;

  // Closing
  y = ensureY(doc, y, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(model.closing, COL_L, y);
  y += 10;

  // Signature blocks (vendor left, emerald right)
  const blockW = (COL_W - 10) / 2;
  const startY = y;
  drawSignatoryBlock(doc, COL_L, startY, blockW, model.vendorSignatory);
  drawSignatoryBlock(doc, COL_L + blockW + 10, startY, blockW, model.emeraldSignatory);

  return doc.output('blob');
}
