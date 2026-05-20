import { test, expect } from "@playwright/test";
import { renewSession } from "./fixtures";
import { goTo } from "./helpers";

test.beforeAll(renewSession);

test.describe("Contable", () => {
  test.beforeEach(async ({ page }) => {
    await goTo(page, "/gastos");
  });

  test("carga con tabs Egresos e Ingresos", async ({ page }) => {
    // Los tabs son botones dentro del header unificado
    await expect(page.getByText(/egresos/i).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/ingresos/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("toggle Mes / Año visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: /^mes$/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: /^año$/i })).toBeVisible({ timeout: 8000 });
  });

  test("switch a Ingresos funciona", async ({ page }) => {
    await page.getByText(/ingresos/i).first().click();
    await page.waitForTimeout(500);
    // La página no crashea
    await expect(page.getByText(/ingresos/i).first()).toBeVisible();
  });

  test("switch a vista anual funciona", async ({ page }) => {
    await page.getByRole("button", { name: /^año$/i }).click();
    await page.waitForTimeout(300);
    // El label del período muestra un año (4 dígitos)
    await expect(page.getByText(/202[0-9]/)).toBeVisible({ timeout: 5000 });
  });
});
