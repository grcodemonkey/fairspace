import { expect, test } from "@playwright/test";
import { BRAND_DEFAULTS } from "../src/brand";

test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Fairspace" })).toBeVisible();
  await expect(page).toHaveTitle(BRAND_DEFAULTS.siteName);
});
