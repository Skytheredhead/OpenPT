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
  await expect.poll(async () => page.locator(".link-status-marker.up").count(), { message: "healthy link status markers" }).toBeGreaterThan(0);
  expect(errors, "browser console/page errors").toEqual([]);
});

test("topology link status markers show down, blocking, and activity states", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("openpt:viewMode", "app");
    localStorage.setItem("openpt:v1", JSON.stringify({
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
    }));
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
  await page.locator(".node").filter({ has: page.locator(".node-label", { hasText: "PC1" }) }).click();
  await page.locator(".node").filter({ has: page.locator(".node-label", { hasText: "PC2" }) }).click();
  await expect.poll(async () => page.locator(".link-status-marker.activity").count(), {
    message: "active link marker during packet animation",
    timeout: 2500,
  }).toBeGreaterThan(0);
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

  const placement = await page.locator(".node").first().evaluate((node) => {
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
  await expect(page.locator(".opts")).toBeVisible();
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
  await page.locator(".opt").first().click();
  await expect(page.locator(".feedback").first()).toBeVisible();
  await expect(page.locator(".feedback").first()).toContainText(/PASS|MISS|SLOW/);
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
  await page.getByRole("button", { name: /^Sign in$/ }).last().click();

  await expect(page.getByText("Map the Network Roles")).toBeVisible();
  await page.getByRole("button", { name: /Start mission/i }).first().click();
  await expect(page.locator(".learn-coach")).toBeVisible();
  await expect(page.getByText(/Before touching the topology/)).toBeVisible();
  await expect(page.locator(".node-label", { hasText: "PC1" })).toBeVisible();
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
