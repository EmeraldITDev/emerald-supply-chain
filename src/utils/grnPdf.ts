import { jsPDF } from 'jspdf';
import { fetchUrlAsDataUrl } from '@/utils/emeraldPOPdf';
import { getEmeraldPoLogoPublicPath } from '@/utils/emeraldPoDocumentModel';
import type { GrnDisplayModel, GrnSignatoryBlock } from '@/utils/grnDocumentModel';

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

async function drawEmeraldHeader(doc: jsPDF, model: GrnDisplayModel): Promise<number> {
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

function drawSig(doc: jsPDF, x: number, y: number, w: number, s: GrnSignatoryBlock): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(s.heading, x + 2, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Name: ${s.name}`, x + 2, y + 11);
  doc.text(`Position: ${s.position}`, x + 2, y + 16);
  doc.text(`Sign / Date: ${s.signDate}`, x + 2, y + 27);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.line(x + 2, y + 24, x + w - 4, y + 24);
  doc.setLineWidth(0.2);
}

export async function buildGrnPdf(model: GrnDisplayModel): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = await drawEmeraldHeader(doc, model);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(70, 150, 185);
  doc.text(model.title, COL_L, y + 2);
  doc.setTextColor(0, 0, 0);
  y += 10;
  if (model.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(model.subtitle, COL_L, y);
    y += 5;
  }

  // Metadata grid: GRN No / Date of Receipt / MRF Ref / PO No
  doc.setDrawColor(180, 180, 180);
  doc.line(COL_L, y, COL_L + COL_W, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const c1 = COL_L;
  const c2 = COL_L + 50;
  const c3 = COL_L + 100;
  const c4 = COL_L + 145;
  doc.text('GRN No.', c1, y);
  doc.text('Date of Receipt', c2, y);
  doc.text('MRF Ref.', c3, y);
  doc.text('P.O. No.', c4, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(model.grnNumber, c1, y + 5);
  doc.text(model.dateOfReceiptDisplay, c2, y + 5);
  doc.text(model.mrfReference, c3, y + 5);
  doc.text(model.poNumber, c4, y + 5);
  y += 11;

  // Delivery info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Delivery Information', COL_L, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Waybill / Delivery Note No.', c1, y);
  doc.text('Delivery Date', c2, y);
  doc.text('Carrier Name', c3, y);
  doc.text('Vehicle Plate', c4, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(model.waybillDeliveryNoteNumber, c1, y + 5);
  doc.text(model.deliveryDateDisplay, c2, y + 5);
  doc.text(model.carrierName, c3, y + 5);
  doc.text(model.vehiclePlateNumber, c4, y + 5);
  y += 11;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Driver Name', c1, y);
  doc.text('Driver Phone', c2, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(model.driverName, c1, y + 5);
  doc.text(model.driverPhone, c2, y + 5);
  y += 11;

  // Supplier info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Supplier Information', COL_L, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Supplier Name: ${model.supplierName}`, COL_L, y);
  y += 5;
  if (model.supplierAddressLines.length === 0) {
    doc.text('Supplier Address: —', COL_L, y);
    y += 5;
  } else {
    doc.text('Supplier Address:', COL_L, y);
    y += 5;
    for (const line of model.supplierAddressLines) {
      doc.text(line, COL_L + 4, y);
      y += 4.5;
    }
  }
  y += 4;

  // Line items table
  const cols = {
    sn: COL_L,
    desc: COL_L + 12,
    dDate: COL_L + 72,
    uom: COL_L + 100,
    qtyO: COL_L + 114,
    qtyR: COL_L + 132,
    price: COL_L + 150,
  };
  const headH = 9;
  y = ensureY(doc, y, headH + 14);
  doc.setFillColor(200, 228, 240);
  doc.rect(COL_L, y, COL_W, headH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(45, 65, 82);
  doc.text('ITEM', cols.sn + 2, y + 6);
  doc.text('DESCRIPTION', cols.desc + 1, y + 6);
  doc.text('DELIVERY', cols.dDate + 1, y + 6);
  doc.text('UOM', cols.uom + 1, y + 6);
  doc.text('QTY ORD', cols.qtyO + 1, y + 6);
  doc.text('QTY REC', cols.qtyR + 1, y + 6);
  doc.text('UNIT PRICE / TOTAL', cols.price + 1, y + 6);
  doc.setTextColor(0, 0, 0);
  y += headH;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  if (model.lineItems.length === 0) {
    y = ensureY(doc, y, 10);
    doc.setTextColor(120, 120, 120);
    doc.text('No line items.', COL_L + 2, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 9;
  } else {
    const descW = cols.dDate - cols.desc - 2;
    const priceW = COL_L + COL_W - cols.price - 2;
    for (const li of model.lineItems) {
      const descLines = doc.splitTextToSize(li.description, descW);
      const priceLines = [li.unitPrice, li.total];
      const rowH = Math.max(9, Math.max(descLines.length, 2) * 4 + 2);
      y = ensureY(doc, y, rowH + 2);
      doc.text(String(li.sn), cols.sn + 2, y + 5);
      doc.text(descLines, cols.desc + 1, y + 5);
      doc.text(li.deliveryDate, cols.dDate + 1, y + 5);
      doc.text(li.uom, cols.uom + 1, y + 5);
      doc.text(li.quantityOrdered, cols.qtyO + 1, y + 5);
      doc.text(li.quantityReceived, cols.qtyR + 1, y + 5);
      doc.text(priceLines, cols.price + 1, y + 5);
      y += rowH;
      doc.setDrawColor(220, 220, 220);
      doc.line(COL_L, y, COL_L + COL_W, y);
    }
  }
  y += 6;

  // Comments
  y = ensureY(doc, y, 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Comments', COL_L, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  const commentsLines = doc.splitTextToSize(model.comments, COL_W);
  doc.text(commentsLines, COL_L, y);
  y += commentsLines.length * 4.5 + 6;

  // Signatures grid 2x2
  y = ensureY(doc, y, 70);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Authorised Signatories', COL_L, y);
  y += 5;
  const blockW = (COL_W - 6) / 2;
  const blockH = 32;
  doc.setDrawColor(180, 180, 180);
  doc.rect(COL_L, y, blockW, blockH, 'S');
  doc.rect(COL_L + blockW + 6, y, blockW, blockH, 'S');
  drawSig(doc, COL_L, y, blockW, model.vendorDeliveredBy);
  drawSig(doc, COL_L + blockW + 6, y, blockW, model.vendorWitnessedBy);
  y += blockH + 4;
  doc.rect(COL_L, y, blockW, blockH, 'S');
  doc.rect(COL_L + blockW + 6, y, blockW, blockH, 'S');
  drawSig(doc, COL_L, y, blockW, model.emeraldReceivedBy);
  drawSig(doc, COL_L + blockW + 6, y, blockW, model.emeraldSupervisedBy);

  return doc.output('blob');
}
