import { jsPDF } from 'jspdf';
import { getEmeraldPoLogoPublicPath, type EmeraldPoDisplayModel } from '@/utils/emeraldPoDocumentModel';

const M = 14;
const PAGE_BOTTOM = 285;
const COL_L = M;
const COL_W = 182;

function fmtMoney(n: number): string {
  return n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ensureY(doc: jsPDF, y: number, need: number): number {
  if (y + need > PAGE_BOTTOM) {
    doc.addPage();
    return M;
  }
  return y;
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function fetchUrlAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return blobToDataUrl(blob);
  } catch {
    return null;
  }
}

export async function buildEmeraldPurchaseOrderPdf(model: EmeraldPoDisplayModel): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = M;

  const teal: [number, number, number] = [32, 112, 125];
  const lightBlue: [number, number, number] = [200, 228, 240];
  const titleBlue: [number, number, number] = [70, 150, 185];
  const headerText: [number, number, number] = [45, 65, 82];

  const logoY = 10;
  const logoMaxW = 58;
  const logoMaxH = 24;
  let logoDrawn = false;
  try {
    const rel = getEmeraldPoLogoPublicPath();
    const logoFetchUrl =
      typeof window !== 'undefined' && window.location?.origin
        ? new URL(rel, window.location.origin).href
        : rel;
    const logoData = await fetchUrlAsDataUrl(logoFetchUrl);
    if (logoData) {
      let drawW = logoMaxW;
      let drawH = logoMaxH;
      try {
        const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
          const img = new Image();
          img.onload = () =>
            resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
          img.onerror = () => reject(new Error('logo load'));
          img.src = logoData;
        });
        if (dims.w > 0 && dims.h > 0) {
          const scale = Math.min(logoMaxW / dims.w, logoMaxH / dims.h);
          drawW = dims.w * scale;
          drawH = dims.h * scale;
        }
      } catch {
        drawW = logoMaxW;
        drawH = logoMaxH * 0.55;
      }
      const logoRight = COL_L + COL_W;
      const drawX = logoRight - drawW;
      doc.addImage(logoData, 'PNG', drawX, logoY, drawW, drawH);
      logoDrawn = true;
    }
  } catch {
    // fall through to placeholder
  }
  if (!logoDrawn) {
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
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(20);
  doc.setTextColor(titleBlue[0], titleBlue[1], titleBlue[2]);
  doc.text('Purchase Order', COL_L, y);
  doc.setTextColor(0, 0, 0);
  y += 12;

  const col1 = COL_L;
  const col2 = COL_L + 58;
  const col3 = COL_L + 118;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('SUPPLIER', col1, y);
  doc.text('SHIP TO', col2, y);
  doc.text('P.O. NO.', col3, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const supLines = doc.splitTextToSize(model.supplierName, 52);
  doc.text(supLines, col1, y);
  const shipLines = doc.splitTextToSize(model.shipTo, 54);
  doc.text(shipLines, col2, y);
  doc.setFont('helvetica', 'bold');
  doc.text(model.poNumber, col3, y);
  y += Math.max(supLines.length, shipLines.length) * 3.8 + 2;

  doc.setFont('helvetica', 'bold');
  doc.text('DATE', col3, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.text(model.poDateDisplay, col3, y);
  y += 6;
  doc.setDrawColor(180, 180, 180);
  doc.line(COL_L, y, COL_L + COL_W, y);
  y += 6;

  const tableX = COL_L;
  const tableW = COL_W;
  const rowH = 9;
  const headH = 8;
  doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  doc.rect(tableX, y, tableW, headH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(headerText[0], headerText[1], headerText[2]);
  doc.text('DESCRIPTION', tableX + 28, y + 5.5);
  doc.text('QTY', tableX + 118, y + 5.5);
  doc.text('RATE', tableX + 132, y + 5.5);
  doc.text('TAX', tableX + 154, y + 5.5);
  doc.text('AMOUNT', tableX + 168, y + 5.5);
  doc.setTextColor(0, 0, 0);
  y += headH;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  for (const item of model.lineItems) {
    y = ensureY(doc, y, rowH + 10);
    doc.setFont('helvetica', 'bold');
    doc.text(item.categoryLine, tableX + 2, y + 5);
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(item.description, 82);
    doc.text(descLines, tableX + 28, y + 5);
    doc.text(String(item.qty), tableX + 118, y + 5);
    doc.text(fmtMoney(item.rate), tableX + 132, y + 5);
    doc.text(item.taxLabel, tableX + 154, y + 5);
    doc.text(fmtMoney(item.amount), tableX + tableW - 2, y + 5, { align: 'right' });
    y += Math.max(rowH, 4 + descLines.length * 3.8);
    doc.setDrawColor(220, 220, 220);
    doc.line(tableX, y, tableX + tableW, y);
    y += 2;
  }

  doc.setDrawColor(120, 120, 120);
  doc.setLineDashPattern([1, 2], 0);
  doc.line(COL_L, y, COL_L + COL_W, y);
  doc.setLineDashPattern([], 0);
  y += 8;

  y = ensureY(doc, y, 70);
  const splitY = y;
  const leftW = 108;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const invLines = doc.splitTextToSize(model.invoiceSubmissionLine, leftW);
  doc.text(invLines, COL_L, y);
  y += invLines.length * 3.8 + 4;

  doc.setFont('helvetica', 'bold');
  doc.text('Standard terms:', COL_L, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  for (const line of model.standardTermsLines) {
    const wrapped = doc.splitTextToSize(`- ${line}`, leftW);
    doc.text(wrapped, COL_L, y);
    y += wrapped.length * 3.8 + 1;
  }
  y += 2;
  doc.setFont('helvetica', 'bold');
  const payLabel = 'Payment Terms:';
  doc.setFontSize(8);
  const labelWidth = doc.getTextWidth(payLabel);
  doc.text(payLabel, COL_L, y);
  doc.setFont('helvetica', 'normal');
  const payGapMm = 2.5;
  const payValue = (model.paymentTermsDisplay || '—').trim();
  doc.text(payValue, COL_L + labelWidth + payGapMm, y);

  const tx = COL_L + 118;
  const tw = 66;
  let ty = splitY;
  const sumRows: [string, string][] = [
    ['SUBTOTAL', fmtMoney(model.subtotal)],
    ['TAX', fmtMoney(model.taxAmount)],
    [`TOTAL ${model.currencyCode}`, fmtMoney(model.total)],
  ];
  doc.setFontSize(8.5);
  for (let i = 0; i < sumRows.length; i++) {
    const [label, val] = sumRows[i];
    const isTotal = i === sumRows.length - 1;
    if (isTotal) {
      doc.setFillColor(235, 235, 235);
      doc.rect(tx, ty, tw, 9, 'F');
    }
    doc.setDrawColor(0, 0, 0);
    doc.rect(tx, ty, tw, 9, 'S');
    doc.setFont('helvetica', 'bold');
    doc.text(label, tx + 2, ty + 6);
    doc.text(val, tx + tw - 2, ty + 6, { align: 'right' });
    ty += 9;
  }

  y = Math.max(y, ty) + 14;

  y = ensureY(doc, y, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Approved By', COL_L, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(model.approverName, COL_L, y);
  y += 2;

  const lineY = y + 10;
  doc.setDrawColor(0, 0, 0);
  doc.line(COL_L, lineY, COL_L + 110, lineY);

  if (model.signatureDataUrl) {
    try {
      const fmt = model.signatureDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(model.signatureDataUrl, fmt, COL_L + 35, y - 2, 55, 18);
    } catch {
      // ignore
    }
  }

  y = lineY + 12;
  doc.setFont('helvetica', 'bold');
  doc.text('Date', COL_L, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(model.approvalDateDisplay, COL_L, y);
  y += 2;
  doc.line(COL_L, y + 8, COL_L + 110, y + 8);

  return doc.output('blob');
}
