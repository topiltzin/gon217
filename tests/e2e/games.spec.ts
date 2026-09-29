import { expect, test, type Locator, type Page } from "@playwright/test";

/** Taps on the touch project, clicks with a mouse on desktop. */
async function press(locator: Locator, touch: boolean) {
  if (touch) await locator.tap();
  else await locator.click();
}

async function startWithKeyboard(page: Page) {
  const play = page.getByRole("button", { name: "Play", exact: true });
  await play.focus();
  await page.keyboard.press("Enter");
}

/** Installs a paused fake clock before the page loads, so only clock.runFor() moves time. */
async function frozenClock(page: Page) {
  await page.clock.install({ time: new Date("2026-01-01T10:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T10:01:00Z"));
}

async function expectResultThenReplayAndLeave(page: Page, headline: RegExp) {
  const heading = page.getByRole("heading", { name: headline });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await page.getByRole("button", { name: /play again/i }).click();
  await expect(page.getByRole("heading", { name: /: playing$/ })).toBeAttached();
  await page.getByRole("link", { name: /back to games/i }).first().click();
  await expect(page).toHaveURL(/\/en$/);
}

test.describe("Memory Match", () => {
  async function solve(page: Page, touch: boolean) {
    const cards = page.getByRole("button", { name: /^Card \d+/ });
    await expect(cards).toHaveCount(12);
    const count = await cards.count();
    const seen = new Map<string, number>();
    const symbolOf = async (i: number) =>
      (await cards.nth(i).getAttribute("aria-label"))!.replace(/^Card \d+, /, "").replace(/, matched$/, "");

    for (let i = 0; i < count; i++) {
      if ((await cards.nth(i).getAttribute("aria-disabled")) === "true") continue;
      await press(cards.nth(i), touch);
      const symbol = await symbolOf(i);
      const partner = seen.get(symbol);
      if (partner !== undefined) {
        await press(cards.nth(partner), touch);
        continue;
      }
      // Peek at the next unknown, unmatched card; a mismatch hides on the next tap.
      const known = new Set(seen.values());
      let j = i + 1;
      while (j < count && (known.has(j) || (await cards.nth(j).getAttribute("aria-disabled")) === "true")) j++;
      if (j >= count) break;
      await press(cards.nth(j), touch);
      const other = await symbolOf(j);
      if (other !== symbol) {
        seen.set(symbol, i);
        if (seen.has(other)) {
          const k = seen.get(other)!;
          await press(cards.nth(k), touch);
          await press(cards.nth(j), touch);
        } else {
          seen.set(other, j);
        }
      }
      i = j;
    }
  }

  test("can be played start to finish and replayed", async ({ page }, testInfo) => {
    const touch = testInfo.project.name === "mobile";
    await page.goto("/games/memory-match");
    await startWithKeyboard(page);
    await solve(page, touch);
    await expect(page.getByText(/It took you \d+ moves/)).toBeVisible();
    await expect(page.getByText(/your best: \d+ moves/i)).toBeVisible();
    await expectResultThenReplayAndLeave(page, /you found them all/i);
  });
});

test.describe("Catch It", () => {
  test("keyboard: Enter catches the star and the round ends after 30 s", async ({ page }) => {
    await frozenClock(page);
    await page.goto("/games/catch-it");
    await startWithKeyboard(page);
    await page.clock.runFor(1_000);
    await expect(page.getByRole("button", { name: /star!/ })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByText("1 stars caught")).toBeAttached();
    await page.clock.runFor(31_000);
    await expect(page.getByText("You caught 1 star!")).toBeVisible();
    await expectResultThenReplayAndLeave(page, /time's up/i);
  });

  test("pointer: tapping the star scores", async ({ page }, testInfo) => {
    const touch = testInfo.project.name === "mobile";
    await frozenClock(page);
    await page.goto("/games/catch-it");
    await press(page.getByRole("button", { name: "Play", exact: true }), touch);
    for (let caught = 1; caught <= 3; caught++) {
      await page.clock.runFor(700);
      await press(page.getByRole("button", { name: /star!/ }), touch);
      await expect(page.getByText(`${caught} stars caught`)).toBeAttached();
    }
  });
});

test.describe("Tic-Tac-Toe", () => {
  test("two players on one device: X wins", async ({ page }, testInfo) => {
    const touch = testInfo.project.name === "mobile";
    await page.goto("/games/tic-tac-toe");
    await press(page.getByRole("button", { name: "Play", exact: true }), touch);
    await press(page.getByRole("button", { name: /two players/i }), touch);
    const cell = (r: number, c: number) => page.getByRole("button", { name: new RegExp(`^Row ${r}, column ${c},`) });
    for (const [r, c] of [
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 2],
      [1, 3],
    ]) {
      await press(cell(r, c), touch);
    }
    await expectResultThenReplayAndLeave(page, /^X wins!$/);
  });

  test("keyboard only against the computer reaches a result", async ({ page }) => {
    await page.goto("/games/tic-tac-toe");
    await startWithKeyboard(page);
    await expect(page.getByRole("button", { name: /play the computer/i })).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /play the computer/i })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: /^Row 1, column 1/ })).toBeFocused();

    const result = page.getByRole("heading", { name: /you won|computer won|draw/i });
    // Wait for either the player's turn (a free, enabled cell) or the final result.
    const free = page.locator('button[aria-label$="empty"][aria-disabled="false"]').first();
    for (let move = 0; move < 5; move++) {
      await expect(free.or(result)).toBeVisible();
      if (await result.isVisible()) break;
      await free.focus();
      await page.keyboard.press("Enter");
    }
    await expectResultThenReplayAndLeave(page, /you won|computer won|draw/i);
  });
});

test.describe("Super Jump", () => {
  const coins = (page: Page) => page.getByRole("status");

  test("keyboard: hold right to run and grab the first coins", async ({ page }) => {
    await page.goto("/en/games/super-jump");
    await startWithKeyboard(page);
    await expect(page.getByRole("img", { name: /game screen/i })).toBeVisible();
    await expect(coins(page)).toHaveText(/^0 coins, 3 lives left$/);
    await page.keyboard.down("ArrowRight");
    await expect(coins(page)).toHaveText(/^[1-9]\d* coins/, { timeout: 4000 });
    await page.keyboard.up("ArrowRight");
    // Jumping with Space works too (the game keeps running without errors).
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: /jump/i })).toBeVisible();
  });

  test("on-screen buttons move the player", async ({ page }, testInfo) => {
    await page.goto("/en/games/super-jump");
    await press(page.getByRole("button", { name: "Play", exact: true }), testInfo.project.name === "mobile");
    const rightButton = page.getByRole("button", { name: "Move right" });
    await expect(rightButton).toBeVisible();
    const box = (await rightButton.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(coins(page)).toHaveText(/^[1-9]\d* coins/, { timeout: 4000 });
    await page.mouse.up();
  });

  test("losing every life ends the round with a score", async ({ page }) => {
    await page.goto("/en/games/super-jump");
    await startWithKeyboard(page);
    // Run right without jumping: slimes and the first pit take all three lives.
    await page.keyboard.down("ArrowRight");
    await expect(page.getByRole("heading", { name: "Game over!" })).toBeVisible({ timeout: 30_000 });
    await page.keyboard.up("ArrowRight");
    await expect(page.getByText(/You collected \d+ coins?\./)).toBeVisible();
    await expect(page.getByText(/your best: \d+ coins/i)).toBeVisible();
  });
});

test.describe("Garden Guard", () => {
  const cell = (page: Page, r: number, c: number) =>
    page.getByRole("button", { name: new RegExp(`^Row ${r}, column ${c},`) });

  test("pick a plant and tap the garden to plant it", async ({ page }, testInfo) => {
    const touch = testInfo.project.name === "mobile";
    await page.goto("/en/games/garden-guard");
    await press(page.getByRole("button", { name: "Play", exact: true }), touch);
    await press(page.getByRole("button", { name: /pea shooter/i }), touch);
    await expect(page.getByRole("button", { name: /pea shooter/i })).toHaveAttribute("aria-pressed", "true");
    await press(cell(page, 3, 1), touch);
    await expect(cell(page, 3, 1)).toHaveAccessibleName("Row 3, column 1, Pea Shooter");
    // A planted cell can't be planted again.
    await expect(cell(page, 3, 1)).toHaveAttribute("aria-disabled", "true");
  });

  test("keyboard: number keys pick, arrows move, Enter plants", async ({ page }) => {
    await page.goto("/en/games/garden-guard");
    await startWithKeyboard(page);
    await expect(cell(page, 3, 1)).toBeVisible();
    await cell(page, 3, 1).focus();
    await page.keyboard.press("ArrowRight");
    await expect(cell(page, 3, 2)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(cell(page, 4, 2)).toBeFocused();
    await page.keyboard.press("3");
    await expect(page.getByRole("button", { name: /stone wall/i })).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Enter");
    await expect(cell(page, 4, 2)).toHaveAccessibleName("Row 4, column 2, Stone Wall");
  });
});
