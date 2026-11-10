import { expect, test } from "@playwright/test";

test("a live chase accepts an Over-War call", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Match Pulse" })).toBeVisible();
  await expect(page.getByTestId("feed-status")).toHaveText(/live|reconnecting|ended/, { timeout: 20_000 });
  await expect(page.getByRole("region", { name: "Score" })).toBeVisible();

  await page.getByTestId("demo-toggle").click();
  await page.getByRole("button", { name: /5×/ }).click();
  await page.keyboard.press("Escape");

  await expect(page.getByTestId("moment-card").first()).toBeVisible({ timeout: 25_000 });

  await page.getByTestId("tab-war").click();
  const yes = page.getByTestId("market-yes").first();
  await expect(yes).toBeVisible();
  if (await yes.isEnabled()) {
    await yes.click();
    await expect(page.getByText(/Locked|Pulse Points|In/i).first()).toBeVisible();
  }

  await page.getByTestId("tab-pod").click();
  await expect(page.getByRole("region", { name: "Pod" })).toBeVisible();
  await expect(page.getByText("Aisha", { exact: true }).first()).toBeVisible();
});
