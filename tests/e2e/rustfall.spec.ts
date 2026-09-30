import { devices, expect, test } from "@playwright/test";

test.describe("RUSTFALL menus", () => {
  test("the title screen links to the game, instructions and credits", async ({ page }) => {
    await page.goto("/en/play");
    await expect(page.getByRole("heading", { level: 1, name: "RUSTFALL" })).toBeVisible();

    await page.getByRole("link", { name: "INSTRUCTIONS" }).click();
    await expect(page).toHaveURL(/\/en\/play\/instructions$/);
    await expect(page.getByRole("heading", { name: "CONTROLS" })).toBeVisible();
    await page.getByRole("link", { name: "BACK" }).click();

    await page.getByRole("link", { name: "CREDITS" }).click();
    await expect(page).toHaveURL(/\/en\/play\/credits$/);
    await expect(page.getByText(/Three\.js/)).toBeVisible();
    await page.getByRole("link", { name: "BACK" }).click();

    await expect(page.getByRole("link", { name: "PLAY" })).toHaveAttribute("href", "/en/play/game");
  });

  test("works in Spanish and /play picks a language", async ({ page }) => {
    await page.goto("/es/play");
    await expect(page.getByRole("link", { name: "JUGAR" })).toBeVisible();
    await expect(page.getByRole("link", { name: "INSTRUCCIONES" })).toBeVisible();
    const response = await page.goto("/play");
    expect(response?.url()).toMatch(/\/(en|es)\/play$/);
  });

  test("the home page promotes it", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("link", { name: /enter the foundry/i }).click();
    await expect(page).toHaveURL(/\/en\/play$/);
  });
});

// Tagged @webgl: runs in its own Playwright project after the others (see playwright.config.ts).
test.describe("RUSTFALL game @webgl", () => {
  test.setTimeout(180_000);

  test("starts on click, shows the HUD, fires, and pauses", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/en/play/game");
    const start = page.getByRole("button", { name: "CLICK TO START" });
    await expect(start).toBeVisible({ timeout: 60_000 });
    await start.click();

    await expect(page.getByText("HEALTH")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("100%").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("12 / 36")).toBeVisible({ timeout: 30_000 });

    // Space would scroll the page if the game didn't stop it.
    await page.keyboard.press("Space");
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await page.keyboard.down("KeyF");
    await expect(page.getByText("11 / 36")).toBeVisible({ timeout: 30_000 });
    await page.keyboard.up("KeyF");

    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "PAUSED" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "RESUME" })).toBeFocused();
    const crt = page.getByRole("button", { name: /^CRT:/ });
    await expect(crt).toHaveText("CRT: ON");
    await crt.click();
    await expect(crt).toHaveText("CRT: OFF");
    await page.getByRole("button", { name: /^SOUND:/ }).click();
    await expect(page.getByRole("button", { name: /^SOUND:/ })).toHaveText("SOUND: OFF");
    expect(errors).toEqual([]);
  });
});

test("phones get a keyboard-and-mouse message instead of the game", async ({ browser }) => {
  const context = await browser.newContext({ ...devices["Pixel 7"] });
  const page = await context.newPage();
  await page.goto("/en/play/game");
  await expect(page.getByRole("heading", { name: "Keyboard and mouse needed" })).toBeVisible();
  await expect(page.getByRole("link", { name: "BACK" })).toHaveAttribute("href", "/en/play");
  await context.close();
});
