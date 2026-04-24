/**
 * Setup: hace login con Google o email y guarda la sesión.
 * Se ejecuta UNA VEZ antes de todos los tests.
 *
 * Variables de entorno requeridas:
 *   E2E_EMAIL    — email del usuario de prueba
 *   E2E_PASSWORD — contraseña
 */
import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth/user.json");

setup("autenticar usuario de prueba", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error("Falta E2E_EMAIL o E2E_PASSWORD en las variables de entorno");
  }

  await page.goto("/login");

  // Esperar el formulario de login con email/password
  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByPlaceholder(/contraseña|password/i).fill(password);
  await page.getByRole("button", { name: /ingresar|login|entrar/i }).click();

  // Esperar que llegue al dashboard
  await page.waitForURL(/dashboard/, { timeout: 15000 });
  await expect(page.getByText(/bienvenido/i)).toBeVisible({ timeout: 10000 });

  // Guardar estado de autenticación
  await page.context().storageState({ path: authFile });
  console.log("✅ Sesión guardada en", authFile);
});
