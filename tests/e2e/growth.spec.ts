import { expect, test } from "@playwright/test";
import { getGames } from "../../lib/content";

const games = getGames();
const newGame = games.find((g) => g.status === "new");
const comingSoon = games.find((g) => g.status === "coming-soon");

test.describe("growing the catalogue", () => {
  test("new games carry a New badge", async ({ page }) => {
    test.skip(!newGame, "no game marked new");
    await page.goto("/");
    const card = page.getByRole("region", { name: /all games/i }).getByRole("link", { name: newGame!.title });
    await expect(card.getByText("New!")).toBeVisible();
  });

  test("coming-soon games are labelled, not clickable, and have no page", async ({ page }) => {
    test.skip(!comingSoon, "no game marked coming-soon");
    await page.goto("/");
    const grid = page.getByRole("region", { name: /all games/i });
    await expect(grid.getByRole("heading", { name: comingSoon!.title })).toBeVisible();
    await expect(grid.getByRole("link", { name: comingSoon!.title })).toHaveCount(0);
    await expect(
      grid.getByRole("listitem").filter({ hasText: comingSoon!.title }).getByText("Coming soon", { exact: true }),
    ).toBeVisible();

    const response = await page.goto(`/games/${comingSoon!.slug}`);
    expect(response?.status()).toBe(404);
  });

  test("every playable game in content has a working page", async ({ page }) => {
    for (const game of games.filter((g) => g.status !== "coming-soon")) {
      const response = await page.goto(`/games/${game.slug}`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: game.title, level: 1 })).toBeVisible();
    }
  });
});
