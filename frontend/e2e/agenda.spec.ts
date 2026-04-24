import { test, expect } from "@playwright/test";

test.describe("Agenda", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/agenda");
  });

  test("carga con filtros visibles", async ({ page }) => {
    await expect(page.getByText("MOV")).toBeVisible();
    await expect(page.getByText("TAREAS")).toBeVisible();
  });

  test("vista tablero y calendario disponibles", async ({ page }) => {
    await expect(page.getByRole("button", { name: /tablero/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /calendario/i })).toBeVisible();
  });

  test("+ Tarea navega a form", async ({ page }) => {
    await page.getByRole("link", { name: /\+ tarea/i }).first().click();
    await expect(page).toHaveURL(/tareas\/nueva/);
  });

  test("+ Movimiento navega a form", async ({ page }) => {
    await page.getByRole("link", { name: /\+ movimiento/i }).first().click();
    await expect(page).toHaveURL(/movimientos\/nuevo/);
  });
});
