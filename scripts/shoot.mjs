import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const out = process.argv[2] ?? "docs/screenshots";
await mkdir(out, { recursive: true });

const browser = await chromium.launch();

async function shoot(name, width, height, steps) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto("http://127.0.0.1:43123", { waitUntil: "domcontentloaded" });
  await page.getByTestId("feed-status").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.body.innerText.includes("live") || document.body.innerText.includes("LIVE"), null, { timeout: 15000 });
  await steps(page);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false });
  await page.close();
  console.log("wrote", name);
}

await shoot("mobile-pulse", 390, 844, async (page) => {
  await page.getByTestId("demo-toggle").click();
  await page.getByRole("button", { name: /5×/ }).click();
  await page.keyboard.press("Escape");
  await page.getByTestId("moment-card").first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(2200);
});

await shoot("mobile-war", 390, 844, async (page) => {
  await page.getByTestId("tab-war").click();
  await page.getByTestId("market-yes").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
});

await shoot("mobile-pod", 390, 844, async (page) => {
  await page.getByTestId("demo-toggle").click();
  await page.getByRole("button", { name: "Over 11" }).click();
  await page.keyboard.press("Escape");
  await page.getByTestId("tab-pod").click();
  await page.getByText("Stand meter").waitFor();
  await page.waitForTimeout(800);
});

await shoot("mobile-ask", 390, 844, async (page) => {
  await page.getByTestId("tab-ask").click();
  await page.getByRole("button", { name: "What does the chase need?" }).click();
  await page.getByText("Desk voice").waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
});

await shoot("mobile-story", 390, 844, async (page) => {
  await page.getByTestId("demo-toggle").click();
  await page.getByRole("button", { name: "Over 16" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Story" }).click();
  await page.getByTestId("story-card").waitFor({ timeout: 10000 });
  await page.waitForTimeout(400);
});

await shoot("desktop", 1440, 900, async (page) => {
  await page.getByTestId("demo-toggle").click();
  await page.getByRole("button", { name: "Over 16" }).click();
  await page.keyboard.press("Escape");
  await page.getByTestId("moment-card").first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(2000);
});

await browser.close();
