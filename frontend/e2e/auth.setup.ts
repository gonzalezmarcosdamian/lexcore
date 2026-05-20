/**
 * Setup: login con email/password + guardar sesión completa.
 */
import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth/user.json");
const EMAIL = process.env.E2E_EMAIL ?? "e2e.test@lexcore.dev";
const PASSWORD = process.env.E2E_PASSWORD ?? "TestLex2026!";

setup("autenticar usuario de prueba", async ({ page }) => {
  // Login directo vía formulario con credenciales locales
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/dashboard/, { timeout: 20000 });
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/bienvenido/i)).toBeVisible({ timeout: 10000 });

  // Marcar splash/wizard como ya vistos para no bloquear los tests
  await page.evaluate(() => {
    localStorage.setItem("lexcore_onboarded", "1");
    localStorage.setItem("lexcore_wizard_done", "1");
  });

  // Crear expediente de prueba si no hay ninguno (para tests de expedientes)
  const token = await page.evaluate(() => {
    try { return (window as any).__NEXT_DATA__?.props?.pageProps?.session?.user?.backendToken; } catch { return null; }
  });
  if (token) {
    await page.request.post("http://localhost:8000/expedientes", {
      headers: { Authorization: `Bearer ${token}` },
      data: { caratula: "Expediente E2E Test", fuero: "Civil", juzgado: "Juzgado 1" }
    }).catch(() => {});
  }

  await page.context().storageState({ path: authFile });
  console.log("✅ Sesión guardada:", EMAIL);
});
