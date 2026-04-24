import { test, expect } from "@playwright/test";
import { goTo } from "./helpers";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await goTo(page, "/dashboard");
  });

  test("carga correctamente", async ({ page }) => {
    await expect(page.getByText(/bienvenido/i)).toBeVisible({ timeout: 10000 });
  });

  test("muestra widget de agenda", async ({ page }) => {
    // El dashboard tiene una sección de agenda (puede ser "Agenda" o una lista de eventos)
    await expect(page.getByText(/agenda|vencimiento|tarea/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("botón + Tarea visible", async ({ page }) => {
    await expect(page.getByRole("link", { name: /\+ tarea/i }).first()).toBeVisible({ timeout: 8000 });
  });

  test("botón + Tarea navega a /tareas/nueva", async ({ page }) => {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await page.getByRole("link", { name: /\+ tarea/i }).first().click();
    await expect(page).toHaveURL(/tareas\/nueva/, { timeout: 10000 });
  });

  test("botón + Movimiento navega a /movimientos/nuevo", async ({ page }) => {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await page.getByRole("link", { name: /\+ movimiento/i }).first().click();
    await expect(page).toHaveURL(/movimientos\/nuevo/, { timeout: 10000 });
  });
});
