import { expect, test } from "@playwright/test";
import { getAnnouncements, getGames } from "../../lib/content";

test.describe("host content", () => {
  test("shows Gonzalo's welcome message", async ({ page }) => {
    await page.goto("/");
    const corner = page.getByRole("region", { name: /from gonzalo/i });
    await expect(corner.getByText(/welcome to my game space/i)).toBeVisible();
  });

  test("lists announcements newest first with dates", async ({ page }) => {
    const expected = getAnnouncements();
    test.skip(expected.length === 0, "no announcements in content/");
    await page.goto("/");
    const items = page.getByRole("region", { name: /news/i }).getByRole("article");
    await expect(items).toHaveCount(expected.length);
    for (const [i, a] of expected.entries()) {
      await expect(items.nth(i).getByRole("heading")).toHaveText(a.title);
      await expect(items.nth(i).locator("time")).toHaveAttribute("datetime", a.date);
    }
  });

  test("highlights featured games above the grid", async ({ page }) => {
    const featured = getGames().filter((g) => g.featured && g.status !== "coming-soon");
    await page.goto("/");
    const spotlight = page.getByRole("region", { name: /gonzalo's pick/i });
    for (const game of featured) {
      await expect(spotlight.getByRole("heading", { name: game.title })).toBeVisible();
    }
    const spotlightBox = await spotlight.boundingBox();
    const gridBox = await page.getByRole("region", { name: /all games/i }).boundingBox();
    expect(spotlightBox!.y).toBeLessThan(gridBox!.y);
  });
});
