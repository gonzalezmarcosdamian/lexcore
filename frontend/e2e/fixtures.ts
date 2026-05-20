/**
 * beforeAll reutilizable para renovar storageState antes de cada spec file.
 * Usar en specs que corren después del setup (la sesión puede expirar).
 *
 * Uso:
 *   import { renewSession } from "./fixtures";
 *   test.beforeAll(renewSession);
 */
import { BrowserContextOptions } from "@playwright/test";
import path from "path";

const E2E_EMAIL = process.env.E2E_EMAIL ?? "e2e.test@lexcore.dev";
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "TestLex2026!";
export const authFile = path.join(__dirname, ".auth/user.json");

export async function renewSession({ browser }: { browser: import("@playwright/test").Browser }) {
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:3001/login");
  await pg.locator('input[type="email"]').fill(E2E_EMAIL);
  await pg.locator('input[type="password"]').fill(E2E_PASSWORD);
  await pg.locator('button[type="submit"]').click();
  await pg.waitForURL(/dashboard/, { timeout: 25000 });
  await ctx.storageState({ path: authFile });
  await ctx.close();
}
