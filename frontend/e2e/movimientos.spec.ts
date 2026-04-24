import { test, expect } from "@playwright/test";
import { goTo } from "./helpers";

test.describe("Nuevo movimiento procesal", () => {
  test.beforeEach(async ({ page }) => {
    await goTo(page, "/movimientos/nuevo");
  });

  test("form carga con título de página", async ({ page }) => {
    await expect(page.getByText("Nuevo movimiento procesal")).toBeVisible({ timeout: 8000 });
  });

  test("campo título visible", async ({ page }) => {
    await expect(page.getByPlaceholder(/audiencia de vista/i)).toBeVisible({ timeout: 8000 });
  });

  test("tipos de movimiento disponibles", async ({ page }) => {
    await expect(page.getByRole("button", { name: /vencimiento procesal/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: /audiencia/i })).toBeVisible({ timeout: 8000 });
  });

  test("campo adjunto visible", async ({ page }) => {
    await expect(page.getByText(/adjuntar archivo/i)).toBeVisible({ timeout: 8000 });
  });

  test("muestra error si intenta guardar sin titulo", async ({ page }) => {
    // Dismiss any modal first
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /crear movimiento/i }).click();
    await expect(page.getByText(/titulo es obligatorio|minimo/i)).toBeVisible({ timeout: 5000 });
  });

  test("muestra error si falta expediente", async ({ page }) => {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await page.getByPlaceholder(/audiencia de vista/i).fill("Test movimiento E2E");
    await page.getByRole("button", { name: /crear movimiento/i }).click();
    await expect(page.getByText(/selecciona un expediente/i)).toBeVisible({ timeout: 5000 });
  });
});
