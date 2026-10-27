import { describe, expect, test } from "bun:test";
import { chronologicalMonths, rankedVendorGroups, formatRegisterMoney } from "./poRegisterPresentation";

describe("PO Register presentation rules", () => {
  test("sorts actual year/month oldest first across year boundaries", () => {
    const rows = ["2026-10", "2026-09", "2025-12", "2026-01"].map((month) => ({ month, count: 7, valueByCurrency: [] }));
    expect(chronologicalMonths(rows).map((row) => row.month)).toEqual(["2025-12", "2026-01", "2026-09", "2026-10"]);
    expect(rows[0].month).toBe("2026-10");
  });
  test("preserves exact counts and does not invent missing months", () => {
    const result = chronologicalMonths([{ month: "Oct 2026", count: 19, valueByCurrency: [] }, { month: "Sep 2026", count: 0, valueByCurrency: [] }]);
    expect(result.map(({ label, count }) => ({ label, count }))).toEqual([{ label: "Sep 2026", count: 0 }, { label: "Oct 2026", count: 19 }]);
    expect(chronologicalMonths([])).toEqual([]);
  });
  test("ranks highest first separately within NGN and USD without combining totals", () => {
    const groups = [{ currency: "NGN", vendors: [{ name: "A", totalPoValue: 750000, poCount: 1 }, { name: "B", totalPoValue: 2500000, poCount: 2 }] }, { currency: "USD", vendors: [{ name: "C", totalPoValue: 1200000, poCount: 3 }] }];
    expect(rankedVendorGroups(groups).map((group) => [group.currency, group.vendors.map((v) => v.totalPoValue)])).toEqual([["NGN", [2500000, 750000]], ["USD", [1200000]]]);
    expect(groups[0].vendors[0].name).toBe("A");
  });
  test("formats accurate compact currency values and exact tooltip amounts", () => {
    expect(formatRegisterMoney(2500000, "NGN", true)).toBe("₦2.5M");
    expect(formatRegisterMoney(750000, "NGN", true)).toBe("₦750K");
    expect(formatRegisterMoney(1200000, "USD", true)).toBe("$1.2M");
    expect(formatRegisterMoney(2500000.25, "NGN")).toBe("₦2,500,000.25");
  });
});