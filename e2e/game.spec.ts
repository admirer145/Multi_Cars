import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const SUMMARY_TIMEOUT_MS = 18_000;

async function primeServiceWorkerCache(page: Page): Promise<void> {
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service workers are unavailable in this browser.");
    }

    await navigator.serviceWorker.ready;
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Multi Cars" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
}

async function startClassic(page: Page, optionName = /2 Cars/): Promise<void> {
  await page.getByRole("button", { name: /Classic Run/ }).click();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "classic-select");
  await page.getByRole("button", { name: optionName }).click();
}

test("boots to the React menu instead of active gameplay", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Multi Cars" })).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "menu");
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("starts Classic from the menu", async ({ page }) => {
  await page.goto("/");

  await startClassic(page);

  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "gameplay");
  await expect(page.locator("body")).toHaveAttribute("data-game-status", "running");
  await expect(page.locator("body")).toHaveAttribute("data-game-seed", "classic-v1-run-0");
  await expect(page.locator("body")).toHaveAttribute("data-car-count", "2");
});

test("starts one-car Classic with full-screen single input", async ({ page }) => {
  await page.goto("/");

  await startClassic(page, /1 Car/);

  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "gameplay");
  await expect(page.locator("body")).toHaveAttribute("data-car-count", "1");
  await expect(page.locator("body")).toHaveAttribute("data-game-seed", "classic-v1-1-car-run-0");
  await expect(page.locator("body")).toHaveAttribute("data-left-lane", "0");
  await expect(page.locator("body")).toHaveAttribute("data-right-lane", "");

  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("Canvas bounding box is unavailable.");
  }

  await canvas.click({ position: { x: box.width * 0.85, y: box.height * 0.76 } });
  await expect(page.locator("body")).toHaveAttribute("data-left-lane", "1");

  await page.keyboard.press("Space");
  await expect(page.locator("body")).toHaveAttribute("data-left-lane", "0");
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

test("starts Practice from drill selection", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Practice Drills/ }).click();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "practice-select");
  await page.getByRole("button", { name: /Left Hand Focus/ }).click();

  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "gameplay");
  await expect(page.locator("body")).toHaveAttribute("data-mode", "practice");
  await expect(page.locator("body")).toHaveAttribute("data-game-seed", "practice-left-hand-focus");
});

test("starts Daily from the menu", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Daily Road/ }).click();

  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "gameplay");
  await expect(page.locator("body")).toHaveAttribute("data-mode", "daily");
  await expect(page.locator("body")).toHaveAttribute("data-game-seed", /daily-\d{4}-\d{2}-\d{2}/);
});

test("routes Challenge failure to the React summary overlay", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Challenge Roads/ }).click();
  await page.getByRole("button", { name: /Focus Road I/ }).click();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "gameplay");

  await page.evaluate(() => window.__MULTI_CARS_TEST_FAIL__?.());

  await expect(page.locator("body")).toHaveAttribute("data-screen", "summary", { timeout: SUMMARY_TIMEOUT_MS });
  await expect(page.getByRole("button", { name: /Again/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  await expect
    .poll(async () => {
      const backBox = await page.getByRole("button", { name: "Back" }).boundingBox();
      const againBox = await page.getByRole("button", { name: /Again/ }).boundingBox();
      return Boolean(backBox && againBox && backBox.x < againBox.x);
    })
    .toBe(true);
  await expect(page.locator("canvas")).toBeVisible();
});

test("summary Back returns to Challenge road selection", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Challenge Roads/ }).click();
  await page.getByRole("button", { name: /Focus Road I/ }).click();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "gameplay");
  await page.evaluate(() => window.__MULTI_CARS_TEST_FAIL__?.());
  await expect(page.locator("body")).toHaveAttribute("data-screen", "summary", { timeout: SUMMARY_TIMEOUT_MS });

  await page.getByRole("button", { name: "Back" }).click();

  await expect(page.locator("body")).toHaveAttribute("data-screen", "challenge-select");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Challenge Roads" })).toBeVisible();
});

test("opens replay last mistake from summary without leaving summary", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Challenge Roads/ }).click();
  await page.getByRole("button", { name: /Focus Road I/ }).click();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "gameplay");
  await page.evaluate(() => window.__MULTI_CARS_TEST_FAIL__?.());
  await expect(page.locator("body")).toHaveAttribute("data-screen", "summary", { timeout: SUMMARY_TIMEOUT_MS });

  await page.getByRole("button", { name: "Replay Mistake" }).click();

  await expect(page.locator("body")).toHaveAttribute("data-replay-status", /playing|complete/);
  await expect(page.getByText("Mistake Replay")).toBeVisible();
  await expect(page.getByLabel("Replay of the final mistake")).toBeVisible();

  await page.getByRole("button", { name: "Close" }).click();

  await expect(page.locator("body")).toHaveAttribute("data-screen", "summary");
});

test("summary Back returns to Practice drill selection", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Practice Drills/ }).click();
  await page.getByRole("button", { name: /Left Hand Focus/ }).click();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "gameplay");
  await page.evaluate(() => window.__MULTI_CARS_TEST_FAIL__?.());
  await expect(page.locator("body")).toHaveAttribute("data-screen", "summary", { timeout: SUMMARY_TIMEOUT_MS });

  await page.getByRole("button", { name: "Back" }).click();

  await expect(page.locator("body")).toHaveAttribute("data-screen", "practice-select");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Practice Drills" })).toBeVisible();
});

test("browser back follows the same route from summary to selection", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Challenge Roads/ }).click();
  await page.getByRole("button", { name: /Focus Road I/ }).click();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "gameplay");
  await page.evaluate(() => window.__MULTI_CARS_TEST_FAIL__?.());
  await expect(page.locator("body")).toHaveAttribute("data-screen", "summary", { timeout: SUMMARY_TIMEOUT_MS });

  await page.goBack();

  await expect(page.locator("body")).toHaveAttribute("data-screen", "challenge-select");
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("R replays from summary and dismisses the overlay", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Keyboard shortcuts are desktop coverage.");

  await page.goto("/");

  await page.getByRole("button", { name: /Challenge Roads/ }).click();
  await page.getByRole("button", { name: /Focus Road I/ }).click();
  await expect(page.locator("body")).toHaveAttribute("data-screen", "gameplay");
  await page.evaluate(() => window.__MULTI_CARS_TEST_FAIL__?.());
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

test("opens Garage with achievements and cosmetic skins", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Garage/ }).click();

  await expect(page.locator("body")).toHaveAttribute("data-screen", "garage");
  await expect(page.getByRole("heading", { name: "Garage" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Achievements" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Car Skins" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Circuit/ })).toBeVisible();
});

test("classic speed settings persist and affect gameplay", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Control Room/ }).click();
  await page.getByLabel("Minimum level").selectOption("3");
  await page.getByLabel("Maximum level").selectOption("5");
  await expect(page.getByLabel("Minimum level")).toHaveValue("3");
  await expect(page.getByLabel("Maximum level")).toHaveValue("5");

  await page.reload();
  await page.getByRole("button", { name: /Control Room/ }).click();
  await expect(page.getByLabel("Minimum level")).toHaveValue("3");
  await expect(page.getByLabel("Maximum level")).toHaveValue("5");

  await page.getByRole("button").first().click();
  await startClassic(page);

  await expect(page.locator("body")).toHaveAttribute("data-screen", "gameplay");
  await expect(page.locator("body")).toHaveAttribute("data-speed-level", "3");
});

test("reloads the cached app shell offline with local settings intact", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Multi Cars" })).toBeVisible();
  await primeServiceWorkerCache(page);

  await page.getByRole("button", { name: /Control Room/ }).click();
  await page.getByLabel("Minimum level").selectOption("4");
  await expect(page.getByLabel("Minimum level")).toHaveValue("4");

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Multi Cars" })).toBeVisible();
  await page.getByRole("button", { name: /Control Room/ }).click();
  await expect(page.getByLabel("Minimum level")).toHaveValue("4");

  await context.setOffline(false);
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

  await startClassic(page);

  await expect(page.locator("body")).toHaveAttribute("data-screen", "gameplay");
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBe(0);
  await expect(page.locator("canvas")).toBeVisible();
});

test("mobile canvas taps are centered between left and right cars", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile touch split coverage.");

  await page.goto("/");
  await startClassic(page);
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

test("mobile supports separate active touches for both cars", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile multi-touch coverage.");

  await page.goto("/");
  await startClassic(page);
  await expect(page.locator("body")).toHaveAttribute("data-game-status", "running");

  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("Canvas bounding box is unavailable.");
  }

  const leftTouch = { x: box.x + box.width * 0.25, y: box.y + box.height * 0.76 };
  const rightTouch = { x: box.x + box.width * 0.75, y: box.y + box.height * 0.76 };
  const client = await page.context().newCDPSession(page);

  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      {
        x: Math.round(leftTouch.x),
        y: Math.round(leftTouch.y),
        id: 1,
      },
    ],
  });
  await expect(page.locator("body")).toHaveAttribute("data-left-lane", "1");
  await expect(page.locator("body")).toHaveAttribute("data-right-lane", "1");

  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      {
        x: Math.round(leftTouch.x),
        y: Math.round(leftTouch.y),
        id: 1,
      },
      {
        x: Math.round(rightTouch.x),
        y: Math.round(rightTouch.y),
        id: 2,
      },
    ],
  });

  await expect(page.locator("body")).toHaveAttribute("data-left-lane", "1");
  await expect(page.locator("body")).toHaveAttribute("data-right-lane", "0");

  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
});

test("accepts keyboard controls and pause", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Keyboard shortcuts are desktop coverage.");

  await page.goto("/");
  await startClassic(page);
  await expect(page.locator("body")).toHaveAttribute("data-game-status", "running");

  await page.keyboard.press("P");

  await expect(page.locator("body")).toHaveAttribute("data-game-status", "paused");
});

test("returns to menu from paused gameplay", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Keyboard shortcuts are desktop coverage.");

  await page.goto("/");
  await startClassic(page);
  await expect(page.locator("body")).toHaveAttribute("data-screen", "gameplay");

  await page.keyboard.press("P");
  await page.keyboard.press("M");

  await expect(page.locator("body")).toHaveAttribute("data-screen", "menu");
  await expect(page.locator("canvas")).toHaveCount(0);
});
