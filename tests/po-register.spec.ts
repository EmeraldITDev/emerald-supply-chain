import { expect, test } from "@playwright/test";

const appUrl = "http://localhost:8080";
const registerRow = {
  id: 401,
  poNumber: "PO-TEST-401",
  poVersion: 2,
  mrfNumber: "MRF-TEST-401",
  title: "Maintenance supplies",
  vendorName: "Acme Supplies",
  department: "Operations",
  contractType: "Direct",
  currency: "NGN",
  poValue: 125000,
  taxAmount: 9375,
  poGenerationDate: "2026-10-02",
  poSigningDate: "2026-10-03",
  approvalStatus: "approved",
  signingStatus: "Signed",
  paymentStatus: "Pending",
  grnStatus: "Pending",
  expectedDeliveryDate: "2026-11-01",
  signedPoUrl: null,
  unsignedPoUrl: null,
  procurementManager: "Test Manager",
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const user = {
      id: 17,
      name: "PO Register Test User",
      email: "po-register-test@example.invalid",
      role: "procurement_manager",
      supply_chain_role: "procurement_manager",
      department: "Procurement",
    };
    localStorage.setItem("authToken", "playwright-test-token");
    localStorage.setItem("userData", JSON.stringify(user));
    localStorage.setItem("tokenExpiry", new Date(Date.now() + 60 * 60 * 1000).toISOString());
  });

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;

    if (pathname.endsWith("/reports/po-register/export")) {
      const extension = url.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
      await route.fulfill({
        status: 200,
        contentType: extension === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        body: `test ${extension} content`,
      });
      return;
    }

    if (pathname.endsWith("/reports/po-register")) {
      await route.fulfill({
        json: {
          success: true,
          data: {
            period: { from: "2026-09-26", to: "2026-10-26" },
            summary: {
              totalGeneratedPos: 1,
              totalPoValue: 125000,
              totalPoValueCurrency: "NGN",
              totalPoValueByCurrency: [{
                currency: "NGN",
                count: 1,
                totalValue: 125000,
                totalTaxAmount: 9375,
                averagePoValue: 125000,
              }],
              signedPos: 1,
              unsignedPos: 0,
              awaitingGrn: 1,
              completedGrn: 0,
              averagePoValue: 125000,
              totalTaxAmount: 9375,
              monthlyTrend: [{ month: "2026-10", count: 1, valueByCurrency: [{ currency: "NGN", totalValue: 125000 }] }],
              topVendorsByCurrency: [{
                currency: "NGN",
                vendors: [{ name: "Acme Supplies", poCount: 1, totalPoValue: 125000 }],
              }],
            },
            items: [registerRow],
            pagination: { page: 1, perPage: 10, total: 1, totalPages: 1, from: 1, to: 1 },
          },
        },
      });
      return;
    }

    if (pathname.endsWith("/reports/procurement/records")) {
      await route.fulfill({
        json: {
          success: true,
          data: {
            period: { from: null, to: null },
            items: [],
            pagination: { page: 1, perPage: 25, total: 0, totalPages: 1, from: null, to: null },
          },
        },
      });
      return;
    }

    if (pathname.endsWith("/reports/dashboard")) {
      await route.fulfill({
        json: {
          success: true,
          data: {
            period: { from: "2026-09-26", to: "2026-10-26" },
            kpis: [],
            recentReports: [],
            scheduledReports: [],
          },
        },
      });
      return;
    }

    if (pathname.endsWith("/auth/me")) {
      await route.fulfill({
        json: {
          success: true,
          data: {
            id: 17,
            name: "PO Register Test User",
            email: "po-register-test@example.invalid",
            supply_chain_role: "procurement_manager",
            role: "procurement_manager",
            department: "Procurement",
          },
        },
      });
      return;
    }

    await route.fulfill({ json: { success: true, data: {} } });
  });
});

test("procurement reports renders a filterable PO register and starts both exports", async ({ page }) => {
  await page.goto(`${appUrl}/reports`);
  await expect(page.getByRole("heading", { name: "Reports & Analytics" })).toBeVisible();
  await page.locator('a[href="/reports/procurement#po-register"]').click();

  await expect(page).toHaveURL(/\/reports\/procurement#po-register$/);
  await expect(page.getByRole("heading", { name: "Generated PO Register" })).toBeVisible();
  await expect(page.getByText("PO-TEST-401")).toBeVisible();
  await expect(page.getByRole("cell", { name: /125,000\.00/ })).toBeVisible();

  const combinedFilterRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname.endsWith("/reports/po-register")
      && url.searchParams.get("vendor") === "Acme"
      && url.searchParams.get("signing_status") === "signed";
  });
  await page.getByLabel("Signing status").selectOption("signed");
  await page.getByLabel("Vendor").fill("Acme");
  await combinedFilterRequest;

  const xlsxDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel" }).first().click();
  expect((await xlsxDownload).suggestedFilename()).toMatch(/\.xlsx$/);

  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF" }).first().click();
  expect((await pdfDownload).suggestedFilename()).toMatch(/\.pdf$/);
});
