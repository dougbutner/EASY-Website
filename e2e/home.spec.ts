import { expect, test } from "@playwright/test";

test("home page shows title", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /XPR Network multi login template/i })).toBeVisible();
});
