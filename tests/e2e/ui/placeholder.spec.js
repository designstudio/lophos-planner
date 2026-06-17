import { test, expect } from "@playwright/test";

test("ui placeholder", async ({ page, baseURL }) => {
    await page.goto(baseURL || "/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/http:\/\/(localhost|127\.0\.0\.1):5173\/?/i);
});
