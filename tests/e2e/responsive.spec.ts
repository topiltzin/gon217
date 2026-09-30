import { expect, test } from "@playwright/test";

const WIDTHS = [375, 768, 1024, 1440];
const PAGES = ["/en", "/es", "/en/games/memory-match", "/en/games/catch-it", "/en/games/tic-tac-toe", "/en/games/super-jump", "/es/games/super-jump", "/en/games/garden-guard", "/es/games/garden-guard", "/en/play", "/es/play", "/en/play/instructions", "/es/play/credits", "/nope"];

// This spec sets its own viewports, so it only needs one project.
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "sets its own viewports");
});

for (const width of WIDTHS) {
  test(`no sideways scroll or layout shift at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
          if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
      const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
      expect(cls, `${path} CLS`).toBeLessThan(0.1);
    }
  });
}

test("tap targets on the home page are at least 44px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  const small = await page.$$eval("main a, main button, header a", (els) =>
    els
      .map((el) => ({ text: (el.textContent ?? "").trim().slice(0, 30), box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && (box.width < 44 || box.height < 44))
      .map(({ text, box }) => `${text} (${Math.round(box.width)}x${Math.round(box.height)})`),
  );
  expect(small).toEqual([]);
});
