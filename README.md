# Emerald Supply Chain — Frontend

Web app for Emerald's Supply Chain Management (SCM) platform: procurement, vendors, logistics, warehouse and reporting.

Backend API: [`supply-chain-backend`](../../Backend/supply-chain-backend) (Laravel).

## Tech stack

React 18 · TypeScript · Vite · Tailwind CSS + shadcn/ui · TanStack React Query · Playwright

## Getting started

Requires Node.js 18+ and a running backend.

```bash
npm install
cp .env.example .env    # set VITE_API_BASE_URL
npm run dev             # http://localhost:8080
```

### Environment

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend API URL, **including `/api`** (e.g. `http://localhost:8000/api`) |
| `VITE_ENV` | `development` or `production` |
| `VITE_FINANCE_AP_CUTOVER_DATE` | Optional; must match the backend's `FINANCE_AP_CUTOVER_DATE` |
| `TEST_*_EMAIL` / `TEST_*_PASSWORD` | Test-account credentials for Playwright |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npx playwright test` | Run end-to-end tests in `tests/` |

## Modules

- **Procurement:** MRFs, SRFs, RFQs, quotations, purchase orders, GRNs
- **Vendors:** registration, onboarding, vendor portal and invoices
- **Logistics:** trip requests, fleet, drivers, journeys, material movements
- **Warehouse:** inventory and stock movements
- **Finance and reports:** Finance AP sync, payment schedules, procurement and executive dashboards

## Project structure

```
src/
  pages/        Route-level screens
  components/   UI components, grouped by module
  services/     API clients (api.ts, procurementApi.ts, logisticsApi.ts, …)
  hooks/        Shared React hooks
  lib/          React Query setup, cache keys, helpers
  types/        Shared TypeScript types
  utils/        Formatting, PDF and workflow helpers
tests/          Playwright specs
```

## Deployment

Hosted on **Vercel**. `vercel.json` rewrites every route to `index.html` so client-side routing works. Set `VITE_API_BASE_URL` in the Vercel project settings.

Every push and pull request to `main` runs the Playwright tests in GitHub Actions (`.github/workflows/playwright.yml`).

Changes made in Lovable are committed to this repository automatically.
