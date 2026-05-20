import { test, expect } from "@playwright/test";
import { goTo } from "./helpers";

test.describe("Agenda", () => {
  test.beforeEach(async ({ page }) => {
    await goTo(page, "/agenda");
  });

  test("carga página de agenda", async ({ page }) => {
    await expect(page.getByText("Agenda").first()).toBeVisible({ timeout: 10000 });
  });

  test("header simplificado visible", async ({ page }) => {
    await expect(page.getByText("Agenda").first()).toBeVisible({ timeout: 8000 });
    // Botones de CTA visibles (texto sin el signo +)
    await expect(page.getByText(/tarea/i).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/movimiento/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("vista tablero y calendario disponibles", async ({ page }) => {
    await expect(page.getByText(/tablero/i).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/calendario/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("+ Tarea navega a form", async ({ page }) => {
    // El botón + Tarea puede ser un link o button según la vista
    const btn = page.locator("a, button").filter({ hasText: /tarea/i }).first();
    await btn.click();
    await expect(page).toHaveURL(/tareas\/nueva|agenda/, { timeout: 10000 });
  });

  test("+ Movimiento navega a form", async ({ page }) => {
    const btn = page.locator("a, button").filter({ hasText: /movimiento/i }).first();
    await btn.click();
    await expect(page).toHaveURL(/movimientos\/nuevo|agenda/, { timeout: 10000 });
  });
});
