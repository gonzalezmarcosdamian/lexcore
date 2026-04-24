/**
 * Setup: login con email/password + guardar sesión completa.
 */
import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth/user.json");
const EMAIL = process.env.E2E_EMAIL ?? "e2e.test@lexcore.dev";
const PASSWORD = process.env.E2E_PASSWORD ?? "TestLex2026!";

setup("autenticar usuario de prueba", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  // Llenar formulario
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();

  // Esperar dashboard completo
  await page.waitForURL(/dashboard/, { timeout: 20000 });
  await page.waitForLoadState("networkidle");

  // Esperar que el session token esté disponible
  await page.waitForTimeout(2000);

  // Verificar cookies de sesión
  const cookies = await page.context().cookies();
  const sessionCookies = cookies.filter(c =>
    c.name.includes("session") || c.name.includes("next-auth")
  );
  console.log("Cookies de sesión:", sessionCookies.map(c => `${c.name}=${c.value.slice(0,20)}...`));

  // Verificar que estamos autenticados
  await expect(page.getByText(/bienvenido/i)).toBeVisible({ timeout: 5000 });

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
  console.log("✅ Sesión guardada:", EMAIL, "| Cookies:", cookies.length);
});
