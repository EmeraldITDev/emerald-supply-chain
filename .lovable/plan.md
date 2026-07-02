## Frontend Performance Audit — Findings & Fix Plan

### Current state (audit)

**Good — already in place**
- Route-based code splitting via `src/routes/lazyPages.ts` (every heavy page is lazy) with `Suspense` + `PageLoader` and chunk-reload self-heal in `safeLazyImport`.
- Central React Query client with `refetchOnWindowFocus: false`, `retry: 1`, `staleTime` presets (STABLE / LIST / REPORT / WORKFLOW) and a `usePaginatedListQuery` wrapper using `keepPreviousData`.
- Skeleton primitives exist (`LoadingSkeleton.tsx`, `Skeleton`).

**Bottlenecks found**
1. **No list virtualization anywhere.** `rg` for `react-window/react-virtual` returns 0 matches. Pages like `Procurement.tsx` (5,459 lines), `SupplyChainDashboard.tsx` (2,101), `VendorPortal.tsx` (2,907), `Vendors.tsx` (1,848), `RFQManagement.tsx` (2,350) render entire lists as DOM rows. This is the #1 cause of UI freezes on large datasets.
2. **Waterfall fetching.** Several pages/components call `useEffect` + `apiRequest` directly instead of React Query, so child fetches only start after the parent renders. Also many `useApi`/`useQuery` bespoke hooks bypass caching.
3. **QueryClient tuned aggressively for lists.** Default `staleTime = 2 min` is fine, but many list pages don't set `placeholderData: keepPreviousData` outside `usePaginatedListQuery`, causing full skeletons on every page change.
4. **No optimistic updates.** Mutations (delete MRF, discard draft, mark selected supplier, etc.) invalidate then wait for refetch — feels laggy. `optimisticallyRemoveMrfFromCache` exists but isn't used in most mutation flows.
5. **Loading UX regressions.** Many pages show `<Loader2>` spinners or blank sections instead of contextual skeletons; buttons don't show pending state during mutations.
6. **Bundle.** Heavy libs (`xlsx`, `jspdf`, `recharts`) are eagerly imported in some utilities. Export/print helpers should be dynamic-imported.

### Immediate fixes (this batch)

1. **Install and adopt `@tanstack/react-virtual`** (headless, ~4KB).
   - New shared component `src/components/ui/VirtualizedTable.tsx` (windowed `<tbody>` rows with sticky header, keeps existing `<Table>` shadcn styling).
   - Wire into the biggest offenders: `Procurement.tsx` MRF list + PO list, `SupplyChainDashboard.tsx` main tabs, `Vendors.tsx` directory table. Feature-flag behind row-count threshold (>50 rows) so small lists stay unvirtualized.

2. **React Query tuning**
   - Bake `placeholderData: keepPreviousData` into `queryClient` defaults so every paginated list keeps prior data during refetch (removes flicker).
   - Add `refetchOnMount: 'always'` off for STABLE preset (already there), verify LIST preset.
   - Add `structuralSharing: true` (default) + narrow retry to `(failureCount, err) => !is4xx(err) && failureCount < 1`.

3. **Optimistic updates helper**
   - New `src/lib/optimisticMutation.ts` with `optimisticListRemove`, `optimisticListUpdate`, `optimisticListInsert` helpers keyed by `queryKeys.*.all`.
   - Wire into: MRF delete, PO discard draft, RFQ status change, vendor rating.

4. **Waterfall fixes / parallel prefetch**
   - `Procurement.tsx`: hoist the `MRFs` + `POs` + `RFQs` queries so tabs share cached data and switching tabs is instant (they're all under `queryKeys.*.all`, just needs to be enabled on mount instead of on tab activation).
   - Add `queryClient.prefetchQuery` on hover of the primary sidebar links in `AppSidebar.tsx` for the top 5 modules.

5. **Perceived performance**
   - Replace `<Loader2 />` spinners in the main list containers with `<TableSkeleton />` / `<CardSkeleton />` from `LoadingSkeleton.tsx`.
   - Add a shared `<PendingButton />` wrapper that flips to spinner + disabled while `isPending`, and apply to the most-used mutation buttons (Approve, Sign PO, Delete, Save Draft).

6. **Bundle trimming**
   - Convert `xlsx`, `jspdf`, and PDF renderers (`emeraldPOPdf`, `jccPdf`, `grnPdf`) to lazy dynamic imports in the action helpers so they're only pulled in when Export / Preview / Download is invoked.

### Explicitly deferred (call out, don't touch this pass)
- Refactoring individual 2K+ line page components into smaller ones (invasive, high regression risk).
- Server-side pagination for endpoints that still return unbounded lists (needs backend).
- Replacing `recharts` with a lighter chart lib.

### Deliverables
- Code changes above.
- Updated `.lovable/plan.md` (new Batch 6 — Performance) and `frontend_changes.md` audit summary + backend asks (none critical; note request to add `X-Total-Count` on any still-unpaginated list endpoints).

### Success signals
- Large tables (>500 rows) scroll at 60fps without freezes.
- Tab switches inside `Procurement.tsx` render cached data instantly.
- Delete/discard actions remove the row before the network round-trip.
- Initial JS bundle drops by ~30% (xlsx + jspdf moved out of critical path).

Approve to proceed, or tell me to trim/expand any section (e.g. skip bundle trimming, or add virtualization to more pages).