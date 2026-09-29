import { expect, test } from "@playwright/test";

test.describe("Spanish", () => {
  test.describe("with a Spanish browser", () => {
    test.use({ locale: "es-MX", extraHTTPHeaders: { "Accept-Language": "es-MX,es;q=0.9" } });

    test("opens in Spanish automatically", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/es$/);
      await expect(page.locator("html")).toHaveAttribute("lang", "es");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Los Juegos de Gonzalo");
      await expect(page.getByRole("link", { name: /¡a jugar!/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Todos los juegos" })).toBeVisible();
    });

    test("deep links keep their path", async ({ page }) => {
      await page.goto("/games/super-jump");
      await expect(page).toHaveURL(/\/es\/games\/super-jump$/);
      await expect(page.getByRole("heading", { name: "Súper Salto" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Jugar", exact: true })).toBeVisible();
    });
  });

  test("English browsers get English", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("the language button switches the same page back and forth", async ({ page }) => {
    await page.goto("/en/games/tic-tac-toe");
    await page.getByRole("link", { name: /cambiar a español/i }).click();
    await expect(page).toHaveURL(/\/es\/games\/tic-tac-toe$/);
    await expect(page.getByRole("heading", { name: "Gato" })).toBeVisible();

    await page.getByRole("link", { name: /switch to english/i }).click();
    await expect(page).toHaveURL(/\/en\/games\/tic-tac-toe$/);
    await expect(page.getByRole("heading", { name: "Tic-Tac-Toe" })).toBeVisible();
  });

  test("games play in Spanish", async ({ page }) => {
    await page.goto("/es/games/tic-tac-toe");
    await page.getByRole("button", { name: "Jugar", exact: true }).click();
    await page.getByRole("button", { name: "Dos jugadores" }).click();
    for (const [r, c] of [
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 2],
      [1, 3],
    ]) {
      await page.getByRole("button", { name: new RegExp(`^Fila ${r}, columna ${c},`) }).click();
    }
    await expect(page.getByRole("heading", { name: "¡Gana X!" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Jugar otra vez" })).toBeVisible();
    await page.getByRole("link", { name: "Volver a los juegos" }).first().click();
    await expect(page).toHaveURL(/\/es$/);
  });

  test("unknown pages show a Spanish 404", async ({ page }) => {
    const response = await page.goto("/es/no-existe");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /perdidos en el espacio/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /llévame al inicio/i })).toHaveAttribute("href", "/es");
  });

  test("unsupported languages in the URL are 404s", async ({ page }) => {
    const response = await page.goto("/fr");
    expect(response?.status()).toBe(404);
  });
});

test("the videos section is ready for Gonzalo's links", async ({ page }) => {
  await page.goto("/en");
  const videos = page.getByRole("region", { name: "Videos" });
  await expect(videos).toBeVisible();
  // With no videos in content/videos.json, a friendly placeholder shows and nothing links out.
  await expect(videos.getByText(/no videos yet/i)).toBeVisible();
  await expect(videos.getByRole("link")).toHaveCount(0);
});
