import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const ENV_FILES = [".env", ".env.local", ".env.test"];

function normalizeEnvValue(rawValue) {
    const trimmed = rawValue.trim();
    if (!trimmed) return "";

    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"'))
        || (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1);
    }

    return trimmed;
}

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith("#")) continue;

        const separatorIndex = trimmedLine.indexOf("=");
        if (separatorIndex <= 0) continue;

        const key = trimmedLine.slice(0, separatorIndex).trim();
        const value = normalizeEnvValue(trimmedLine.slice(separatorIndex + 1));

        if (!key || process.env[key]) continue;
        process.env[key] = value;
    }
}

for (const envFile of ENV_FILES) {
    loadEnvFile(path.resolve(envFile));
}

const baseURL = process.env.E2E_BASE_URL || "http://localhost:5173";
const usesLocalDevServer = /^https?:\/\/(localhost|127\.0\.0\.1):5173\/?$/.test(baseURL);

export default defineConfig({
    testDir: "./tests/e2e",
    timeout: 60_000,
    fullyParallel: false,
    retries: 0,
    reporter: "list",
    use: {
        baseURL,
        headless: true,
        trace: "off",
        screenshot: "off",
    },
    webServer: usesLocalDevServer
        ? {
            command: "cmd /c npm run dev -- --host 127.0.0.1 --port 5173",
            url: "http://127.0.0.1:5173",
            reuseExistingServer: true,
            timeout: 120_000,
        }
        : undefined,
});
