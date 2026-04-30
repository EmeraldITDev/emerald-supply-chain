## What's wrong

Two separate bugs visible in the screenshots:

### Bug 1 — Sidebar overlaps content + leaves a vertical gap

The collapsed sidebar (icon rail) creates a blank vertical strip on the left of the page, while the actual page content (headings, stat cards, tables) slides **underneath** it. Visible symptoms in the first screenshot: "ogistics Management", "leet Management", clipped stat-card titles, tabs hidden under the rail.

**Root cause** — `src/components/layout/DashboardLayout.tsx`, line 62:

```tsx
<div className="flex min-h-screen w-full">
  <AppSidebar />
  <div className="flex-1 flex flex-col w-full">   {/* ← bug */}
```

Shadcn's `Sidebar` (default `collapsible="offcanvas"`) renders its visible panel as `position: fixed` and reserves horizontal space via a sibling spacer div sized at `--sidebar-width` (or the icon-rail width when collapsed). The content column uses `flex-1` **and** `w-full`. The `w-full` forces the flex child to 100% of the parent, overriding the spacer; content drifts left under the fixed sidebar.

### Bug 2 — Fleet table is too wide vs. other logistics tables

Second screenshot shows the Fleet table extending past the viewport (column "Driv…" cut off), unlike Trips/Journeys tables on the same module which fit normally.

**Root cause** — `src/components/logistics/FleetManagement.tsx`, lines 736–738:

```tsx
<div className="w-full overflow-x-auto">
  <div className="max-w-[1118px]">           {/* ← bug */}
    <Table className="w-full table-auto">
```

The inner `max-w-[1118px]` wrapper forces the table to a hardcoded 1118px regardless of its container. Sibling tables (`TripScheduling.tsx` line 895, `JourneyManagement.tsx`) use a single `overflow-x-auto` wrapper with no inner width constraint and a normal `<Table>` — they shrink/scroll to fit naturally.

## The fixes

### Fix 1 — `src/components/layout/DashboardLayout.tsx` (line 62)

Before:
```tsx
<div className="flex-1 flex flex-col w-full">
```

After:
```tsx
<div className="flex-1 flex flex-col min-w-0">
```

- Remove `w-full` so the sidebar spacer reserves its column correctly.
- Add `min-w-0` so wide content (tables, breadcrumbs) shrinks instead of forcing horizontal overflow — standard flexbox idiom.

### Fix 2 — `src/components/logistics/FleetManagement.tsx` (lines 736–760)

Remove the `<div className="max-w-[1118px]">` wrapper entirely so the table matches the pattern used by `TripScheduling` and `JourneyManagement`:

Before:
```tsx
<div className="w-full overflow-x-auto">
  <div className="max-w-[1118px]">
    <Table className="w-full table-auto">
      ...
    </Table>
  </div>
</div>
```

After:
```tsx
<div className="overflow-x-auto">
  <Table>
    ...
  </Table>
</div>
```

This matches the existing logistics-table standard (memory: Logistics UI Standards — wide tables scroll horizontally inside their card).

## Why this works

```text
Layout row:
[ Sidebar wrapper (icon rail or 16rem) ][ Content column = flex-1, min-w-0 ]
  ↑ spacer reserves width                ↑ takes remaining space, can shrink
  + fixed panel sits over its spacer       (no w-full overriding it)
```

With the table fix, Fleet inherits the same responsive behavior as Trips/Journeys: it sizes to its card; if columns exceed available width, the card scrolls horizontally rather than the page.

## Out of scope

- No changes to padding values
- No changes to `AppSidebar`, the `Sidebar` primitive, or any page file
- No changes to Fleet table columns, data, or actions — only the wrapper is removed
- Other logistics tables already follow the correct pattern; not touched
