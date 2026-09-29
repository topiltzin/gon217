import { expect, test } from "@playwright/test";

const PAGES = ["/en", "/es", "/en/games/memory-match", "/en/games/catch-it", "/en/games/tic-tac-toe", "/en/games/super-jump", "/en/games/garden-guard"];

test("no third-party requests and no cookies", async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const external: string[] = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.protocol.startsWith("http") && url.origin !== origin) external.push(req.url());
  });
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForLoadState("networkidle");
  expect(external).toEqual([]);
  expect(await context.cookies()).toEqual([]);
});

test("security headers are set", async ({ page }) => {
  const response = await page.goto("/");
  const headers = response!.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("no-referrer");
  expect(headers["x-powered-by"]).toBeUndefined();
});
