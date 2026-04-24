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
    // Botones de acción presentes
    await expect(page.getByRole("link", { name: /tarea/i }).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("link", { name: /movimiento/i }).first()).toBeVisible({ timeout: 8000 });
  });

  test("vista tablero y calendario disponibles", async ({ page }) => {
    await expect(page.getByRole("button", { name: /tablero/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: /calendario/i })).toBeVisible({ timeout: 8000 });
  });

  test("+ Tarea navega a form", async ({ page }) => {
    const link = page.getByRole("link", { name: /\+ tarea/i }).first();
    await expect(link).toBeVisible({ timeout: 8000 });
    await link.click();
    await expect(page).toHaveURL(/tareas\/nueva/, { timeout: 10000 });
  });

  test("+ Movimiento navega a form", async ({ page }) => {
    const link = page.getByRole("link", { name: /\+ movimiento/i }).first();
    await expect(link).toBeVisible({ timeout: 8000 });
    await link.click();
    await expect(page).toHaveURL(/movimientos\/nuevo/, { timeout: 10000 });
  });
});
