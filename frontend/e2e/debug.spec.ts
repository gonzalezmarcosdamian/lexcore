import { test, expect } from "@playwright/test";

test("debug: qué URL/contenido tiene /movimientos/nuevo", async ({ page }) => {
  await page.goto("/movimientos/nuevo");
  await page.waitForTimeout(3000);
  console.log("URL actual:", page.url());
  console.log("Título:", await page.title());
  const body = await page.locator("body").innerText();
  console.log("Body (primeros 200):", body.slice(0, 200));
});
