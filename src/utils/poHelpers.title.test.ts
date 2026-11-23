import { describe, expect, it } from "vitest";
import {
  canEditPoTitle,
  isPoAwaitingRenewedApproval,
  isPoPendingRevision,
} from "./poHelpers";

describe("PO title helpers", () => {
  it("allows procurement manager and supply chain director to edit titles", () => {
    expect(canEditPoTitle("procurement_manager")).toBe(true);
    expect(canEditPoTitle("supply_chain_director")).toBe(true);
    expect(canEditPoTitle("employee")).toBe(false);
  });

  it("flags revised POs awaiting renewed approval", () => {
    expect(
      isPoAwaitingRenewedApproval({
        revision_number: 1,
        status: "pending_scd_signature",
        awaiting_renewed_approval: true,
      }),
    ).toBe(true);

    expect(
      isPoAwaitingRenewedApproval({
        revision_number: 0,
        status: "pending_scd_signature",
      }),
    ).toBe(false);

    expect(
      isPoPendingRevision({
        status: "pending_revision",
        workflow_state: "pending_revision",
      }),
    ).toBe(true);
  });
});
