import { test, expect } from "@playwright/test";

function collectPageErrors(page) {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

test("lab loads and starter flow creates a topology", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("openpt:viewMode", "app");
  });

  await page.goto("/lab/");
  await expect(page).toHaveTitle("OpenPT");
  await expect(page.locator(".tb-logo")).toContainText("OpenPT");
  await expect(page.getByRole("button", { name: "Starter Lab" })).toBeVisible();

  await page.getByRole("button", { name: "Starter Lab" }).click();
  await expect.poll(async () => page.locator(".node").count(), { message: "starter topology node count" }).toBeGreaterThanOrEqual(5);
  await expect(page.locator(".node-label", { hasText: "R1" })).toBeVisible();
  expect(errors, "browser console/page errors").toEqual([]);
});

test("quiz library loads and can start practice", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.addInitScript(() => localStorage.clear());

  await page.goto("/quiz/?view=library");
  await expect(page).toHaveTitle("OpenPT Quiz v0.1");
  await expect(page.locator(".home-brand-name")).toContainText("OpenPT");
  await expect(page.getByRole("button", { name: /Start practice/i })).toBeVisible();

  await page.getByRole("button", { name: /Start practice/i }).click();
  await expect(page.locator(".qcard-text")).toBeVisible();
  await expect(page.locator(".opts")).toBeVisible();
  expect(errors, "browser console/page errors").toEqual([]);
});

test("jeopardy board and scoring flow work", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.addInitScript(() => {
    localStorage.setItem("openpt:jeopardy", JSON.stringify({
      deckId: "all",
      seed: "automation-seed",
      teams: [
        { id: "team-1", name: "Team 1", score: 0 },
        { id: "team-2", name: "Team 2", score: 0 },
        { id: "team-3", name: "Team 3", score: 0 },
      ],
      answered: {},
      musicEnabled: false,
      finalScored: {},
    }));
  });

  await page.goto("/jeopardy");
  await expect(page).toHaveTitle("OpenPT Jeopardy");
  await expect(page.locator(".jeopardy-header-stat")).toContainText("25");
  await expect(page.locator(".jeopardy-category")).toHaveCount(5);
  await expect(page.locator(".jeopardy-category", { hasText: "Automation" })).toBeVisible();
  await expect(page.locator(".jeopardy-board .jeopardy-tile")).toHaveCount(25);

  const headerAlignment = await page.locator(".jeopardy-header-stat").evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const view = el.ownerDocument.defaultView;
    return {
      alignItems: view.getComputedStyle(el).alignItems,
      justifyContent: view.getComputedStyle(el).justifyContent,
      center: Math.round(rect.top + rect.height / 2),
      childCenters: [...el.children].map((child) => {
        const childRect = child.getBoundingClientRect();
        return Math.round(childRect.top + childRect.height / 2);
      }),
    };
  });
  expect(headerAlignment.alignItems).toBe("center");
  expect(headerAlignment.justifyContent).toBe("center");
  expect(headerAlignment.childCenters).toEqual([headerAlignment.center, headerAlignment.center]);

  await page.locator(".jeopardy-board .jeopardy-tile").first().click();
  await page.getByRole("button", { name: "Show Choices" }).click();
  await expect(page.locator(".jeopardy-choice-list li")).toHaveCount(4);
  const choiceLayout = await page.locator(".jeopardy-modal").evaluate((modal) => {
    const body = modal.querySelector(".jeopardy-modal-body");
    const modalRect = modal.getBoundingClientRect();
    const choices = [...modal.querySelectorAll(".jeopardy-choice-list li")];
    return {
      bodyHasVerticalOverflow: body.scrollHeight > body.clientHeight + 1,
      choicesInsideModal: choices.every((choice) => {
        const rect = choice.getBoundingClientRect();
        return rect.top >= modalRect.top && rect.bottom <= modalRect.bottom;
      }),
    };
  });
  expect(choiceLayout.bodyHasVerticalOverflow).toBe(false);
  expect(choiceLayout.choicesInsideModal).toBe(true);
  await page.getByRole("button", { name: "Reveal Answer" }).click();
  await page.locator(".jeopardy-awards button", { hasText: /^Correct$/ }).first().click();
  await expect(page.locator(".jeopardy-header-stat strong")).toHaveText("24");
  await expect(page.locator(".jeopardy-team strong").first()).toHaveText("100");
  await expect(page.locator(".jeopardy-tile.answered")).toHaveCount(1);

  await page.getByRole("button", { name: "Final Jeopardy" }).click();
  const firstFinalTeam = page.locator(".jeopardy-final-team").first();
  await firstFinalTeam.locator("input").fill("50");
  await firstFinalTeam.locator("button").first().click();
  await expect(page.locator(".jeopardy-team strong").first()).toHaveText("150");
  await expect(firstFinalTeam.locator("input")).toBeDisabled();
  await expect(firstFinalTeam.locator("button").first()).toBeDisabled();
  await firstFinalTeam.locator("button").first().click({ force: true }).catch(() => {});
  await expect(page.locator(".jeopardy-team strong").first()).toHaveText("150");

  expect(errors, "browser console/page errors").toEqual([]);
});
