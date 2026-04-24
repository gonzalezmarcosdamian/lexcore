import { test, expect } from "@playwright/test";
import { goTo } from "./helpers";

test.describe("Nuevo honorario", () => {
  test.beforeEach(async ({ page }) => {
    await goTo(page, "/honorarios/nuevo");
  });

  test("form carga con título de página", async ({ page }) => {
    await expect(page.getByText("Nuevo honorario")).toBeVisible({ timeout: 8000 });
  });

  test("campo concepto visible", async ({ page }) => {
    await expect(page.getByPlaceholder(/patrocinio/i)).toBeVisible({ timeout: 8000 });
  });

  test("toggle cuotas visible", async ({ page }) => {
    await expect(page.getByText("Dividir en cuotas")).toBeVisible({ timeout: 8000 });
  });

  test("moneda chips ARS y USD", async ({ page }) => {
    // Los chips de moneda son botones con texto exacto "$" y "U$D"
    // Scroll para asegurarse que son visibles
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const arsBtn = page.getByRole("button", { name: "$" });
    const usdBtn = page.getByRole("button", { name: "U$D" });
    // Verificar que al menos uno está en el DOM
    await expect(page.getByText("$").first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("U$D").first()).toBeVisible({ timeout: 8000 });
  });

  test("error si falta concepto", async ({ page }) => {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /guardar honorario/i }).click();
    await expect(page.getByText(/concepto es obligatorio/i)).toBeVisible({ timeout: 5000 });
  });

  test("error si falta monto", async ({ page }) => {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await page.getByPlaceholder(/patrocinio/i).fill("Honorarios test");
    await page.getByRole("button", { name: /guardar honorario/i }).click();
    await expect(page.getByText(/monto debe ser mayor/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Registrar pago", () => {
  test("página carga sin crash con id inválido", async ({ page }) => {
    await goTo(page, "/honorarios/pago?honorario_id=test-invalido&expediente_id=test");
    await expect(page).toHaveURL(/honorarios\/pago/);
    await expect(page.locator("body")).toBeVisible();
  });
});
