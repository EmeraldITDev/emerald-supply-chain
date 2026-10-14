/**
 * Role-rule checks for quickbooksLogic (matches backend QuickBooksRoles).
 * Run: npx tsx src/components/quickbooks/quickbooksLogic.roleRules.test.ts
 */
import assert from "node:assert/strict";
import {
  canAccessQuickBooks,
  canConnect,
  canDisconnect,
  canUseSetupHelper,
  QUICKBOOKS_CONNECTION_ROLES,
  QUICKBOOKS_SYNC_ROLES,
} from "./quickbooksLogic";

const connectionAllowed = ["admin", "procurement_manager", "supply_chain_director", "supply_chain"] as const;
const connectionDenied = ["procurement", "logistics_manager", "finance", "employee", null, ""] as const;

assert.deepEqual([...QUICKBOOKS_CONNECTION_ROLES], [...connectionAllowed]);
assert.ok(QUICKBOOKS_SYNC_ROLES.includes("procurement"));

for (const role of connectionAllowed) {
  assert.equal(canConnect(role), true, `canConnect(${role})`);
  assert.equal(canDisconnect(role), true, `canDisconnect(${role})`);
  assert.equal(canUseSetupHelper(role), true, `canUseSetupHelper(${role})`);
}

for (const role of connectionDenied) {
  assert.equal(canConnect(role), false, `canConnect(${String(role)}) denied`);
  assert.equal(canDisconnect(role), false, `canDisconnect(${String(role)}) denied`);
  assert.equal(canUseSetupHelper(role), false, `canUseSetupHelper(${String(role)}) denied`);
}

assert.equal(canAccessQuickBooks("procurement"), true);
assert.equal(canConnect("procurement"), false, "procurement officer cannot connect");
assert.equal(canAccessQuickBooks("finance"), false);

console.log("quickbooksLogic role rules: ok");
