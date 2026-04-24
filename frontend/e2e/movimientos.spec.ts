import { test, expect } from "@playwright/test";

test.describe("Nuevo movimiento procesal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/movimientos/nuevo");
  });

  test("form carga con todos los campos", async ({ page }) => {
    await expect(page.getByText("Nuevo movimiento procesal")).toBeVisible();
    await expect(page.getByPlaceholder(/audiencia de vista/i)).toBeVisible();
    await expect(page.getByText("Tipo *")).toBeVisible();
    await expect(page.getByText("Fecha *")).toBeVisible();
    await expect(page.getByText("Hora *")).toBeVisible();
  });

  test("muestra error si intenta guardar sin titulo", async ({ page }) => {
    await page.getByRole("button", { name: /crear movimiento/i }).click();
    await expect(page.getByText(/titulo es obligatorio|minimo/i)).toBeVisible();
  });

  test("muestra error si falta expediente", async ({ page }) => {
    await page.getByPlaceholder(/audiencia de vista/i).fill("Test movimiento");
    await page.getByRole("button", { name: /crear movimiento/i }).click();
    await expect(page.getByText(/expediente/i)).toBeVisible();
  });

  test("tipos de movimiento disponibles", async ({ page }) => {
    await expect(page.getByRole("button", { name: /vencimiento procesal/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /audiencia/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /acto procesal/i })).toBeVisible();
  });

  test("campo adjunto visible", async ({ page }) => {
    await expect(page.getByText(/adjuntar archivo/i)).toBeVisible();
  });
});
