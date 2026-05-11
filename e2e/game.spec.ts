import { expect, test } from "@playwright/test";

const SUMMARY_TIMEOUT_MS = 18_000;

test("boots to the React menu instead of active gameplay", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Multi Cars" })).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "menu");
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("starts Classic from the menu", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Classic Run/ }).click();

  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "gameplay");
  await expect(page.locator("body")).toHaveAttribute("data-game-status", "running");
  await expect(page.locator("body")).toHaveAttribute("data-game-seed", "classic-v1-run-0");
});

test("starts Challenge from road selection", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Challenge Roads/ }).click();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "challenge-select");
  await page.getByRole("button", { name: /Focus Road I/ }).click();

  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "gameplay");
  await expect(page.locator("body")).toHaveAttribute("data-mode", "challenge");
  await expect(page.locator("body")).toHaveAttribute("data-game-seed", "challenge-starter-focus-01");
});

test("routes Challenge failure to the React summary overlay", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Challenge Roads/ }).click();
  await page.getByRole("button", { name: /Focus Road I/ }).click();

  await expect(page.locator("body")).toHaveAttribute("data-screen", "summary", { timeout: SUMMARY_TIMEOUT_MS });
  await expect(page.getByRole("button", { name: /Again/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
});

test("R replays from summary and dismisses the overlay", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Keyboard shortcuts are desktop coverage.");

  await page.goto("/");

  await page.getByRole("button", { name: /Challenge Roads/ }).click();
  await page.getByRole("button", { name: /Focus Road I/ }).click();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "summary", { timeout: SUMMARY_TIMEOUT_MS });

  await page.keyboard.press("R");

  await expect(page.locator("body")).toHaveAttribute("data-screen", "gameplay");
  await expect(page.getByRole("button", { name: /Again/ })).toHaveCount(0);
});

test("opens and closes settings from the menu", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Control Room/ }).click();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "settings");
  await page.getByRole("button").first().click();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "menu");
});

test("settings screen can scroll on mobile", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile scroll coverage.");

  await page.goto("/");

  await page.getByRole("button", { name: /Control Room/ }).click();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "settings");

  await page.mouse.wheel(0, 900);
  await expect(page.getByText("Cloud sync: later")).toBeVisible();
});

test("starting Classic from a scrolled mobile menu resets the gameplay viewport", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile scroll-to-gameplay coverage.");

  await page.goto("/");

  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.dataset.testid = "scroll-spacer";
    spacer.style.height = "1200px";
    document.body.appendChild(spacer);
    window.scrollTo(0, 500);
  });
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);

  await page.getByRole("button", { name: /Classic Run/ }).click();

  await expect(page.locator("body")).toHaveAttribute("data-screen", "gameplay");
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBe(0);
  await expect(page.locator("canvas")).toBeVisible();
});

test("mobile canvas taps are centered between left and right cars", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile touch split coverage.");

  await page.goto("/");
  await page.getByRole("button", { name: /Classic Run/ }).click();
  await expect(page.locator("body")).toHaveAttribute("data-game-status", "running");

  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("Canvas bounding box is unavailable.");
  }

  await canvas.click({ position: { x: box.width * 0.25, y: box.height * 0.76 } });
  await expect(page.locator("body")).toHaveAttribute("data-left-lane", "1");
  await expect(page.locator("body")).toHaveAttribute("data-right-lane", "1");

  await canvas.click({ position: { x: box.width * 0.75, y: box.height * 0.76 } });
  await expect(page.locator("body")).toHaveAttribute("data-left-lane", "1");
  await expect(page.locator("body")).toHaveAttribute("data-right-lane", "0");
});

test("accepts keyboard controls and pause", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Keyboard shortcuts are desktop coverage.");

  await page.goto("/");
  await page.getByRole("button", { name: /Classic Run/ }).click();
  await expect(page.locator("body")).toHaveAttribute("data-game-status", "running");

  await page.keyboard.press("P");

  await expect(page.locator("body")).toHaveAttribute("data-game-status", "paused");
});

test("returns to menu from paused gameplay", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Keyboard shortcuts are desktop coverage.");

  await page.goto("/");
  await page.getByRole("button", { name: /Classic Run/ }).click();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "gameplay");

  await page.keyboard.press("P");
  await page.keyboard.press("M");

  await expect(page.locator("body")).toHaveAttribute("data-screen", "menu");
  await expect(page.locator("canvas")).toHaveCount(0);
});
