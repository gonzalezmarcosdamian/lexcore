import { test, expect } from "@playwright/test";
import { goTo } from "./helpers";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");

    // Si expiró la sesión y redirigió al login, re-autenticar
    if (page.url().includes("/login")) {
      await page.locator('input[type="email"]').fill("e2e.test@lexcore.dev");
      await page.locator('input[type="password"]').fill("TestLex2026!");
      await page.locator('button[type="submit"]').click();
      await page.waitForURL(/dashboard/, { timeout: 20000 });
    }
    await page.waitForLoadState("networkidle");
  });

  test("carga correctamente", async ({ page }) => {
    await expect(page.getByText(/bienvenido/i)).toBeVisible({ timeout: 10000 });
  });

  test("muestra widget de agenda", async ({ page }) => {
    await expect(page.getByText(/agenda|vencimiento|tarea/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("botón + Tarea visible", async ({ page }) => {
    await expect(page.getByRole("link", { name: "+ Tarea" })).toBeVisible({ timeout: 10000 });
  });

  test("botón + Tarea navega a /tareas/nueva", async ({ page }) => {
    await page.getByRole("link", { name: "+ Tarea" }).click();
    await expect(page).toHaveURL(/tareas\/nueva/, { timeout: 10000 });
  });

  test("botón + Movimiento navega a /movimientos/nuevo", async ({ page }) => {
    await page.getByRole("link", { name: "+ Movimiento" }).click();
    await expect(page).toHaveURL(/movimientos\/nuevo/, { timeout: 10000 });
  });
});
