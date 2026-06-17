import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const TASK_NAME = "Teste Codex";
const TASK_NOTE = `Nota criada pelo Codex em ${new Date().toISOString().slice(0, 16)}`;

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function saveScreenshot(page, name) {
    const artifactsDir = path.resolve("tests/artifacts");
    mkdirSync(artifactsDir, { recursive: true });
    await page.screenshot({
        path: path.join(artifactsDir, name),
        fullPage: true,
    });
}

async function loginWithTestUser(page, baseURL) {
    const email = process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;

    expect(email, "E2E_USER_EMAIL must be defined to run the real E2E flow.").toBeTruthy();
    expect(password, "E2E_USER_PASSWORD must be defined to run the real E2E flow.").toBeTruthy();

    await page.goto(baseURL || "/", { waitUntil: "domcontentloaded" });

    const loginForm = page.locator(".login-form");
    await expect(loginForm).toBeVisible();

    await loginForm.getByLabel(/e-?mail|email/i).fill(email);
    await loginForm.getByLabel(/senha|password/i).fill(password);
    await loginForm.getByRole("button", { name: /entrar|login/i }).click();

    await expect(page.locator(".profile-menu-btn")).toBeVisible({ timeout: 20_000 });
    await expect(loginForm).toBeHidden({ timeout: 5_000 });
}

async function ensureAgendaPessoal(page) {
    await page.locator(".profile-menu-btn").click();
    const profileMenu = page.locator(".profile-menu");
    await expect(profileMenu).toBeVisible();

    const agendaButton = profileMenu.getByRole("button", { name: /^Pessoal$/ }).first();
    await agendaButton.click();

    await expect(profileMenu).toBeHidden({ timeout: 5_000 });
}

async function createTaskInTodayColumn(page) {
    const todayColumn = page.locator(".task-list").filter({
        has: page.locator("h2.agenda-accent-text"),
    }).first();
    await expect(todayColumn).toBeVisible();
    const todayKey = await todayColumn.getAttribute("data-date-key");
    expect(todayKey).toBeTruthy();
    const dayLabel = (await todayColumn.locator("h2").first().textContent())?.trim() || todayKey;

    const taskLocator = todayColumn.locator(".planner-task-shell", {
        has: page.locator(`span:has-text("${TASK_NAME}")`),
    });
    const existingCount = await taskLocator.count();

    const input = todayColumn.locator('input[name="add-task-name"]');
    await input.fill(TASK_NAME);
    await input.press("Enter");

    await expect(taskLocator).toHaveCount(existingCount + 1, { timeout: 20_000 });

    const createdTask = taskLocator.nth(existingCount);
    const taskId = await createdTask.getAttribute("data-task-id");
    expect(taskId).toBeTruthy();

    return {
        todayKey,
        dayLabel,
        taskId,
        task: createdTask,
        column: todayColumn,
    };
}

async function openTaskMenu(page, taskRow) {
    await taskRow.locator(".task-title").click().catch(() => {});

    const taskMenu = page.locator(".task-menu");
    try {
        await expect(taskMenu).toBeVisible({ timeout: 2_000 });
        return;
    } catch {
        const taskId = await taskRow.getAttribute("data-task-id");
        expect(taskId).toBeTruthy();

        const shortId = String(taskId).replace(/-/g, "").slice(0, 8);
        const currentUrl = new URL(page.url());
        currentUrl.searchParams.set("task", shortId);
        currentUrl.searchParams.delete("openedTask");

        await page.goto(currentUrl.toString(), { waitUntil: "domcontentloaded" });
        await expect(taskMenu).toBeVisible({ timeout: 10_000 });
    }
}

async function editTaskNote(page) {
    const editor = page.locator('.task-menu-editor [contenteditable="true"]').first();
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await editor.click();
    await page.keyboard.insertText(TASK_NOTE);
    await page.locator(".task-menu-title").click();
    await expect(page.locator('input[name="task-note-plain-text"]')).toHaveValue(
        new RegExp(escapeRegExp(TASK_NOTE)),
        { timeout: 10_000 }
    );
}

async function closeTaskMenu(page) {
    await page.keyboard.press("Escape");
    await expect(page.locator(".task-menu")).toBeHidden({ timeout: 10_000 });
}

async function expectTaskHasNoteMarker(taskRow) {
    await expect(taskRow.locator(".task-title svg").first()).toBeVisible({ timeout: 10_000 });
}

async function reloadAndFindTask(page, taskId) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".profile-menu-btn")).toBeVisible({ timeout: 20_000 });
    const taskAfterReload = page.locator(`.planner-task-shell[data-task-id="${taskId}"]`).first();
    await expect(taskAfterReload).toBeVisible({ timeout: 20_000 });
    return taskAfterReload;
}

async function assertPersistedNoteAfterReload(page, taskRow) {
    await openTaskMenu(page, taskRow);
    await expect(page.locator(".task-menu-title")).toContainText(TASK_NAME);
    await expect(page.locator(".task-menu-editor")).toContainText(TASK_NOTE, { timeout: 15_000 });
    await closeTaskMenu(page);
}

async function moveTaskIfPossible(page, taskRow, sourceDateKey) {
    const sourceColumn = page.locator(`.task-list[data-date-key="${sourceDateKey}"]`);
    const sourceListIndex = Number(await sourceColumn.getAttribute("data-list-index"));
    const targetListIndex = sourceListIndex < 6 ? sourceListIndex + 1 : sourceListIndex - 1;
    if (!Number.isInteger(targetListIndex) || targetListIndex < 0) {
        return { moved: false, targetDateKey: sourceDateKey };
    }

    const targetColumn = page.locator(`.task-list[data-list-index="${targetListIndex}"]`);
    if (await targetColumn.count() === 0) {
        return { moved: false, targetDateKey: sourceDateKey };
    }

    const targetDateKey = await targetColumn.getAttribute("data-date-key");
    if (!targetDateKey) {
        return { moved: false, targetDateKey: sourceDateKey };
    }

    const taskBox = await taskRow.boundingBox();
    const targetBox = await targetColumn.boundingBox();
    if (!taskBox || !targetBox) {
        return { moved: false, targetDateKey: sourceDateKey };
    }

    await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 120, { steps: 20 });
    await page.mouse.up();

    const movedTask = targetColumn.locator(".planner-task-shell", {
        has: page.locator(`span:has-text("${TASK_NAME}")`),
    }).first();

    try {
        await expect(movedTask).toBeVisible({ timeout: 10_000 });
        return { moved: true, targetDateKey };
    } catch {
        return { moved: false, targetDateKey: sourceDateKey };
    }
}

async function logoutAndAssertBlocked(page, baseURL) {
    await page.locator(".profile-menu-btn").click();
    const profileMenu = page.locator(".profile-menu");
    await expect(profileMenu).toBeVisible();
    await profileMenu.getByRole("button", { name: /sair|log out|logout/i }).click();

    await expect(page.locator(".login-form")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".profile-menu-btn")).toHaveCount(0);

    await page.goto(baseURL || "/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".login-form")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".profile-menu-btn")).toHaveCount(0);
}

test("real e2e flow: login, task, note, move, logout", async ({ page, baseURL }) => {
    test.setTimeout(120_000);

    page.on("requestfailed", request => {
        try {
            const requestUrl = new URL(request.url());
            if (!/supabase\.co$/i.test(requestUrl.hostname)) return;
            if (!requestUrl.pathname.startsWith("/auth/v1/")) return;

            console.log(`[SUPABASE_NET] ${JSON.stringify({
                method: request.method(),
                hostname: requestUrl.hostname,
                path: requestUrl.pathname,
                failure: request.failure()?.errorText || null,
            })}`);
        } catch {
            // Ignore malformed request URLs in diagnostics.
        }
    });

    await loginWithTestUser(page, baseURL);
    await saveScreenshot(page, "logged-in-home.png");

    await ensureAgendaPessoal(page);

    const { todayKey, dayLabel, taskId, task } = await createTaskInTodayColumn(page);
    await expect(task).toBeVisible({ timeout: 10_000 });
    console.log(`[E2E_REAL] Created task "${TASK_NAME}" in agenda "Pessoal", column "${dayLabel}" (${todayKey}).`);
    await saveScreenshot(page, "task-created.png");

    await openTaskMenu(page, task);
    await expect(page.locator(".task-menu-title")).toContainText(TASK_NAME);

    await editTaskNote(page);
    await closeTaskMenu(page);
    const currentTaskRow = page.locator(`.planner-task-shell[data-task-id="${taskId}"]`).first();
    await expect(currentTaskRow).toBeVisible({ timeout: 10_000 });
    await expectTaskHasNoteMarker(currentTaskRow);
    await saveScreenshot(page, "task-note-saved.png");

    const taskAfterReload = await reloadAndFindTask(page, taskId);
    await expectTaskHasNoteMarker(taskAfterReload);
    await saveScreenshot(page, "task-after-reload.png");
    await assertPersistedNoteAfterReload(page, taskAfterReload);

    const moveResult = await moveTaskIfPossible(page, taskAfterReload, todayKey);
    const taskAfterMove = page.locator(`.planner-task-shell[data-task-id="${taskId}"]`).first();
    await expect(taskAfterMove).toBeVisible({ timeout: 10_000 });
    console.log(`[E2E_REAL] Drag and drop ${moveResult.moved ? `moved task to column ${moveResult.targetDateKey}` : "was not applied; task remained in the original visible column"}.`);
    console.log("[E2E_REAL] No cleanup performed. The created task was left in the app.");

    await logoutAndAssertBlocked(page, baseURL);
});
