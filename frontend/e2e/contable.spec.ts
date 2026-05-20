import { test, expect } from "@playwright/test";
import { renewSession } from "./fixtures";
import { goTo } from "./helpers";

test.beforeAll(renewSession);

test.describe("Contable", () => {
  test.beforeEach(async ({ page }) => {
    await goTo(page, "/gastos");
  });

  test("muestra cards de totales: Ingresos ARS, Egresos ARS, Hon. pend.", async ({ page }) => {
    // Las 6 cards de totales en la grilla 3x2
    await expect(page.getByText("Ingresos ARS")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Egresos ARS")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Hon. pend.")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Recurrentes")).toBeVisible({ timeout: 8000 });
  });

  test("botones + Egreso e + Ingreso visibles en la barra de control", async ({ page }) => {
    // Los dos CTAs en la barra superior — texto incluye el signo +
    await expect(page.getByRole("button", { name: /egreso/i }).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: /ingreso/i }).first()).toBeVisible({ timeout: 8000 });
  });

  test("feed unificado de movimientos visible", async ({ page }) => {
    // El título del feed — verifica que la sección existe como estructura
    await expect(page.getByText("Movimientos del período")).toBeVisible({ timeout: 8000 });
  });

  test("toggle Mes / Año visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: /^Mes$/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: /^Año$/i })).toBeVisible({ timeout: 8000 });
  });

  test("switch a vista anual muestra año en 4 dígitos", async ({ page }) => {
    await page.getByRole("button", { name: /^Año$/i }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText(/202[0-9]/)).toBeVisible({ timeout: 5000 });
  });

  test("botón + Egreso abre modal con título 'Nuevo egreso'", async ({ page }) => {
    await page.getByRole("button", { name: /egreso/i }).first().click();
    await expect(page.getByText("Nuevo egreso")).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
  });

  test("botón + Ingreso abre modal de registro de ingreso", async ({ page }) => {
    await page.getByRole("button", { name: /ingreso/i }).first().click();
    await expect(page.getByText(/registrar ingreso|nuevo ingreso/i)).toBeVisible({ timeout: 5000 });
    await page.keyboard.press("Escape");
  });
});
