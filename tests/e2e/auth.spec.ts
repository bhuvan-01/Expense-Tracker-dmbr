import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function signup(page: Page, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Your name", { exact: true }).fill("Alex Morgan");
  await page.getByLabel("Email address", { exact: true }).fill(email);
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
}

test("signup, reload, sign-out, sign-in, and protected navigation", async ({
  page,
}) => {
  const email = `browser-${Date.now()}@example.com`;
  await page.goto("/app");
  await expect(page).toHaveURL("/sign-in");
  await signup(page, email);
  await expect(
    page.getByRole("heading", { name: "Welcome, Alex." }),
  ).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Welcome, Alex." }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("/sign-in");
  await page.goto("/app");
  await expect(page).toHaveURL("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("incorrect password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "email or password is incorrect",
  );
  await expect(page.getByLabel("Email address")).toHaveValue(email);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await page
    .getByLabel("Password", { exact: true })
    .fill("a memorable test password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/app");
});

test("phone signup validation, password visibility, keyboard, and accessibility", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/sign-up");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByLabel("Your name", { exact: true })).toBeFocused();
  await expect(
    page.getByText("Enter your name using 1–80 characters."),
  ).toBeVisible();
  await page.getByLabel("Your name", { exact: true }).fill("Alex");
  await page.getByLabel("Email address").fill("alex@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("a memorable test password");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("different password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByLabel("Confirm password", { exact: true }),
  ).toBeFocused();
  await expect(page.getByText("Your passwords do not match.")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Leave this form?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Keep editing" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(page).toHaveURL("/sign-in");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
});

test("network failures preserve entered signup details and allow a retry", async ({
  page,
}) => {
  await page.goto("/sign-up");
  await page.getByLabel("Your name", { exact: true }).fill("Alex");
  await page.getByLabel("Email address").fill("offline@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("a memorable test password");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("a memorable test password");
  await page.route("**/api/auth/sign-up/email", (route) =>
    route.abort("failed"),
  );
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveValue(
    "offline@example.com",
  );
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
    "a memorable test password",
  );
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toBeEnabled();
});

test("desktop sign-in is accessible and scales without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/sign-in");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  // A 720px CSS viewport exercises the reflow of a 1440px viewport at 200% zoom.
  await page.setViewportSize({ width: 720, height: 500 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
});
