/**
 * Approval-workspace membership.
 * Run: npx tsx src/utils/mrfDashboardBuckets.pendingApproval.test.ts
 */
import assert from "node:assert/strict";
import type { MRF } from "@/types";
import { PENDING_FOR_ROLE_FLAG } from "./pendingForRoleFlag";
import {
  isExecutivePendingApproval,
  isScdPendingFirstApproval,
} from "./mrfDashboardBuckets";

const mrf = (overrides: Record<string, unknown>): MRF =>
  ({ id: "1", title: "Test", ...overrides }) as MRF;

const stillWaiting = mrf({
  workflow_state: "parallel_first_approval",
  current_stage: "parallel_first_approval",
  status: "pending",
});

assert.equal(isScdPendingFirstApproval(stillWaiting), true);
assert.equal(isExecutivePendingApproval(stillWaiting), true);

// The bug: after first approval the workflow leaves the gate, but the state
// name still contains "approval" or "review", and current_stage can stay stale.
for (const workflow_state of [
  "supply_chain_director_approved",
  "procurement_review",
  "executive_approved",
  "lazarus_director_approval",
  "delivery_confirmation_pending",
]) {
  const approved = mrf({
    workflow_state,
    current_stage: "parallel_first_approval",
    status: "procurement_review",
    first_approval_by_role: "supply_chain_director",
    director_approved_at: "2026-08-27T10:30:00Z",
    [PENDING_FOR_ROLE_FLAG]: true,
  });
  assert.equal(
    isScdPendingFirstApproval(approved),
    false,
    `SCD queue must hide ${workflow_state}`,
  );
  assert.equal(
    isExecutivePendingApproval(approved),
    false,
    `Executive queue must hide ${workflow_state}`,
  );
}

const signedByScdButStuck = mrf({
  workflow_state: "parallel_first_approval",
  current_stage: "parallel_first_approval",
  first_approval_by_role: "supply_chain_director",
  director_approved_at: "2026-08-27T10:30:00Z",
  executive_approved: false,
});
assert.equal(isScdPendingFirstApproval(signedByScdButStuck), false);
assert.equal(isExecutivePendingApproval(signedByScdButStuck), true);

const legacyDirectorReview = mrf({
  current_stage: "supply_chain_director_review",
  status: "pending",
});
assert.equal(isScdPendingFirstApproval(legacyDirectorReview), true);

console.log("mrfDashboardBuckets.pendingApproval: ok");
