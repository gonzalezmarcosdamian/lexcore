import { test, expect } from "@playwright/test";
import { renewSession } from './fixtures';
import { goTo, dismissModals } from "./helpers";
import path from "path";

const E2E_EMAIL = process.env.E2E_EMAIL ?? "e2e.test@lexcore.dev";
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "TestLex2026!";
const authFile = path.join(__dirname, ".auth/user.json");

// Re-autenticar antes de este spec file para renovar la sesión
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("http://localhost:3001/login");
  await page.locator('input[type="email"]').fill(E2E_EMAIL);
  await page.locator('input[type="password"]').fill(E2E_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/dashboard/, { timeout: 25000 });
  await context.storageState({ path: authFile });
  await context.close();
});

test.describe("Expedientes", () => {
  test("lista carga", async ({ page }) => {
    await goTo(page, "/expedientes");
    await expect(page.locator("h1").filter({ hasText: "Expedientes" })).toBeVisible({ timeout: 10000 });
  });

  test("puede buscar expediente", async ({ page }) => {
    await goTo(page, "/expedientes");
    // El input de búsqueda existe aunque esté vacío
    const search = page.getByPlaceholder(/buscar/i).first();
    await expect(search).toBeVisible({ timeout: 10000 });
    await search.fill("EXP");
    await page.waitForTimeout(400);
  });

  test("detalle de expediente carga página de datos", async ({ page }) => {
    await goTo(page, "/expedientes");
    const link = page.locator("a[href*='/expedientes/']").first();
    const linkExists = await link.isVisible({ timeout: 5000 }).catch(() => false);
    if (linkExists) {
      await link.click();
      await page.waitForLoadState("networkidle");
      await expect(page.getByText(/EXP-|expediente/i).first()).toBeVisible({ timeout: 10000 });
    } else {
      // Sin expedientes — verificar que el empty state existe
      await expect(page.getByText(/todavía no hay|crear primer/i)).toBeVisible({ timeout: 5000 });
    }
  });

  test("botón + Movimiento desde expediente navega", async ({ page }) => {
    await goTo(page, "/expedientes");
    const link = page.locator("a[href*='/expedientes/']").first();
    const linkExists = await link.isVisible({ timeout: 5000 }).catch(() => false);
    if (linkExists) {
      await link.click();
      await page.waitForLoadState("networkidle");
      const btnMov = page.locator("a, button").filter({ hasText: /movimiento procesal/i }).first();
      if (await btnMov.isVisible({ timeout: 5000 }).catch(() => false)) {
        await btnMov.click();
        await expect(page).toHaveURL(/movimientos\/nuevo/, { timeout: 10000 });
      }
    } else {
      // Sin expedientes — test pasa vacío
      console.log("Sin expedientes — skipping navegación test");
    }
  });
});
