

# Implementation Order Note — DepartmentDashboard.tsx

The user's observation is correct. The three changes to `DepartmentDashboard.tsx` are independent and should be implemented in this order:

1. **Tab query param reading** — Read `?tab=` from URL, use as default tab value. Smallest change, no dependencies, easy to verify by navigating to `/department?tab=annual`.

2. **Rejected badge** — Add red "Rejected" badge with XCircle icon on MRF cards where status is "rejected". Pure display logic, no backend dependency.

3. **Edit & Resubmit dialog** — Build the pre-populated edit form and wire it to `mrfApi.resubmit()`. Backend-blocked — the dialog renders but submit will fail until `POST /mrfs/{id}/resubmit` exists.

This ordering ensures each piece can be tested in isolation. If the Edit & Resubmit dialog has issues, the tab routing and rejected badge are already confirmed working.

No other changes to the plan. Ready to execute all 9 files in the order specified, with DepartmentDashboard following this sub-sequence.

