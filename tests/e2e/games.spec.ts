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
    await expect(cards).toHaveCount(20);
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
    // 20 cards take a while to flip through under a loaded test run.
    test.setTimeout(90_000);
    const touch = testInfo.project.name === "mobile";
    await page.goto("/games/memory-match");
    await startWithKeyboard(page);
    // The Classic board (20 cards) is picked by default.
    await expect(page.getByRole("button", { name: /20/ })).toHaveAttribute("aria-pressed", "true");
    await press(page.getByRole("button", { name: "Start" }), touch);
    await solve(page, touch);
    await expect(page.getByText(/It took you \d+ moves/)).toBeVisible();
    await expect(page.getByText(/your best: \d+ moves/i)).toBeVisible();
    await expectResultThenReplayAndLeave(page, /you found them all/i);
  });
});

test.describe("Memory Match sizes", () => {
  test("the Quick board has 12 cards and a running clock", async ({ page }) => {
    await page.goto("/en/games/memory-match");
    await startWithKeyboard(page);
    await page.getByRole("button", { name: /12/ }).click();
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByRole("button", { name: /^Card \d+/ })).toHaveCount(12);
    await expect(page.getByText("Pairs: 0/6")).toBeVisible();
    await page.getByRole("button", { name: /^Card 1,/ }).click();
    await expect(page.getByText(/0:0[1-9]/)).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Game shell extras", () => {
  test("Esc pauses a real-time game and freezes its clock", async ({ page }) => {
    await frozenClock(page);
    await page.goto("/en/games/catch-it");
    await startWithKeyboard(page);
    await page.clock.runFor(2_000);
    await page.keyboard.press("Escape");
    const dialog = page.getByRole("dialog", { name: "Paused" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Resume" })).toBeFocused();
    const clock = page.locator("span", { hasText: /seconds left/ }).first();
    const before = await clock.textContent();
    expect(before).toMatch(/^\d+ seconds left/);
    await page.clock.runFor(5_000);
    expect(await clock.textContent()).toBe(before);
    await dialog.getByRole("button", { name: "Resume" }).click();
    await expect(dialog).toBeHidden();
    await page.clock.runFor(3_000);
    expect(await clock.textContent()).not.toBe(before);
  });

  test("the sound switch is remembered", async ({ page }) => {
    await page.goto("/en/games/super-jump");
    const sound = page.getByRole("button", { name: "Sound" });
    await expect(sound).toHaveAttribute("aria-pressed", "true");
    await sound.click();
    await expect(sound).toHaveAttribute("aria-pressed", "false");
    await page.reload();
    await expect(page.getByRole("button", { name: "Sound" })).toHaveAttribute("aria-pressed", "false");
  });

  test("the intro lists the game's achievements", async ({ page }) => {
    await page.goto("/en/games/catch-it");
    await expect(page.getByRole("heading", { name: "Achievements (0/2)" })).toBeVisible();
    await expect(page.getByText("Quick hands")).toBeVisible();
    await expect(page.getByText("Catch 25 stars.")).toBeVisible();
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

  test("Deku can Smash with the X key or the Smash button", async ({ page }) => {
    await page.goto("/en/games/super-jump");
    await startWithKeyboard(page);
    await expect(page.getByRole("button", { name: "Smash" })).toBeVisible();
    await page.keyboard.press("x");
    const box = (await page.getByRole("button", { name: "Smash" }).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.getByRole("img", { name: /game screen/i })).toBeVisible();
    await expect(coins(page)).toHaveText(/^0 coins, 3 lives left$/);
  });

  test("losing every life ends the round with a score", async ({ page }) => {
    test.setTimeout(75_000);
    await page.goto("/en/games/super-jump");
    await startWithKeyboard(page);
    // Run right without jumping: the first slime and the first pit take all three lives.
    await page.keyboard.down("ArrowRight");
    await expect(page.getByRole("heading", { name: "Game over!" })).toBeVisible({ timeout: 45_000 });
    await page.keyboard.up("ArrowRight");
    await expect(page.getByText(/You collected \d+ coins?\./)).toBeVisible();
    await expect(page.getByText(/your best: \d+ coins/i)).toBeVisible();
  });
});

test.describe("Astro Storm", () => {
  test("pick outside or cockpit view before launching", async ({ page }, testInfo) => {
    const touch = testInfo.project.name === "mobile";
    await page.goto("/en/games/astro-storm");
    await press(page.getByRole("button", { name: "Play", exact: true }), touch);
    const outside = page.getByRole("button", { name: /Outside/ });
    const cockpit = page.getByRole("button", { name: /Cockpit/ });
    await expect(outside).toHaveAttribute("aria-pressed", "true");
    await press(cockpit, touch);
    await expect(cockpit).toHaveAttribute("aria-pressed", "true");
    await expect(outside).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("button", { name: "Launch!" })).toBeVisible();
  });
});

// Three.js in software rendering: runs in the webgl project (see playwright.config.ts).
test.describe("Astro Storm flight @webgl", () => {
  test.setTimeout(180_000);

  test("launches, shoots rocks, and switches to the cockpit", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/en/games/astro-storm");
    await startWithKeyboard(page);
    await page.getByRole("button", { name: "Launch!" }).click();
    await expect(page.getByRole("img", { name: /asteroid storm/i })).toBeVisible();
    await expect(page.getByRole("status")).toHaveText(/^0 points, 3 ships left, wave 1$/, { timeout: 60_000 });
    const scrolled = await page.evaluate(() => window.scrollY);
    await page.keyboard.down("Space");
    await expect(page.getByRole("status")).toHaveText(/^[1-9]\d* points/, { timeout: 120_000 });
    await page.keyboard.up("Space");
    expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
    await page.keyboard.press("KeyC");
    await expect(page.getByRole("button", { name: /Switch view: Cockpit/ })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("Gonzgun", () => {
  test("choose a mode and a fighter before the fight", async ({ page }, testInfo) => {
    const touch = testInfo.project.name === "mobile";
    await page.goto("/en/games/gonzgun");
    await press(page.getByRole("button", { name: "Play", exact: true }), touch);
    const cpu = page.getByRole("button", { name: /1 player vs CPU/ });
    const duo = page.getByRole("button", { name: /2 players/ });
    await expect(cpu).toHaveAttribute("aria-pressed", "true");
    await press(duo, touch);
    await expect(duo).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/P2: arrows move and aim/)).toBeVisible();
    const p1 = page.getByRole("group", { name: "Player 1 picks a fighter" });
    const p2 = page.getByRole("group", { name: "Player 2 picks a fighter" });
    await expect(p1.getByRole("button")).toHaveCount(4);
    const turbo = p1.getByRole("button", { name: /Turbo/ });
    await press(turbo, touch);
    await expect(turbo).toHaveAttribute("aria-pressed", "true");
    await expect(p1.getByRole("button", { name: /Blocky/ })).toHaveAttribute("aria-pressed", "false");
    const pixel = p2.getByRole("button", { name: /Pixel/ });
    await press(pixel, touch);
    await expect(pixel).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Fight!" })).toBeVisible();
  });
});

// Three.js in software rendering: runs in the webgl project (see playwright.config.ts).
test.describe("Gonzgun fight @webgl", () => {
  test.setTimeout(180_000);

  test("fights the CPU with the keyboard", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/en/games/gonzgun");
    await startWithKeyboard(page);
    await page.getByRole("button", { name: "Fight!" }).click();
    await expect(page.getByRole("img", { name: /basement arena/i })).toBeVisible();
    await expect(page.getByRole("meter", { name: "Blocky: Health" })).toHaveAttribute("aria-valuenow", "100", { timeout: 60_000 });
    await expect(page.getByRole("status")).toHaveText(/Blocky 0 KOs, Sparky 0 KOs/);
    // Space would scroll the page if the game didn't take it.
    const scrolled = await page.evaluate(() => window.scrollY);
    await page.keyboard.down("Space");
    await page.keyboard.down("KeyD");
    await expect
      .poll(async () => Number(await page.getByRole("meter", { name: "Sparky: Health" }).getAttribute("aria-valuenow")), { timeout: 90_000 })
      .toBeLessThan(100);
    await page.keyboard.up("KeyD");
    await page.keyboard.up("Space");
    expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
    expect(errors).toEqual([]);
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
