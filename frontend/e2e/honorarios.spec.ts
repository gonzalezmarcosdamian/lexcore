import { test, expect } from "@playwright/test";

test.describe("Nuevo honorario", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/honorarios/nuevo");
  });

  test("form carga correctamente", async ({ page }) => {
    await expect(page.getByText("Nuevo honorario")).toBeVisible();
    await expect(page.getByPlaceholder(/patrocinio/i)).toBeVisible();
    await expect(page.getByText("Dividir en cuotas")).toBeVisible();
  });

  test("toggle cuotas muestra configuración", async ({ page }) => {
    await page.getByRole("button", { name: /dividir en cuotas/i }).click();
    await expect(page.getByText("Cantidad de cuotas")).toBeVisible();
    await expect(page.getByText("Intervalo")).toBeVisible();
    await expect(page.getByText("Día del mes")).toBeVisible();
  });

  test("moneda chips ARS y USD", async ({ page }) => {
    await expect(page.getByRole("button", { name: "$" })).toBeVisible();
    await expect(page.getByRole("button", { name: "U$D" })).toBeVisible();
  });

  test("error si falta concepto", async ({ page }) => {
    await page.getByRole("button", { name: /guardar honorario/i }).click();
    await expect(page.getByText(/concepto es obligatorio/i)).toBeVisible();
  });
});

test.describe("Registrar pago", () => {
  test("form de pago carga si hay honorario_id", async ({ page }) => {
    // Sin honorario_id válido muestra loading o error, no falla
    await page.goto("/honorarios/pago?honorario_id=test");
    // No debe redirigir ni crashear
    await expect(page).toHaveURL(/honorarios\/pago/);
  });
});
