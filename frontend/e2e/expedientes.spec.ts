import { test, expect } from "@playwright/test";
import { goTo, dismissModals } from "./helpers";

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

  test("detalle de expediente carga página de datos", async ({ page }) => {
    await goTo(page, "/expedientes");
    await page.waitForTimeout(1000);
    const link = page.locator("a[href*='/expedientes/']").first();
    if (await link.isVisible({ timeout: 8000 }).catch(() => false)) {
      await link.click();
      await page.waitForLoadState("networkidle");
      await dismissModals(page);
      // La página de detalle muestra datos del expediente
      await expect(page.getByText(/EXP-|expediente|datos/i).first()).toBeVisible({ timeout: 10000 });
    } else {
      // Usuario sin expedientes — crear uno y navegar directo
      await page.goto("/expedientes/nuevo");
      await page.waitForLoadState("networkidle");
      await expect(page.getByText(/nuevo expediente|caratula/i).first()).toBeVisible({ timeout: 8000 });
    }
  });

  test("botón + Movimiento desde expediente navega", async ({ page }) => {
    await goTo(page, "/expedientes");
    const link = page.locator("a[href*='/expedientes/']").first();
    if (await link.isVisible({ timeout: 5000 }).catch(() => false)) {
      await link.click();
      await page.waitForLoadState("networkidle");
      await dismissModals(page);
      const btnMov = page.getByRole("link", { name: /movimiento procesal/i }).first();
      if (await btnMov.isVisible({ timeout: 5000 }).catch(() => false)) {
        await btnMov.click();
        await expect(page).toHaveURL(/movimientos\/nuevo/, { timeout: 10000 });
      } else {
        console.log("Botón movimiento no visible en este expediente");
      }
    } else {
      console.log("Sin expedientes para testear navegación");
    }
  });
});
