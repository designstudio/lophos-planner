import {
    autoLinkMarkdownUrls,
    htmlToTaskMarkdown,
    renderTaskMarkdown,
    wrapTaskNoteTablesHtml,
} from "./taskMarkdown.js";

export const TASK_NOTE_FORMAT_MARKDOWN = "markdown";
export const TASK_NOTE_FORMAT_BLOCKNOTE = "blocknote";

export function isTaskNoteBlocks(value) {
    return Array.isArray(value);
}

export function cloneTaskNoteBlocks(value) {
    if (!Array.isArray(value)) return [];

    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return [];
    }
}

export function normalizeTaskNote(task) {
    const markdown = (task?.description || "").toString();
    const rawBlocks = task?.note_blocks;
    const hasBlocks = isTaskNoteBlocks(rawBlocks) && rawBlocks.length > 0;
    const format = hasBlocks && task?.note_format === TASK_NOTE_FORMAT_BLOCKNOTE
        ? TASK_NOTE_FORMAT_BLOCKNOTE
        : TASK_NOTE_FORMAT_MARKDOWN;

    return {
        format,
        markdown,
        blocks: hasBlocks ? rawBlocks : null,
        plainText: (task?.note_plain_text || "").toString(),
        migratedAt: task?.note_migrated_at || null,
    };
}

function blockHasMeaningfulTextContent(block) {
    const content = block?.content;

    if (typeof content === "string") {
        return content.trim().length > 0;
    }

    if (Array.isArray(content)) {
        return content.some(item => {
            if (typeof item === "string") {
                return item.trim().length > 0;
            }

            if (item && typeof item === "object") {
                if (typeof item.text === "string" && item.text.trim().length > 0) {
                    return true;
                }

                if (Array.isArray(item.content)) {
                    return item.content.some(child => typeof child === "string" && child.trim().length > 0);
                }
            }

            return false;
        });
    }

    if (content && typeof content === "object") {
        if (typeof content.text === "string" && content.text.trim().length > 0) {
            return true;
        }

        if (Array.isArray(content.rows) && content.rows.length > 0) {
            return content.rows.some(row => {
                const cells = Array.isArray(row?.cells) ? row.cells : [];
                return cells.some(cell => {
                    const cellContent = Array.isArray(cell) ? cell : Array.isArray(cell?.content) ? cell.content : [];
                    return cellContent.some(childBlock => blockHasMeaningfulContent(childBlock));
                });
            });
        }
    }

    return false;
}

function blockHasMeaningfulContent(block) {
    if (!block || typeof block !== "object") return false;

    if (blockHasMeaningfulTextContent(block)) {
        return true;
    }

    if (Array.isArray(block.children) && block.children.some(child => blockHasMeaningfulContent(child))) {
        return true;
    }

    return false;
}

function blocksHaveMeaningfulContent(blocks) {
    return Array.isArray(blocks) && blocks.some(block => blockHasMeaningfulContent(block));
}

export function hasTaskNoteContent(task) {
    const note = normalizeTaskNote(task);
    return Boolean(
        note.markdown.trim()
        || note.plainText.trim()
        || blocksHaveMeaningfulContent(note.blocks)
    );
}

export function hasLegacyOnlyTaskNote(task) {
    const note = normalizeTaskNote(task);
    return note.format === TASK_NOTE_FORMAT_MARKDOWN && Boolean(note.markdown.trim());
}

export function containsLegacyCalloutSyntax(markdown) {
    return /^>\s*\[![A-Z]+\]/im.test((markdown || "").toString());
}

export function containsLegacyTaskHtml(markdown) {
    return /<div[^>]+class=["'][^"']*task-callout|<div[^>]+class=["'][^"']*task-table-shell/i.test((markdown || "").toString());
}

export function shouldFallbackLegacyTaskNote(markdown) {
    const source = (markdown || "").toString();
    if (!source.trim()) return false;
    return false;
}

function normalizeLegacyCalloutMarkdownForBlockNote(markdown) {
    const lines = (markdown || "").toString().split("\n");
    const normalizedLines = [];

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const match = line.match(/^>\s*\[!([A-Z]+)\]\s*(.*)$/i);

        if (!match) {
            normalizedLines.push(line);
            continue;
        }

        const title = (match[2] || "").trim();
        const bodyLines = [];

        index += 1;
        while (index < lines.length && /^>\s?/.test(lines[index])) {
            bodyLines.push(lines[index].replace(/^>\s?/, ""));
            index += 1;
        }
        index -= 1;

        const quoteLines = [title, ...bodyLines]
            .filter((entry, entryIndex, entries) => {
                if (entry.trim()) return true;
                const previous = entries[entryIndex - 1];
                const next = entries[entryIndex + 1];
                return Boolean(previous?.trim() || next?.trim());
            })
            .map(entry => `> ${entry}`);

        normalizedLines.push(...quoteLines);
    }

    return normalizedLines.join("\n");
}

export async function convertMarkdownTaskNoteToBlocks(editor, markdown) {
    const source = (markdown || "").toString();
    const normalizedMarkdown = normalizeLegacyCalloutMarkdownForBlockNote(source);

    if (!source.trim()) {
        return {
            blocks: [],
            fallback: false,
            fallbackHtml: "",
        };
    }

    if (shouldFallbackLegacyTaskNote(source)) {
        return {
            blocks: [],
            fallback: true,
            fallbackHtml: renderTaskMarkdown(source),
        };
    }

    const legacyHtml = renderTaskMarkdown(source);

    try {
        const blocks = await editor.tryParseHTMLToBlocks(legacyHtml);
        if (Array.isArray(blocks)) {
            return {
                blocks,
                fallback: false,
                fallbackHtml: "",
            };
        }
    } catch {
        // fall through to markdown parser
    }

    try {
        const blocks = await editor.tryParseMarkdownToBlocks(normalizedMarkdown);
        if (Array.isArray(blocks)) {
            return {
                blocks,
                fallback: false,
                fallbackHtml: "",
            };
        }
    } catch {
        // handled below
    }

    return {
        blocks: [],
        fallback: true,
        fallbackHtml: legacyHtml,
    };
}

export async function exportBlockNoteToTaskNotePayload(editor, options = {}) {
    const sourceBlocks = Array.isArray(options.blocks) ? options.blocks : editor.document;
    const blocks = cloneTaskNoteBlocks(sourceBlocks);
    const html = await editor.blocksToHTMLLossy(blocks);
    const markdownBackup = htmlToTaskMarkdown(wrapTaskNoteTablesHtml(html));
    const plainText = getPlainTextFromHtml(html);

    return {
        description: autoLinkMarkdownUrls(markdownBackup),
        note_format: TASK_NOTE_FORMAT_BLOCKNOTE,
        note_blocks: blocks,
        note_plain_text: plainText,
        note_migrated_at: options.migratedAt || new Date().toISOString(),
    };
}

export function getLegacyTaskNoteFallbackHtml(markdown) {
    return renderTaskMarkdown(markdown || "");
}

function getPlainTextFromHtml(html) {
    if (typeof document === "undefined") return "";

    const container = document.createElement("div");
    container.innerHTML = html || "";
    return (container.textContent || "")
        .replace(/\u00A0/g, " ")
        .replace(/\s+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
