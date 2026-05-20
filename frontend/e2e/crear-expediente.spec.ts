/**
 * Test E2E: flujo completo de crear un expediente.
 * Verifica el camino más crítico del producto.
 */
import { test, expect } from "@playwright/test";
import { goTo } from "./helpers";
import { renewSession } from "./fixtures";

test.beforeAll(renewSession);

test.describe("Crear expediente — flujo completo", () => {
  const CARATULA = `E2E Test ${Date.now()}`;

  test("navega a nuevo expediente desde la lista", async ({ page }) => {
    await goTo(page, "/expedientes");
    await page.getByRole("link", { name: /nuevo expediente/i })
      .or(page.getByRole("button", { name: /nuevo expediente/i }))
      .first()
      .click();
    await expect(page).toHaveURL(/expedientes\/nuevo/, { timeout: 10000 });
  });

  test("completa paso 1 — carátula y fuero", async ({ page }) => {
    await goTo(page, "/expedientes/nuevo");
    // Carátula — placeholder real: "García c/ Empresa SA sobre daños"
    await page.getByPlaceholder(/García|caratula/i).fill(CARATULA);
    // Fuero — chips visibles en el form
    await page.locator("button").filter({ hasText: /^Civil$/ }).first().click();
    // Continuar →
    await page.getByRole("button", { name: /Continuar/i }).click();
    // Paso 2 visible
    await expect(page.getByText(/Partes y juzgado|paso 2/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("crea expediente completo y navega al detalle", async ({ page }) => {
    await goTo(page, "/expedientes/nuevo");

    // Paso 1
    await page.getByPlaceholder(/García|caratula/i).fill(CARATULA);
    await page.locator("button").filter({ hasText: /^Civil$/ }).first().click();
    await page.getByRole("button", { name: /Continuar/i }).click();
    await page.waitForTimeout(500);

    // Paso 2 — guardar (sin cliente obligatorio)
    await page.getByRole("button", { name: /Guardar expediente|Crear|Guardar/i }).click();

    // Navega al expediente creado
    await expect(page).toHaveURL(/expedientes/, { timeout: 15000 });
    await expect(page.getByText(CARATULA).first()).toBeVisible({ timeout: 10000 });
  });
});
