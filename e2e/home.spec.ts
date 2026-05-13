import { expect, test } from "@playwright/test";

test("home page shows EASY tools", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /EASY Tools/i })).toBeVisible();
});
