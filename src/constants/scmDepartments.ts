/**
 * Canonical SCM user-management departments (must match backend DepartmentMatcher::STANDARD_USER_DEPARTMENTS).
 */
export const SCM_USER_DEPARTMENTS = [
  "Business Development",
  "Operations",
  "Finance",
  "IT",
  "Human Resources",
  "Procurement",
  "Executive",
  "Supply Chain",
  "Technical Operations",
] as const;

export type ScmUserDepartment = (typeof SCM_USER_DEPARTMENTS)[number];

const LEGACY_ALIAS_TO_STANDARD: Record<string, ScmUserDepartment> = {
  "business development": "Business Development",
  bd: "Business Development",
  operations: "Operations",
  ops: "Operations",
  finance: "Finance",
  fin: "Finance",
  it: "IT",
  ict: "IT",
  "information technology": "IT",
  "human resources": "Human Resources",
  hr: "Human Resources",
  procurement: "Procurement",
  prc: "Procurement",
  executive: "Executive",
  exe: "Executive",
  "supply chain": "Supply Chain",
  sc: "Supply Chain",
  logistics: "Supply Chain",
  log: "Supply Chain",
  "technical operations": "Technical Operations",
  technical: "Technical Operations",
  teo: "Technical Operations",
  engineering: "Technical Operations",
  eng: "Technical Operations",
  administration: "Operations",
  adm: "Operations",
  marketing: "Business Development",
  mkt: "Business Development",
  legal: "Business Development",
  leg: "Business Development",
};

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

/** Map legacy free-text department labels to a standard option when editing users. */
export function normalizeScmUserDepartment(
  value?: string | null,
): ScmUserDepartment | "" {
  const raw = (value ?? "").trim();
  if (!raw) return "";

  const exact = SCM_USER_DEPARTMENTS.find(
    (d) => d.toLowerCase() === raw.toLowerCase(),
  );
  if (exact) return exact;

  const alias = LEGACY_ALIAS_TO_STANDARD[normalizeKey(raw)];
  return alias ?? "";
}
