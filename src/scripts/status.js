import { formDate } from "./utils.js";
import { getLocale, t } from "./i18n.js";

export const STATUS_HISTORY_MARKER = "<!-- lophos-status-history -->";

function normalizeText(value) {
    return (value || "").toString().trim();
}

export function isStatusHistoryTask(task) {
    const description = normalizeText(task?.description);
    const name = normalizeText(task?.name);

    return description.includes(STATUS_HISTORY_MARKER)
        || /^status whatsapp\b/i.test(name);
}

export function formatStatusDate(date, language) {
    const locale = getLocale(language);
    const parts = new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "numeric",
    }).formatToParts(date);

    const day = parts.find(part => part.type === "day")?.value || "";
    const month = parts.find(part => part.type === "month")?.value || "";

    if (language === "enUS") {
        return `${month}/${day}`;
    }

    return `${day}/${month}`;
}

function sortByDateOrderAndName(taskA, taskB) {
    const dateA = taskA?.date ? new Date(taskA.date).getTime() : 0;
    const dateB = taskB?.date ? new Date(taskB.date).getTime() : 0;
    if (dateA !== dateB) return dateA - dateB;

    const orderA = Number(taskA?.order ?? taskA?.board_order ?? 0);
    const orderB = Number(taskB?.order ?? taskB?.board_order ?? 0);
    if (orderA !== orderB) return orderA - orderB;

    return String(taskA?.name || "").localeCompare(String(taskB?.name || ""));
}

function sortBoardTasks(list) {
    return [...list].sort((taskA, taskB) => {
        const aCompleted = taskA.done ? 1 : 0;
        const bCompleted = taskB.done ? 1 : 0;
        if (aCompleted !== bCompleted) return aCompleted - bCompleted;

        const aOrder = Number(taskA.board_order ?? 0);
        const bOrder = Number(taskB.board_order ?? 0);
        if (aOrder !== bOrder) return aOrder - bOrder;

        return String(taskA.id).localeCompare(String(taskB.id));
    });
}

function sortBoardColumns(list) {
    return [...list].sort((columnA, columnB) => {
        const aOrder = Number(columnA.sort_order ?? 0);
        const bOrder = Number(columnB.sort_order ?? 0);
        if (aOrder !== bOrder) return aOrder - bOrder;

        const aCreatedAt = columnA.created_at || "";
        const bCreatedAt = columnB.created_at || "";
        if (aCreatedAt !== bCreatedAt) return String(aCreatedAt).localeCompare(String(bCreatedAt));

        return String(columnA.id).localeCompare(String(columnB.id));
    });
}

function formatTaskDate(task, language) {
    const taskDate = task?.date instanceof Date ? task.date : new Date(task?.date || new Date());
    return formatStatusDate(taskDate, language);
}

function buildSection(title, items) {
    if (!Array.isArray(items) || items.length === 0) return "";
    return [`*${title}*`, ...items].join("\n");
}

export function buildStatusText({
    language,
    weeklyOpenTasks = [],
    weeklyDoneTasks = [],
    boardColumns = [],
    boardTasks = [],
}) {
    const lines = [];

    const openSection = buildSection(
        t(language, "statusOpenSection"),
        weeklyOpenTasks
            .slice()
            .sort(sortByDateOrderAndName)
            .map(task => `* ${normalizeText(task.name)} - ${formatTaskDate(task, language)}`)
    );
    if (openSection) lines.push(openSection);

    const boardColumnItems = [];
    const sortedColumns = sortBoardColumns(boardColumns);
    const sortedBoardTasks = sortBoardTasks(boardTasks);

    sortedColumns.forEach(column => {
        const columnTasks = sortedBoardTasks.filter(task => String(task.board_column_id) === String(column.id));
        if (columnTasks.length === 0) return;

        const columnTitle = normalizeText(column.title) || t(language, "boardColumnUntitled");
        const body = columnTasks.map(task => `* ${normalizeText(task.name)}`);
        boardColumnItems.push(buildSection(columnTitle, body));
    });

    boardColumnItems.filter(Boolean).forEach(section => lines.push(section));

    const doneSection = buildSection(
        t(language, "statusDoneSection"),
        weeklyDoneTasks
            .slice()
            .sort(sortByDateOrderAndName)
            .map(task => `* ${normalizeText(task.name)}`)
    );
    if (doneSection) lines.push(doneSection);

    return lines.join("\n\n").trim();
}

export function buildStatusHistoryTaskPayload({
    text,
    language,
    date = new Date(),
    uid,
    agenda_id,
}) {
    const safeText = normalizeText(text);
    const today = date instanceof Date ? date : new Date(date);

    return {
        name: `Status WhatsApp - ${formatStatusDate(today, language)}`,
        description: `${STATUS_HISTORY_MARKER}\n\n${safeText}`,
        date: formDate(today),
        uid,
        agenda_id,
        color: "white text-black dark:text-white dark:bg-black",
        done: true,
        related_links: [],
        order: 9999,
    };
}
