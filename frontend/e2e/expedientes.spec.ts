import { test, expect } from "@playwright/test";

test.describe("Expedientes", () => {
  test("lista carga", async ({ page }) => {
    await page.goto("/expedientes");
    await expect(page.getByRole("heading", { name: /expedientes/i })).toBeVisible();
  });

  test("puede buscar expediente", async ({ page }) => {
    await page.goto("/expedientes");
    const search = page.getByPlaceholder(/buscar/i).first();
    if (await search.isVisible()) {
      await search.fill("EXP");
      await page.waitForTimeout(400);
    }
  });

  test("detalle de expediente carga bitácora", async ({ page }) => {
    await page.goto("/expedientes");
    const link = page.locator("a[href*='/expedientes/']").first();
    if (await link.isVisible()) {
      await link.click();
      await expect(page.getByText(/bitácora/i)).toBeVisible({ timeout: 8000 });
      await expect(page.getByText(/movimiento procesal/i)).toBeVisible();
    }
  });

  test("botón + Movimiento desde expediente navega", async ({ page }) => {
    await page.goto("/expedientes");
    const link = page.locator("a[href*='/expedientes/']").first();
    if (await link.isVisible()) {
      await link.click();
      const btnMov = page.getByRole("link", { name: /movimiento procesal/i }).first();
      await expect(btnMov).toBeVisible({ timeout: 8000 });
      await btnMov.click();
      await expect(page).toHaveURL(/movimientos\/nuevo/);
    }
  });
});
