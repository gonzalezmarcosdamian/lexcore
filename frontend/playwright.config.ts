import { defineConfig, devices } from "@playwright/test";
import { execSync } from "child_process";

/**
 * Playwright E2E config para LexCore.
 * Por defecto corre contra localhost:3001 (dev).
 * Para prod: BASE_URL=https://lexcore.app/... npx playwright test
 */
// Limpiar rate limiter antes de cada run para que el re-login funcione
try {
  execSync(
    `docker compose -f ../docker-compose.yml exec -T backend python -c "from sqlalchemy import text; from app.core.database import SessionLocal; db=SessionLocal(); db.execute(text('DELETE FROM login_attempts')); db.commit(); db.close()"`,
    { stdio: "ignore" }
  );
} catch {}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 12"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
});
