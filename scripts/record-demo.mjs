import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

await mkdir("docs/screenshots", { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  recordVideo: { dir: "docs/screenshots", size: { width: 390, height: 844 } },
});
const page = await context.newPage();
await page.goto("http://127.0.0.1:43123", { waitUntil: "domcontentloaded" });
await page.getByTestId("feed-status").waitFor();
await page.waitForTimeout(1500);
await page.getByTestId("demo-toggle").click();
await page.getByRole("button", { name: /5×/ }).click();
await page.keyboard.press("Escape");
await page.getByTestId("moment-card").first().waitFor({ timeout: 20000 });
await page.waitForTimeout(2500);
await page.getByTestId("tab-war").click();
await page.waitForTimeout(1200);
const yes = page.getByTestId("market-yes").first();
if (await yes.isEnabled().catch(() => false)) await yes.click();
await page.waitForTimeout(1200);
await page.getByTestId("tab-pod").click();
await page.waitForTimeout(1800);
await page.getByTestId("tab-pulse").click();
await page.waitForTimeout(800);
await page.getByTestId("tab-ask").click();
await page.getByRole("button", { name: "Explain DLS" }).click();
await page.waitForTimeout(1800);
await page.getByRole("button", { name: "Story" }).click();
await page.getByTestId("story-card").waitFor({ timeout: 10000 });
await page.waitForTimeout(2000);
const video = page.video();
await context.close();
const path = await video?.path();
if (path) {
  const { rename } = await import("node:fs/promises");
  await rename(path, "docs/screenshots/demo.webm");
  console.log("wrote docs/screenshots/demo.webm");
}
await browser.close();
