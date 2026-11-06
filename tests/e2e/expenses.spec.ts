import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.setTimeout(90_000);
async function account(page: Page, label: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Your name", { exact: true }).fill("Alex Ledger");
  await page
    .getByLabel("Email address")
    .fill(`${label}-${Date.now()}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("a memorable test password");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("a memorable test password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL("/app");
  await page.getByLabel("Workspace currency").selectOption("GBP");
  await page.getByLabel("Your timezone").selectOption("Europe/London");
  await page.getByRole("button", { name: "Start tracking" }).click();
  await expect(
    page.getByRole("heading", { name: "Your expense history" }),
  ).toBeVisible();
}
async function fillExpense(page: Page, merchant: string, amount = "12.34") {
  await page.getByLabel("Amount (GBP)", { exact: true }).fill(amount);
  await page
    .getByRole("dialog", { name: "Add expense", exact: true })
    .getByLabel("Category", { exact: true })
    .selectOption({ label: "Groceries" });
  await page.getByLabel("Date", { exact: true }).fill("2026-10-28");
  await page.getByLabel("Merchant or description (optional)").fill(merchant);
}
async function a11y(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
}

test("desktop setup, expense CRUD, category creation, search, filters and totals", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await account(page, "ledger-desktop");
  await page
    .getByRole("button", { name: "Workspace settings", exact: true })
    .click();
  await expect(page.getByLabel("Workspace currency")).toBeEnabled();
  await page.getByLabel("Your timezone").selectOption("UTC");
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(
    page.getByRole("dialog", { name: "Leave this form?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Small steps. A clearer picture." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await page.getByRole("button", { name: "Save expense", exact: true }).click();
  await expect(page.getByLabel("Amount (GBP)", { exact: true })).toBeFocused();
  await fillExpense(page, "Corner market");
  await page.getByLabel("Note (optional)").fill("Keep this search private");
  await a11y(page);
  await page.getByRole("button", { name: "Save expense", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Corner market" }),
  ).toContainText("£12.34");
  await page
    .getByRole("button", { name: "Workspace settings", exact: true })
    .click();
  await expect(page.getByLabel("Workspace currency")).toBeDisabled();
  await a11y(page);
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Expense added." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "Corner market" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit Corner market" }).click();
  await page.getByLabel("Amount (GBP)", { exact: true }).fill("15.50");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Corner market" }),
  ).toContainText("£15.50");
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await fillExpense(page, "Pet shop", "4.50");
  await page.getByText("Add a new category", { exact: true }).click();
  await page.getByLabel("New category name").fill("Pet supplies");
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Category", { exact: true }),
  ).not.toHaveValue("");
  await page.getByRole("button", { name: "Save expense", exact: true }).click();
  await expect(page.locator(".history-total")).toContainText("£20.00");
  await page.getByLabel("Search expenses").fill("search private");
  await expect(
    page.getByRole("row").filter({ hasText: "Pet shop" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Corner market" }),
  ).toBeVisible();
  expect(page.url()).not.toContain("search");
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.getByLabel("Search expenses")).toBeFocused();
  await expect(
    page.getByRole("row").filter({ hasText: "Pet shop" }),
  ).toBeVisible();
  await page
    .getByLabel("Category", { exact: true })
    .selectOption({ label: "Pet supplies" });
  await expect(page.locator(".history-total")).toContainText("£4.50");
  await page.reload();
  await expect(page.getByLabel("Category", { exact: true })).not.toHaveValue(
    "",
  );
  await expect(page.locator(".history-total")).toContainText("£4.50");
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page.getByLabel("Sort expenses").selectOption("amount_asc");
  await expect(page.getByRole("row").nth(1)).toContainText("Pet shop");
  await a11y(page);
  await page.screenshot({
    path: ".data/expense-ledger-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Delete Pet shop" }).click();
  await expect(
    page.getByRole("button", { name: "Keep expense" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Keep expense" }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Pet shop" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete Pet shop" }).click();
  await page
    .getByRole("button", { name: "Delete expense", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "Pet shop" }),
  ).not.toBeVisible();
  await expect(page.locator(".history-total")).toContainText("£15.50");
  await page
    .getByRole("button", { name: "Record refund for Corner market" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Record refund", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Amount (GBP)", { exact: true }).fill("5.50");
  await page.getByRole("button", { name: "Save refund", exact: true }).click();
  await page.getByRole("button", { name: "Refunds", exact: true }).click();
  await expect(page.locator(".history-total")).toContainText("£5.50");
  await a11y(page);
  await page.getByRole("button", { name: "Income", exact: true }).click();
  await page.getByRole("button", { name: "Add income", exact: true }).click();
  await page.getByLabel("Amount (GBP)", { exact: true }).fill("2000");
  await page
    .getByLabel("Source or description (optional)")
    .fill("Monthly salary");
  await page.getByRole("button", { name: "Save income", exact: true }).click();
  await expect(page.locator(".history-total")).toContainText("£2,000.00");
  await page
    .getByRole("button", { name: "Manage categories", exact: true })
    .click();
  await page.getByLabel("Choose category").selectOption({ label: "Groceries" });
  await page.getByLabel("Category name", { exact: true }).fill("Food shopping");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Category renamed" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Archive category", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Archive Food shopping?" })
    .getByRole("button", { name: "Archive category", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Restore category", exact: true }),
  ).toBeVisible();
  await a11y(page);
  await page
    .getByRole("button", { name: "Close categories", exact: true })
    .click();
  await page.getByRole("button", { name: "Expenses", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Corner market" }),
  ).toContainText("Food shopping");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByLabel("Overview month", { exact: true }).fill("2026-11");
  await expect(page.locator(".monthly-difference")).toContainText("£2,005.50");
  await expect(page.locator(".summary-grid")).toContainText("-£5.50");
  await page.getByLabel("Overview month", { exact: true }).fill("2026-10");
  await expect(page.locator(".summary-grid")).toContainText("£15.50");
  await a11y(page);
  await page.screenshot({
    path: ".data/monthly-overview-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 780 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await a11y(page);
  await page.screenshot({
    path: ".data/monthly-overview-phone.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Budgets", exact: true }).click();
  await page.getByLabel("Budget month", { exact: true }).fill("2026-10");
  await page
    .getByRole("button", { name: "Set overall budget", exact: true })
    .click();
  await page.getByLabel("Budget amount (GBP)").fill("10");
  await page.getByRole("button", { name: "Save budget", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "Overall budget", exact: true }),
  ).toContainText("£5.50 over budget");
  await page
    .getByRole("button", { name: "Set Food shopping budget", exact: true })
    .click();
  await page.getByLabel("Budget amount (GBP)").fill("20");
  await page.getByRole("button", { name: "Save budget", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "Food shopping", exact: true }),
  ).toContainText("£4.50 remaining");
  await a11y(page);
  await page.screenshot({ path: ".data/budgets-phone.png", fullPage: true });
  await page
    .getByRole("button", { name: "Edit overall budget", exact: true })
    .click();
  await page.getByLabel("Budget amount (GBP)").fill("0");
  await page.getByRole("button", { name: "Save budget", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "Overall budget", exact: true }),
  ).toContainText("£15.50 over budget");
  await page
    .getByRole("button", { name: "Edit overall budget", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove budget limit", exact: true })
    .click();
  await page.getByRole("button", { name: "Remove limit", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "Overall budget", exact: true }),
  ).toContainText("No limit set");
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  await page.getByLabel("Report month", { exact: true }).fill("2026-11");
  await expect(page.locator(".report-table tfoot")).toContainText("£2,005.50");
  await a11y(page);
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download monthly CSV", exact: true })
    .click();
  const download = await downloadEvent;
  await download.saveAs(".data/month-report-test.csv");
  const csv = await readFile(".data/month-report-test.csv", "utf8");
  expect(csv).toContain('"income"');
  expect(csv).toContain('"refund"');
  expect(csv).toContain("Monthly salary");
  expect(csv).not.toContain('"expense"');
  await expect(
    page.getByRole("status").filter({ hasText: "CSV download started" }),
  ).toBeVisible();
  await page.screenshot({ path: ".data/reports-phone.png", fullPage: true });
  await page.getByRole("button", { name: "Expenses", exact: true }).click();
  await page.getByLabel("Search expenses").fill("Corner market");
  await expect(page.locator(".result-count")).toContainText(
    "1 expense matching",
  );
  const filteredEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export this view", exact: true })
    .click();
  await (await filteredEvent).saveAs(".data/history-export-test.csv");
  expect(await readFile(".data/history-export-test.csv", "utf8")).toContain(
    "Corner market",
  );
});

test("phone forms preserve input and retry a lost successful save without duplicates", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await account(page, "ledger-phone");
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await fillExpense(page, "Coffee on the way home", "2.80");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Leave this form?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByLabel("Amount (GBP)", { exact: true })).toHaveValue(
    "2.80",
  );
  await a11y(page);
  let key = "";
  await page.route(
    "**/api/expenses",
    async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      key = route.request().headers()["idempotency-key"];
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      // The server committed the write, but its response never reaches the client.
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Save expense", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Unable to connect");
  await expect(
    page.getByLabel("Merchant or description (optional)"),
  ).toHaveValue("Coffee on the way home");
  const retry = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/expenses") && request.method() === "POST",
  );
  await page.getByRole("button", { name: "Save expense", exact: true }).click();
  expect((await retry).headers()["idempotency-key"]).toBe(key);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".result-count")).toContainText(
    "1 expense recorded",
  );
  await expect(page.locator(".history-total")).toContainText("£2.80");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await a11y(page);
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await page.screenshot({
    path: ".data/add-expense-phone.png",
    fullPage: false,
  });
  await page.getByLabel("Amount (GBP)", { exact: true }).fill("3.00");
  await page.getByRole("button", { name: "Close expense form" }).click();
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add expense", exact: true }),
  ).toBeFocused();
  await page.screenshot({
    path: ".data/expense-ledger-phone.png",
    fullPage: true,
  });
});

test("edit conflicts, delete failures and expired sessions keep recovery available", async ({
  page,
}) => {
  await account(page, "ledger-recovery");
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await fillExpense(page, "Train ticket", "10.00");
  await page.getByRole("button", { name: "Save expense", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Train ticket" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit Train ticket" }).click();
  const history = await (await page.request.get("/api/expenses")).json();
  const expense = history.items[0];
  const update = await page.request.patch(`/api/expenses/${expense.id}`, {
    headers: { Origin: new URL(page.url()).origin },
    data: {
      currency: expense.currency,
      amount: "11.00",
      date: expense.date,
      categoryId: expense.categoryId,
      merchant: expense.merchant,
      version: expense.version,
    },
  });
  expect(update.status()).toBe(200);
  await page.getByLabel("Amount (GBP)", { exact: true }).fill("12.00");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("changed elsewhere");
  await expect(page.getByLabel("Amount (GBP)", { exact: true })).toHaveValue(
    "12.00",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Discard changes" }).click();
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "Train ticket" }),
  ).toContainText("£11.00");
  await page.getByRole("button", { name: "Delete Train ticket" }).click();
  await page.route("**/api/expenses/*", (route) =>
    route.request().method() === "DELETE"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Unable to delete. Try again." }),
        })
      : route.continue(),
  );
  await page
    .getByRole("button", { name: "Delete expense", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Unable to delete");
  await expect(
    page.getByRole("dialog", { name: "Delete this expense?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep expense" }).click();
  await page.unroute("**/api/expenses/*");
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  await fillExpense(page, "Session recovery", "3.00");
  await page.request.post("/api/auth/sign-out", {
    headers: { Origin: new URL(page.url()).origin },
    data: {},
  });
  await page.getByRole("button", { name: "Save expense", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("session has expired");
  await expect(
    page.getByRole("link", { name: "Sign in in a new tab" }),
  ).toBeVisible();
  await expect(page.getByLabel("Amount (GBP)", { exact: true })).toHaveValue(
    "3.00",
  );
});

test("pagination, empty results and failed history requests recover without losing context", async ({
  page,
}) => {
  await account(page, "ledger-pagination");
  const workspace = await (await page.request.get("/api/workspace")).json();
  for (let i = 0; i < 26; i++) {
    const response = await page.request.post("/api/expenses", {
      headers: {
        Origin: new URL(page.url()).origin,
        "Idempotency-Key": crypto.randomUUID(),
      },
      data: {
        currency: workspace.preferences.currency,
        amount: "1.00",
        date: "2026-10-28",
        categoryId: workspace.categories[0].id,
        merchant: `Purchase ${i}`,
      },
    });
    expect(response.status()).toBe(201);
  }
  await page.reload();
  await expect(page.locator(".result-count")).toContainText("26 expenses");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your expense history" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page.getByLabel("Search expenses").fill("nothing-matches");
  await expect(
    page.getByRole("heading", { name: "No matching expenses" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.locator(".result-count")).toContainText("26 expenses");
  await page.route(
    "**/api/expenses/search",
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unable to load expenses." }),
      }),
    { times: 1 },
  );
  await page.getByLabel("Sort expenses").selectOption("amount_asc");
  await expect(page.getByRole("alert")).toContainText(
    "Showing the last loaded results",
  );
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("alert")).not.toBeVisible();
  await expect(page.locator(".result-count")).toContainText("26 expenses");
});
