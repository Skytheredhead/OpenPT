import { test, expect } from "@playwright/test";

function collectPageErrors(page) {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    if (/BABEL.*deoptimised the styling of \/app\.jsx/.test(msg.text())) return;
    errors.push(msg.text());
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
  await expect
    .poll(async () => page.locator(".link-status-marker.up").count(), { message: "healthy link status markers" })
    .toBeGreaterThan(0);
  await page.getByTitle("Open CCNA guided lessons").click();
  await expect(page).toHaveURL(/\/learn$/);
  await expect(page.getByText("OpenPT Learn")).toBeVisible();
  expect(errors, "browser console/page errors").toEqual([]);
});

test("generated autograded lab catalog loads with report dashboard", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("openpt:viewMode", "app");
  });

  await page.goto("/lab/?lab=openpt-vlan-campus-vlan-access-trunks");
  await expect(page.locator(".node-label", { hasText: "ASW1" })).toBeVisible();
  await expect(page.locator(".node-label", { hasText: "DSW1" })).toBeVisible();
  await expect(page.locator(".pt-sb-title")).toContainText("Campus Access VLANs and Trunk");
  await page.locator(".side-tab", { hasText: "Progress" }).click();
  await expect(page.locator(".pt-autograder-report")).toContainText("Autograder report");
  await expect(page.locator(".pt-autograder-report")).toContainText("Checks");

  await page.locator(".tb-menu").filter({ hasText: "Lab" }).click();
  await expect(page.locator(".tb-dropdown")).toContainText("60 autograded labs");
  await expect(page.locator(".tb-dropdown")).toContainText("deterministic assessment checks");
  await expect(page.locator(".tb-dropdown")).toContainText("Campus Access VLANs and Trunk");
  expect(errors, "browser console/page errors").toEqual([]);
});

test("topology link status markers show down, blocking, and activity states", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("openpt:viewMode", "app");
    localStorage.setItem(
      "openpt:v1",
      JSON.stringify({
        tabs: [{ id: "w-0", name: "status-markers.opt" }],
        activeWid: "w-0",
        starterScreenVisible: false,
        snapshots: {
          "w-0": {
            selectedIds: [],
            openConsoles: [],
            activeBottom: "events",
            ptActivity: null,
            ptSidebarOpen: false,
            devices: {
              r1: {
                id: "r1",
                kind: "router",
                hostname: "R1",
                name: "R1",
                platform: "isr4321",
                powered: true,
                x: 180,
                y: 180,
                interfaces: {
                  "GigabitEthernet0/0/0": { up: false, admUp: false },
                },
              },
              sw1: {
                id: "sw1",
                kind: "l2switch",
                hostname: "SW1",
                name: "SW1",
                platform: "2960-24tt",
                powered: true,
                x: 430,
                y: 180,
                interfaces: {
                  "FastEthernet0/1": { up: true, admUp: true, mode: "access", vlan: 1, stp: { state: "forwarding" } },
                  "FastEthernet0/2": { up: true, admUp: true, mode: "access", vlan: 1, stp: { state: "blocking" } },
                },
              },
              sw2: {
                id: "sw2",
                kind: "l2switch",
                hostname: "SW2",
                name: "SW2",
                platform: "2960-24tt",
                powered: true,
                x: 680,
                y: 180,
                interfaces: {
                  "FastEthernet0/1": { up: true, admUp: true, mode: "access", vlan: 1, stp: { state: "forwarding" } },
                },
              },
            },
            links: [
              { id: "down-link", a: "r1", ai: "GigabitEthernet0/0/0", b: "sw1", bi: "FastEthernet0/1", type: "copper", up: false },
              { id: "blocking-link", a: "sw1", ai: "FastEthernet0/2", b: "sw2", bi: "FastEthernet0/1", type: "copper", up: true },
            ],
          },
        },
      })
    );
  });

  await page.goto("/lab/");
  await expect(page.locator(".node-label", { hasText: "R1" })).toBeVisible();
  await expect(page.locator('.link-status-marker.down[data-link-id="down-link"]')).toHaveCount(2);
  await expect(page.locator('.link-status-marker.blocking[data-link-id="blocking-link"]')).toHaveCount(1);
  expect(errors, "browser console/page errors").toEqual([]);
});

test("packet mode marks active cable endpoints as link activity", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("openpt:viewMode", "app");
  });

  await page.goto("/lab/");
  await page.getByRole("button", { name: "Starter Lab" }).click();
  await expect(page.locator(".node-label", { hasText: "PC1" })).toBeVisible();

  await page.locator('.tab-tool[title="Packet mode (P)"]').click();
  await page
    .locator(".node")
    .filter({ has: page.locator(".node-label", { hasText: "PC1" }) })
    .click();
  await page
    .locator(".node")
    .filter({ has: page.locator(".node-label", { hasText: "PC2" }) })
    .click();
  await expect
    .poll(async () => page.locator(".link-status-marker.activity").count(), {
      message: "active link marker during packet animation",
      timeout: 2500,
    })
    .toBeGreaterThan(0);
  expect(errors, "browser console/page errors").toEqual([]);
});

test("palette drop keeps the device at the release point", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("openpt:viewMode", "app");
  });

  await page.goto("/lab/");
  await page.getByRole("button", { name: "New Blank" }).click();

  const canvas = page.locator(".canvas-wrap");
  await expect(canvas).toBeVisible();
  await expect(page.locator(".node")).toHaveCount(0);

  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).toBeTruthy();
  const dropPoint = { x: 110, y: 130 };

  await page.locator(".tb-menu").filter({ hasText: "Devices" }).click();
  await expect(page.locator(".tb-dropdown")).toBeVisible();
  await page.locator(".tb-dropdown [draggable]").first().dragTo(canvas, {
    targetPosition: dropPoint,
  });
  await expect(page.locator(".node")).toHaveCount(1);

  const placement = await page
    .locator(".node")
    .first()
    .evaluate((node) => {
      const nodeRect = node.getBoundingClientRect();
      const canvasRect = node.closest(".canvas-wrap").getBoundingClientRect();
      return {
        x: nodeRect.left + nodeRect.width / 2 - canvasRect.left,
        y: nodeRect.top + nodeRect.height / 2 - canvasRect.top,
        canvasCenterX: canvasRect.width / 2,
        canvasCenterY: canvasRect.height / 2,
      };
    });

  expect(Math.abs(placement.x - dropPoint.x)).toBeLessThan(35);
  expect(Math.abs(placement.y - dropPoint.y)).toBeLessThan(35);
  expect(Math.hypot(placement.x - placement.canvasCenterX, placement.y - placement.canvasCenterY)).toBeGreaterThan(80);
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
  await expect(page.getByRole("button", { name: /^[A-E1-5] / }).first()).toBeVisible();
  expect(errors, "browser console/page errors").toEqual([]);
});

test("ccna study mode is login gated and records a timed answer", async ({ page, request }) => {
  const errors = collectPageErrors(page);
  await page.addInitScript(() => localStorage.clear());

  await page.goto("/quiz/?view=library");
  await page.getByText("ALL Quiz").click();
  await expect(page.getByRole("button", { name: /CCNA Study Mode/i })).toBeVisible();
  await page.getByRole("button", { name: /CCNA Study Mode/i }).click();
  await expect(page.getByText("Sign in to save CCNA Study Mode progress.")).toBeVisible();

  const email = `study-browser-${Date.now()}@example.com`;
  const password = "password123";
  const register = await request.post("/api/auth/register", { data: { email, password } });
  expect(register.status()).toBe(202);
  const registered = await register.json();
  expect(registered.verification?.token).toBeTruthy();
  const verify = await request.post("/api/auth/verify-email", { data: { token: registered.verification.token } });
  expect(verify.status()).toBe(200);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /Sign in and start/i }).click();
  await expect(page.getByText(/CCNA Study Mode \/ question 1 of 20/)).toBeVisible();
  await page
    .getByRole("button", { name: /^[A-E] / })
    .first()
    .click();
  const answerButtons = page.getByRole("button", { name: /^[A-E] / });
  if (
    await page
      .getByText(/\(Choose two\.\)/i)
      .isVisible({ timeout: 500 })
      .catch(() => false)
  ) {
    await answerButtons.nth(1).click();
  } else if (
    await page
      .getByText(/\(Choose three\.\)/i)
      .isVisible({ timeout: 500 })
      .catch(() => false)
  ) {
    await answerButtons.nth(1).click();
    await answerButtons.nth(2).click();
  }
  const submitAnswer = page.getByRole("button", { name: "Submit answer" });
  if (await submitAnswer.isVisible({ timeout: 1000 }).catch(() => false)) {
    await submitAnswer.click();
  }
  await expect(page.getByRole("button", { name: "Next question" })).toBeVisible();
  expect(errors, "browser console/page errors").toEqual([]);
});

test("ccna guided lesson mode is login gated and starts a simulator mission", async ({ page, request }) => {
  const errors = collectPageErrors(page);
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("openpt:viewMode", "app");
  });

  await page.goto("/learn/");
  await expect(page.getByText("Sign in to start guided CCNA missions.")).toBeVisible();
  await expect(page.getByText("Progress, XP, streaks, and badges are saved to your OpenPT account.")).toHaveCount(0);
  await expect(page.getByLabel("Learning progress")).toHaveCount(0);
  await expect(page.getByText(/Start where you left off/i)).toHaveCount(0);

  const email = `lesson-browser-${Date.now()}@example.com`;
  const password = "password123";
  const register = await request.post("/api/auth/register", { data: { email, password } });
  expect(register.status()).toBe(202);
  const registered = await register.json();
  const verify = await request.post("/api/auth/verify-email", { data: { token: registered.verification.token } });
  expect(verify.status()).toBe(200);

  await page.getByRole("button", { name: /Sign in to learn/i }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page
    .getByRole("button", { name: /^Sign in$/ })
    .last()
    .click();

  await expect(page.getByText("Map the Network Roles")).toBeVisible();
  const firstMissionButton = page.getByRole("button", { name: /Start first mission: Map the Network Roles/i });
  await expect(firstMissionButton).toBeVisible();
  await expect(page.getByText("No strengths yet.")).toBeVisible();
  await expect(page.getByText("No review topics yet.")).toBeVisible();
  await expect(page.getByText(/Start where you left off/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reset all progress" })).toBeVisible();
  await page.getByRole("button", { name: "Reset all progress" }).click();
  await expect(page.getByText(/Are you sure\? This will clear every completed checkpoint/)).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: /01 Map the Network Roles/ }).click({ button: "right" });
  await expect(page.getByRole("button", { name: "Reset lesson progress" })).toBeVisible();
  await page.mouse.click(4, 4);
  await firstMissionButton.click();
  await expect(page).toHaveURL(/\/learn\/sem1-m1-3-network-roles$/);
  await expect(page.locator(".learn-lesson-intro h1")).toHaveText("Map the Network Roles");
  await expect(page.getByRole("heading", { name: /Before touching the topology/ })).toBeVisible();
  await expect(page.locator(".learn-workbench")).toBeVisible();
  await expect(page.locator(".node-label", { hasText: "PC1" })).toBeVisible();
  await expect(page.locator(".learn-coach")).toHaveCount(0);

  const quizPagePromise = page.context().waitForEvent("page");
  await page
    .getByRole("link", { name: /Quiz practice/i })
    .first()
    .click();
  const quizPage = await quizPagePromise;
  await quizPage.waitForLoadState("domcontentloaded");
  await expect(quizPage).toHaveURL(/\/quiz\/\?bank=ccna%2Fsem-01%2Fm-1-3&mode=practice/);
  await quizPage.close();
  await expect(page).toHaveURL(/\/learn\/sem1-m1-3-network-roles$/);

  await page.setViewportSize({ width: 390, height: 800 });
  await expect(page.locator(".lesson-mobile-sheet")).toBeVisible();
  await page.getByRole("button", { name: "Tools" }).click();
  await expect(page.locator(".lesson-mobile-tools").getByRole("button", { name: /Cable/i })).toBeVisible();
  await expect(page.locator(".lesson-mobile-tools").getByRole("button", { name: /Packet/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Fit topology/i })).toHaveCount(0);
  expect(errors, "browser console/page errors").toEqual([]);
});

test("feedback send stays disabled until content is entered", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("openpt:viewMode", "app");
  });

  await page.goto("/lab/");
  await page.getByRole("button", { name: "Feedback" }).click();
  await expect(page.locator(".feedback-submit")).toBeDisabled();
  await page.getByLabel("content").fill("The lesson wording was clear.");
  await expect(page.locator(".feedback-submit")).toBeEnabled();
  expect(errors, "browser console/page errors").toEqual([]);
});

test("jeopardy board and scoring flow work", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.addInitScript(() => {
    localStorage.setItem(
      "openpt:jeopardy",
      JSON.stringify({
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
      })
    );
  });

  await page.goto("/jeopardy");
  await expect(page).toHaveTitle("OpenPT Jeopardy");
  await expect(page.locator(".jeopardy-category")).toHaveCount(5);
  await expect(page.locator(".jeopardy-category", { hasText: "Management" })).toBeVisible();
  await expect(page.locator(".jeopardy-board .jeopardy-tile")).toHaveCount(25);

  await page.locator(".jeopardy-board .jeopardy-tile").first().click();
  await expect(page.locator(".jeopardy-modal")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".jeopardy-modal")).toBeHidden();
  await expect(page.locator(".jeopardy-tile.answered")).toHaveCount(0);

  await page.locator(".jeopardy-board .jeopardy-tile").first().click();
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
  await page
    .locator(".jeopardy-awards button", { hasText: /^Correct$/ })
    .first()
    .click();
  await expect(page.locator(".jeopardy-team strong").first()).toHaveText("100");
  await expect(page.locator(".jeopardy-tile.answered")).toHaveCount(1);

  await page.getByRole("button", { name: "Final" }).click();
  const firstFinalTeam = page.locator(".jeopardy-final-team").first();
  await firstFinalTeam.locator("input").fill("50");
  await firstFinalTeam.locator("button").first().click();
  await expect(page.locator(".jeopardy-team strong").first()).toHaveText("150");
  await expect(firstFinalTeam.locator("input")).toBeDisabled();
  await expect(firstFinalTeam.locator("button").first()).toBeDisabled();
  await firstFinalTeam
    .locator("button")
    .first()
    .click({ force: true })
    .catch(() => {});
  await expect(page.locator(".jeopardy-team strong").first()).toHaveText("150");

  expect(errors, "browser console/page errors").toEqual([]);
});

test("jeopardy daily double wagers cannot exceed the legal maximum", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.addInitScript(() => {
    localStorage.setItem(
      "openpt:jeopardy",
      JSON.stringify({
        deckId: "all",
        seed: "automation-seed",
        teams: [
          { id: "team-1", name: "Team 1", score: 500 },
          { id: "team-2", name: "Team 2", score: 0 },
          { id: "team-3", name: "Team 3", score: 0 },
        ],
        answered: {},
        musicEnabled: false,
        finalScored: {},
        activeTeamId: "team-1",
      })
    );
  });

  await page.goto("/jeopardy");
  await page.locator('.jeopardy-board .jeopardy-tile[data-daily-double="true"]').first().click();
  const wagerInput = page.locator(".jeopardy-daily-wager input");
  await expect(wagerInput).toBeVisible();
  await expect(page.locator(".jeopardy-daily-wager")).toContainText("Max 500");
  await wagerInput.fill("100000");
  await expect(wagerInput).toHaveValue("500");
  await expect(page.locator(".jeopardy-toast")).toContainText("You can only wager up to 500");
  await expect(page.locator(".jeopardy-toast")).toContainText("your current score or the clue value");
  await page
    .locator(".jeopardy-awards button", { hasText: /^Correct$/ })
    .first()
    .click();
  await expect(page.locator(".jeopardy-team strong").first()).toHaveText("1000");

  expect(errors, "browser console/page errors").toEqual([]);
});
