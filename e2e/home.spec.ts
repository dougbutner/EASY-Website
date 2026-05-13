import { expect, test } from "@playwright/test";

test("home page shows flex town intro", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/Flex town/i)).toBeVisible();
});
