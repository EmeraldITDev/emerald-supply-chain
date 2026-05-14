import {
  OTHERS_VENDOR_CATEGORY,
  type VendorDocumentRequirement,
  type VendorDocumentType,
} from "@/types/vendor-registration";

export function isOthersVendorCategoryLabel(label: string): boolean {
  const t = label.trim();
  return t === OTHERS_VENDOR_CATEGORY || t.toLowerCase() === "others";
}

/** Normalized GET /api/vendors/categories (or similar) payload. */
export function parseVendorCategoriesApiPayload(raw: unknown): {
  categoryLabels: string[];
  /** Document type key → required (from complianceDocumentSlots[].required). */
  documentRequiredByType: Record<string, boolean>;
} {
  const categoryLabels: string[] = [];
  const documentRequiredByType: Record<string, boolean> = {};

  if (!raw || typeof raw !== "object") {
    return { categoryLabels, documentRequiredByType };
  }

  const o = raw as Record<string, unknown>;
  const cats =
    o.categories ??
    o.category_list ??
    o.categoryList ??
    (Array.isArray(raw) ? raw : null);

  if (Array.isArray(cats)) {
    for (const c of cats) {
      if (typeof c === "string" && c.trim()) {
        categoryLabels.push(c.trim());
      } else if (c && typeof c === "object") {
        const row = c as Record<string, unknown>;
        const label =
          (typeof row.label === "string" && row.label.trim()) ||
          (typeof row.name === "string" && row.name.trim()) ||
          (typeof row.value === "string" && row.value.trim()) ||
          (typeof row.title === "string" && row.title.trim());
        if (label) categoryLabels.push(label);
      }
    }
  }

  const slots = o.complianceDocumentSlots ?? o.compliance_document_slots;

  if (Array.isArray(slots)) {
    for (const s of slots) {
      if (!s || typeof s !== "object") continue;
      const slot = s as Record<string, unknown>;
      const typeRaw =
        (typeof slot.documentType === "string" && slot.documentType) ||
        (typeof slot.document_type === "string" && slot.document_type) ||
        (typeof slot.type === "string" && slot.type) ||
        (typeof slot.slot === "string" && slot.slot);
      if (!typeRaw || !String(typeRaw).trim()) continue;
      const key = String(typeRaw).trim();
      documentRequiredByType[key] = Boolean(slot.required);
    }
  }

  return { categoryLabels, documentRequiredByType };
}

/** Resolve API slot key to our document type when keys match (e.g. HSE_CERTIFICATE). */
export function slotRequiredForDocType(
  docType: VendorDocumentType,
  documentRequiredByType: Record<string, boolean>,
): boolean | undefined {
  if (documentRequiredByType[docType] !== undefined) {
    return documentRequiredByType[docType];
  }
  const lower = docType.toLowerCase();
  for (const [k, v] of Object.entries(documentRequiredByType)) {
    if (k === docType || k.toLowerCase() === lower) return v;
  }
  return undefined;
}

export function effectiveVendorDocumentRequired(
  doc: VendorDocumentRequirement,
  isOEMRepresentative: boolean,
  documentRequiredByType: Record<string, boolean>,
): boolean {
  if (doc.isOEMOnly && !isOEMRepresentative) return false;
  const fromApi = slotRequiredForDocType(doc.type, documentRequiredByType);
  if (fromApi !== undefined) return Boolean(fromApi);
  return Boolean(doc.isRequired);
}
