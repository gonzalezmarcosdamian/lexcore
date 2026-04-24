/**
 * Tests específicos de mobile (iPhone 12 — 390px).
 * Verifican que las páginas de detalle carguen sin redirect.
 */
import { test, expect } from "@playwright/test";

// Estos tests solo corren en el proyecto "mobile"
test.describe("Mobile — detalle movimiento", () => {
  test("movimientos/nuevo carga en mobile", async ({ page }) => {
    await page.goto("/movimientos/nuevo");
    await expect(page.getByText("Nuevo movimiento procesal")).toBeVisible();
    // No debe redirigir a /agenda
    await expect(page).not.toHaveURL(/\/agenda/);
  });

  test("tareas/nueva carga en mobile", async ({ page }) => {
    await page.goto("/tareas/nueva");
    await expect(page.getByText("Nueva tarea")).toBeVisible();
    await expect(page).not.toHaveURL(/\/agenda/);
  });

  test("honorarios/nuevo carga en mobile", async ({ page }) => {
    await page.goto("/honorarios/nuevo");
    await expect(page.getByText("Nuevo honorario")).toBeVisible();
    await expect(page).not.toHaveURL(/\/agenda/);
  });

  test("dashboard carga en mobile", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/bienvenido/i)).toBeVisible();
  });

  test("agenda carga en mobile", async ({ page }) => {
    await page.goto("/agenda");
    await expect(page.getByText("Agenda")).toBeVisible();
  });
});
