import { test, expect } from "@playwright/test";

test.describe("Contable", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/contable");
  });

  test("carga con tabs Egresos e Ingresos", async ({ page }) => {
    await expect(page.getByRole("button", { name: /egresos/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /ingresos/i })).toBeVisible();
  });

  test("toggle Mes / Año visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: /^mes$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^año$/i })).toBeVisible();
  });

  test("switch a Ingresos funciona", async ({ page }) => {
    await page.getByRole("button", { name: /ingresos/i }).click();
    await expect(page.getByText(/total ars/i)).toBeVisible({ timeout: 5000 });
  });

  test("switch a vista anual funciona", async ({ page }) => {
    await page.getByRole("button", { name: /^año$/i }).click();
    // El label del período debe mostrar un año (4 dígitos)
    await expect(page.getByText(/202[0-9]/)).toBeVisible();
  });
});
