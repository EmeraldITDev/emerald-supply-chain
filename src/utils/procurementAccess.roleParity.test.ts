/**
 * PM ↔ SCD operational role parity.
 * Run: npx tsx src/utils/procurementAccess.roleParity.test.ts
 */
import assert from "node:assert/strict";
import {
  isProcurementOperator,
  PROCUREMENT_OPERATOR_ROLES,
} from "./procurementAccess";
import { canUnlockSignedPo } from "./poHelpers";
import { canRaiseMrfFromWarehouse } from "./warehouseAccess";

assert.ok(PROCUREMENT_OPERATOR_ROLES.includes("procurement_manager"));
assert.ok(PROCUREMENT_OPERATOR_ROLES.includes("supply_chain_director"));
assert.ok(PROCUREMENT_OPERATOR_ROLES.includes("supply_chain"));

for (const role of [
  "procurement_manager",
  "procurement",
  "supply_chain_director",
  "supply_chain",
] as const) {
  assert.equal(isProcurementOperator(role), true, `operator:${role}`);
  assert.equal(canUnlockSignedPo(role), true, `unlock:${role}`);
  assert.equal(
    canRaiseMrfFromWarehouse({ supply_chain_role: role }),
    true,
    `warehouse-mrf:${role}`,
  );
}

for (const role of ["finance", "executive", "logistics_manager", "employee"] as const) {
  assert.equal(isProcurementOperator(role), false, `denied:${role}`);
}

assert.equal(isProcurementOperator("employee", { is_admin: true }), true);
assert.equal(canUnlockSignedPo("employee", { is_admin: true }), true);

console.log("procurementAccess.roleParity: ok");
