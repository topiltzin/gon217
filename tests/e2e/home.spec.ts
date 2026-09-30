import { expect, test } from "@playwright/test";

test.describe("home page", () => {
  test("shows the space, the host, and a card for every game", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Gonzalo's Game Space");
    await expect(page.getByText(/hosted by gonzalo/i)).toBeVisible();

    const grid = page.getByRole("region", { name: /all games/i });
    for (const title of ["Gonzgun", "Astro Storm", "Garden Guard", "Super Jump", "Memory Match", "Catch It!", "Tic-Tac-Toe", "Color Quest"]) {
      await expect(grid.getByRole("heading", { name: title })).toBeVisible();
    }
  });

  test("one tap opens a game, and back returns home", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("region", { name: /all games/i })
      .getByRole("link", { name: /memory match/i })
      .click();
    await expect(page).toHaveURL(/\/games\/memory-match$/);
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();

    await page.getByRole("link", { name: /back to games/i }).click();
    await expect(page).toHaveURL(/\/en$/);
  });

  test("Play now jumps to the games", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /play now/i }).click();
    await expect(page).toHaveURL(/#games$/);
  });

  test("a game link works when opened directly", async ({ page }) => {
    await page.goto("/games/tic-tac-toe");
    await expect(page.getByRole("heading", { name: "Tic-Tac-Toe" })).toBeVisible();
    await expect(page).toHaveTitle(/Tic-Tac-Toe/);
  });
});
