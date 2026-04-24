import { test, expect } from "@playwright/test";
import { goTo } from "./helpers";

test.describe("Mobile — formularios de alta", () => {
  test("movimientos/nuevo carga sin redirect", async ({ page }) => {
    await goTo(page, "/movimientos/nuevo");
    await expect(page).not.toHaveURL(/\/agenda/);
    await expect(page.getByText("Nuevo movimiento procesal")).toBeVisible({ timeout: 8000 });
  });

  test("tareas/nueva carga sin redirect", async ({ page }) => {
    await goTo(page, "/tareas/nueva");
    await expect(page).not.toHaveURL(/\/agenda/);
    await expect(page.getByText("Nueva tarea")).toBeVisible({ timeout: 8000 });
  });

  test("honorarios/nuevo carga sin redirect", async ({ page }) => {
    await goTo(page, "/honorarios/nuevo");
    await expect(page).not.toHaveURL(/\/agenda/);
    await expect(page.getByText("Nuevo honorario")).toBeVisible({ timeout: 8000 });
  });

  test("dashboard carga en mobile", async ({ page }) => {
    await goTo(page, "/dashboard");
    await expect(page.getByText(/bienvenido/i)).toBeVisible({ timeout: 10000 });
  });

  test("agenda carga en mobile", async ({ page }) => {
    await goTo(page, "/agenda");
    // Agenda tiene h1 con texto "Agenda"
    await expect(page.getByText("Agenda").first()).toBeVisible({ timeout: 10000 });
  });
});
