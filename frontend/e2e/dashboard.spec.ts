import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("carga correctamente", async ({ page }) => {
    await expect(page.getByText(/bienvenido/i)).toBeVisible();
    await expect(page.getByText(/agenda/i)).toBeVisible();
  });

  test("muestra módulo contable", async ({ page }) => {
    await expect(page.getByText(/ingresos ars/i)).toBeVisible();
    await expect(page.getByText(/egresos ars/i)).toBeVisible();
  });

  test("botón + Tarea navega a /tareas/nueva", async ({ page }) => {
    await page.getByRole("link", { name: /\+ tarea/i }).first().click();
    await expect(page).toHaveURL(/tareas\/nueva/);
  });

  test("botón + Movimiento navega a /movimientos/nuevo", async ({ page }) => {
    await page.getByRole("link", { name: /\+ movimiento/i }).first().click();
    await expect(page).toHaveURL(/movimientos\/nuevo/);
  });
});
