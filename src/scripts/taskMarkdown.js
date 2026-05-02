import TurndownService from "turndown";
import { marked } from "marked";
import DOMPurify from "dompurify";

export function autoLinkMarkdownUrls(markdown) {
    return (markdown || "").replace(/(^|[\s(])((https?:\/\/[^\s<>()]+))/g, "$1<$2>");
}

function getCalloutIconMarkup(calloutType) {
    if (calloutType === "warning" || calloutType === "caution") {
        return (
            `<span class="task-callout-icon" aria-hidden="true">` +
            `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">` +
            `<path d="M12 3.5 21 20.5H3L12 3.5Z" fill="currentColor" opacity="0.18"/>` +
            `<path d="M12 8.5V13.5M12 17.25H12.01M10.268 4.5 2.715 17.5C1.945 18.826 2.902 20.5 4.447 20.5H19.553C21.098 20.5 22.055 18.826 21.285 17.5L13.732 4.5C12.96 3.171 11.04 3.171 10.268 4.5Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>` +
            `</svg>` +
            `</span>`
        );
    }

    return (
        `<span class="task-callout-icon" aria-hidden="true">` +
        `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">` +
        `<circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.14"/>` +
        `<path d="M12 10V16M12 7.75H12.01M21 12C21 16.971 16.971 21 12 21S3 16.971 3 12 7.029 3 12 3 21 7.029 21 12Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>` +
        `</svg>` +
        `</span>`
    );
}

export function getCalloutIconButtonHtml(calloutType) {
    const iconMarkup = getCalloutIconMarkup(calloutType);
    return `<span class="task-callout-icon-button" contenteditable="false">${iconMarkup}</span>`;
}

function renderCalloutBodyMarkdown(bodyLines) {
    return bodyLines
        .map(line => line.replace(/^>\s?/, ""))
        .join("\n")
        .trim();
}

function replaceMarkdownCallouts(markdown) {
    const lines = (markdown || "").split("\n");
    const output = [];

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const match = line.match(/^>\s*\[!([A-Z]+)\]\s*(.*)$/i);

        if (!match) {
            output.push(line);
            continue;
        }

        const calloutType = match[1].toLowerCase();
        const title = (match[2] || "").trim();
        const bodyLines = [];

        index += 1;
        while (index < lines.length && /^>\s?/.test(lines[index])) {
            bodyLines.push(lines[index]);
            index += 1;
        }
        index -= 1;

        const bodyMarkdown = renderCalloutBodyMarkdown(bodyLines);
        const combinedBodyMarkdown = [title, bodyMarkdown].filter(Boolean).join("\n\n");
        const bodyHtml = marked.parse(combinedBodyMarkdown || "");
        output.push(
            `<div class="task-callout task-callout-${calloutType}">` +
            `${getCalloutIconButtonHtml(calloutType)}` +
            `<div class="task-callout-body">${bodyHtml}</div>` +
            `</div>`
        );
    }

    return output.join("\n");
}

function wrapRenderedTables(html) {
    if (!html) return "";

    const container = document.createElement("div");
    container.innerHTML = html;

    container.querySelectorAll("table").forEach(tableEl => {
        if (tableEl.parentElement?.classList?.contains("task-table-shell")) return;

        const wrapperEl = document.createElement("div");
        wrapperEl.className = "task-table-shell";
        tableEl.parentNode.insertBefore(wrapperEl, tableEl);
        wrapperEl.appendChild(tableEl);
    });

    return container.innerHTML;
}

export function sanitizeTaskHtml(html) {
    return DOMPurify.sanitize(html || "", {
        USE_PROFILES: { html: true },
        ADD_TAGS: ["svg", "path", "circle"],
        ADD_ATTR: [
            "class",
            "data-task-id",
            "contenteditable",
            "target",
            "rel",
            "viewBox",
            "fill",
            "xmlns",
            "d",
            "opacity",
            "stroke",
            "stroke-width",
            "stroke-linecap",
            "stroke-linejoin",
            "cx",
            "cy",
            "r",
            "aria-hidden",
            "data-cell-valign",
        ],
    });
}

export function renderTaskMarkdown(markdown) {
    const linkedMarkdown = autoLinkMarkdownUrls(markdown || "");
    const markdownWithCallouts = replaceMarkdownCallouts(linkedMarkdown);
    const rawHtml = marked.parse(markdownWithCallouts);
    const htmlWithMentions = rawHtml.replace(
        /<a href="#task:([^"]+)">/g,
        '<a href="#task:$1" data-task-id="$1" class="task-mention" contenteditable="false">'
    );
    const htmlWithWrappedTables = wrapRenderedTables(htmlWithMentions);

    return sanitizeTaskHtml(htmlWithWrappedTables);
}

function prefixMarkdownBlock(markdown) {
    return (markdown || "")
        .split("\n")
        .map(line => `> ${line}`)
        .join("\n");
}

function getNodeText(node, turndownService) {
    return turndownService
        .turndown(node.innerHTML || "")
        .replace(/\n+/g, " ")
        .trim()
        .replace(/\|/g, "\\|");
}

export function createTaskTurndownService() {
    const turndownService = new TurndownService({
        bulletListMarker: "-",
        codeBlockStyle: "fenced",
        emDelimiter: "*",
        strongDelimiter: "**",
        headingStyle: "atx",
    });

    turndownService.addRule("lineBreak", {
        filter: "br",
        replacement() {
            return "  \n";
        },
    });

    turndownService.addRule("taskCallout", {
        filter(node) {
            return node.nodeName === "DIV" && node.classList?.contains("task-callout");
        },
        replacement(_content, node) {
            const className = node.className || "";
            const typeMatch = className.match(/task-callout-([a-z]+)/);
            const calloutType = (typeMatch?.[1] || "note").toUpperCase();
            const bodyEl = node.querySelector(".task-callout-body");
            const bodyMarkdown = turndownService.turndown(bodyEl?.innerHTML || "").trim();
            const prefixedBody = bodyMarkdown ? `\n${prefixMarkdownBlock(bodyMarkdown)}` : "";
            return `\n\n> [!${calloutType}]${prefixedBody}\n\n`;
        },
    });

    turndownService.addRule("taskTable", {
        filter(node) {
            return node.nodeName === "DIV" && node.classList?.contains("task-table-shell");
        },
        replacement(_content, node) {
            return `\n\n${sanitizeTaskHtml(node.outerHTML)}\n\n`;
        },
    });

    return turndownService;
}
