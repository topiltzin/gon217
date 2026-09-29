import { expect, test } from "@playwright/test";

for (const path of ["/nope", "/games/unknown"]) {
  test(`${path} shows a friendly 404 with a way home`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /oops/i })).toBeVisible();
    await page.getByRole("link", { name: /take me home/i }).click();
    await expect(page).toHaveURL(/\/en$/);
  });
}
