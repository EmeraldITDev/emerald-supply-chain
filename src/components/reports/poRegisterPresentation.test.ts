import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { chronologicalMonths, rankedVendorGroups, formatRegisterMoney } from "./poRegisterPresentation";

describe("PO Register presentation rules", () => {
  test("sorts actual year/month oldest first across year boundaries", () => {
    const rows = ["2026-10", "2026-09", "2025-12", "2026-01"].map((month) => ({ month, count: 7, valueByCurrency: [] }));
    assert.deepEqual(chronologicalMonths(rows).map((row) => row.month), ["2025-12", "2026-01", "2026-09", "2026-10"]);
    assert.equal(rows[0].month, "2026-10");
  });
  test("preserves exact counts and does not invent missing months", () => {
    const result = chronologicalMonths([{ month: "Oct 2026", count: 19, valueByCurrency: [] }, { month: "Sep 2026", count: 0, valueByCurrency: [] }]);
    assert.deepEqual(result.map(({ label, count }) => ({ label, count })), [{ label: "Sep 2026", count: 0 }, { label: "Oct 2026", count: 19 }]);
    assert.deepEqual(chronologicalMonths([]), []);
  });
  test("ranks highest first separately within NGN and USD without combining totals", () => {
    const groups = [{ currency: "NGN", vendors: [{ name: "A", totalPoValue: 750000, poCount: 1 }, { name: "B", totalPoValue: 2500000, poCount: 2 }] }, { currency: "USD", vendors: [{ name: "C", totalPoValue: 1200000, poCount: 3 }] }];
    assert.deepEqual(rankedVendorGroups(groups).map((group) => [group.currency, group.vendors.map((v) => v.totalPoValue)]), [["NGN", [2500000, 750000]], ["USD", [1200000]]]);
    assert.equal(groups[0].vendors[0].name, "A");
  });
  test("formats accurate compact currency values and exact tooltip amounts", () => {
    assert.equal(formatRegisterMoney(2500000, "NGN", true), "₦2.5M");
    assert.equal(formatRegisterMoney(750000, "NGN", true), "₦750K");
    assert.equal(formatRegisterMoney(1200000, "USD", true), "$1.2M");
    assert.equal(formatRegisterMoney(2500000.25, "NGN"), "₦2,500,000.25");
  });
});