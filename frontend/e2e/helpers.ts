import { Page } from "@playwright/test";
import { execSync } from "child_process";

function clearRateLimit() {
  try {
    execSync(
      `docker compose -f ../docker-compose.yml exec -T backend python -c "from sqlalchemy import text; from app.core.database import SessionLocal; db=SessionLocal(); db.execute(text('DELETE FROM login_attempts')); db.commit(); db.close()"`,
      { stdio: "ignore", timeout: 5000 }
    );
  } catch {}
}

/**
 * Cierra el SplashScreen y cualquier modal overlay que bloquee la UI.
 * El SplashScreen usa z-[100] y tiene fondo bg-ink-900/95.
 */
export async function dismissModals(page: Page) {
  await page.waitForLoadState("domcontentloaded");

  // Intentar cerrar SplashScreen haciendo click en él
  try {
    const splash = page.locator('div.fixed.inset-0').first();
    if (await splash.isVisible({ timeout: 1500 })) {
      // Click anywhere on the splash to dismiss
      await page.mouse.click(400, 300);
      await page.waitForTimeout(600);
    }
  } catch {}

  // Buscar botón "Empezar" o "Continuar" en el splash
  try {
    const btn = page.getByRole("button", { name: /empezar|continuar|entrar|comenzar|skip|omitir|listo/i }).first();
    if (await btn.isVisible({ timeout: 800 })) {
      await btn.click();
      await page.waitForTimeout(500);
    }
  } catch {}

  // Escape por las dudas
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // Si sigue un overlay, click en el botón de cierre
  try {
    const closeBtn = page.locator('button').filter({ hasText: /^[×✕×]$/ }).first();
    if (await closeBtn.isVisible({ timeout: 400 })) {
      await closeBtn.click();
      await page.waitForTimeout(200);
    }
  } catch {}
}

const E2E_EMAIL = process.env.E2E_EMAIL ?? "e2e.test@lexcore.dev";
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "TestLex2026!";

/**
 * Navega, hace re-login si la sesión expiró, y descarta modales.
 */
export async function goTo(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("domcontentloaded");

  // Re-login automático si la sesión expiró
  if (page.url().includes("/login")) {
    clearRateLimit();
    await page.locator('input[type="email"]').fill(E2E_EMAIL);
    await page.locator('input[type="password"]').fill(E2E_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/dashboard/, { timeout: 20000 });
    if (path !== "/dashboard") {
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");
    }
  }

  await page.waitForLoadState("networkidle");
  await dismissModals(page);
}
