import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const serious = results.violations
    .filter((v) => v.impact === "critical" || v.impact === "serious")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(serious).toEqual([]);
}

for (const path of ["/en", "/es", "/nope", "/es/nope"]) {
  test(`${path} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await expectNoSeriousViolations(page);
  });
}

for (const slug of ["memory-match", "catch-it", "tic-tac-toe", "super-jump", "garden-guard"]) {
  test(`${slug} intro and play screens have no serious violations`, async ({ page }) => {
    await page.goto(`/en/games/${slug}`);
    await expectNoSeriousViolations(page);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("heading", { name: /: playing$/ })).toBeAttached();
    await page.waitForLoadState("networkidle");
    await expectNoSeriousViolations(page);
  });
}

test("keyboard users can skip to content and see focus", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: /skip to content/i });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  const outline = await skip.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe("none");
});

test("reduced motion stops the hero animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const animated = page.locator(".animate-float").first();
  test.skip((await animated.count()) === 0 || !(await animated.isVisible()), "hero art hidden at this width");
  const duration = await animated.evaluate((el) => parseFloat(getComputedStyle(el).animationDuration));
  expect(duration).toBeLessThan(0.01);
});
