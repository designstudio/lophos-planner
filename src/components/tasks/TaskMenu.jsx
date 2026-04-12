import React, {useEffect, useLayoutEffect} from "react";
import Blur from "../Blur.jsx";
import TaskMenuBtn from "./TaskMenuBtn.jsx";
import {Form, useSearchParams} from "react-router-dom";
import {tryCatchDecorator, deleteTask, getUserTasks} from "../../scripts/api.js";
import {useTaskMenu} from "../../contexts/TaskMenuContext.jsx";
import { Heading01, Bold01, Italic01, Strikethrough01, Dotpoints01, Trash03, Calendar, CheckCircle, Plus, X, Edit02, ChevronLeft, ChevronRight } from "@untitledui/icons";
import { useAuth } from "../../contexts/AuthContext.jsx";
import TurndownService from "turndown";
import { marked } from "marked";
import { getAppLanguage, getLocale, t } from "../../scripts/i18n.js";
import { parseDateOnly, toShortId } from "../../scripts/utils.js";

const turndownService = new TurndownService({
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    strongDelimiter: "**",
    headingStyle: "atx",
});

function autoLinkMarkdownUrls(markdown) {
    // Wrap bare URLs in angle brackets so Markdown consistently renders them as links.
    return markdown.replace(/(^|[\s(])((https?:\/\/[^\s<>()]+))/g, "$1<$2>");
}

function normalizeSearchText(text) {
    return (text || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function renderTaskDescription(markdown) {
    const rawHtml = marked.parse(markdown || "");
    return rawHtml.replace(
        /<a href="#task:([^"]+)">/g,
        '<a href="#task:$1" data-task-id="$1" class="task-mention" contenteditable="false">'
    );
}

function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameDay(dateA, dateB) {
    return dateA.getFullYear() === dateB.getFullYear()
        && dateA.getMonth() === dateB.getMonth()
        && dateA.getDate() === dateB.getDate();
}

function toInputDate(date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getElementFromNode(node) {
    if (!node) return null;
    return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
}

function isSelectionInsideEditor(editorEl, selection) {
    if (!editorEl || !selection || selection.rangeCount === 0) return false;

    const anchorElement = getElementFromNode(selection.anchorNode);
    const focusElement = getElementFromNode(selection.focusNode);

    return Boolean(
        anchorElement && editorEl.contains(anchorElement)
        && focusElement && editorEl.contains(focusElement)
    );
}

function getActiveEditorFormats(editorEl) {
    const selection = window.getSelection();
    const emptyState = {
        heading: false,
        bold: false,
        italic: false,
        strikethrough: false,
        "unordered-list": false,
    };

    if (!isSelectionInsideEditor(editorEl, selection)) {
        return emptyState;
    }

    const focusElement = getElementFromNode(selection.focusNode);
    if (!focusElement) return emptyState;

    const closest = selector => focusElement.closest(selector);

    return {
        heading: Boolean(closest("h1, h2, h3, h4, h5, h6")),
        bold: Boolean(closest("strong, b")),
        italic: Boolean(closest("em, i")),
        strikethrough: Boolean(closest("s, strike")),
        "unordered-list": Boolean(closest("ul, li")),
    };
}

function getMentionMatch(editorEl) {
    const selection = window.getSelection();
    if (!editorEl || !selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;
    if (!isSelectionInsideEditor(editorEl, selection)) return null;

    const focusNode = selection.focusNode;
    if (!focusNode || focusNode.nodeType !== Node.TEXT_NODE) return null;

    const textBeforeCaret = focusNode.textContent.slice(0, selection.focusOffset);
    const match = textBeforeCaret.match(/(?:^|\s)@([^\s@]*)$/);
    if (!match) return null;

    const query = match[1] || "";
    const startOffset = selection.focusOffset - query.length - 1;
    if (startOffset < 0) return null;

    const caretRange = selection.getRangeAt(0).cloneRange();
    caretRange.collapse(true);

    return {
        query,
        textNode: focusNode,
        startOffset,
        endOffset: selection.focusOffset,
        caretRange,
    };
}

const TaskMenu = () => {

    const {taskData, setTaskData} = useTaskMenu();
    const [searchParams, setSearchParams] = useSearchParams();
    const { currentUser } = useAuth();
    const {id: taskId, date, color, name, done, description} = taskData;
    const language = getAppLanguage(currentUser?.language);
    const locale = getLocale(language);
    const selectedDate = React.useMemo(() => {
        if (!date) return null;
        return parseDateOnly(date);
    }, [date]);
    const relatedLinks = React.useMemo(() => {
        const rawLinks = taskData.relatedLinks ?? taskData.related_links;
        if (!Array.isArray(rawLinks)) return [];

        return rawLinks
            .filter(link => link && typeof link === "object")
            .map(link => ({
                name: (link.name || "").toString(),
                url: (link.url || "").toString(),
            }));
    }, [taskData.relatedLinks, taskData.related_links]);
    const titleInputRef = React.useRef(null);
    const formRef = React.useRef(null);
    const datePickerContainerRef = React.useRef(null);
    const editorRef = React.useRef(null);
    const markdownInputRef = React.useRef(null);
    const toolbarSentinelRef = React.useRef(null);
    const toolbarRef = React.useRef(null);
    const mentionStateRef = React.useRef(null);
    const skipNextEditorBlurSyncRef = React.useRef(false);
    const hasToolbarStickyStateChangedRef = React.useRef(false);
    const isToolbarStickyRef = React.useRef(false);
    const [newRelatedLinkName, setNewRelatedLinkName] = React.useState("");
    const [newRelatedLinkUrl, setNewRelatedLinkUrl] = React.useState("");
    const [editingRelatedLinkIndex, setEditingRelatedLinkIndex] = React.useState(null);
    const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);
    const [calendarMonth, setCalendarMonth] = React.useState(() => startOfMonth(new Date()));
    const [isToolbarSticky, setIsToolbarSticky] = React.useState(false);
    const [activeEditorFormats, setActiveEditorFormats] = React.useState(() => getActiveEditorFormats(null));
    const [initialDescriptionSnapshot, setInitialDescriptionSnapshot] = React.useState("");
    const [isDescriptionDirty, setIsDescriptionDirty] = React.useState(false);
    const [agendaTasks, setAgendaTasks] = React.useState([]);
    const [isMentionMenuOpen, setIsMentionMenuOpen] = React.useState(false);
    const [mentionQuery, setMentionQuery] = React.useState("");
    const [mentionPosition, setMentionPosition] = React.useState({ top: 0, left: 0 });
    const [selectedMentionIndex, setSelectedMentionIndex] = React.useState(0);
    const openedTaskId = searchParams.get("openedTask");

    useLayoutEffect(() => {
        if (titleInputRef.current) {
            titleInputRef.current.value = name || "";
            autoResizeTitle();
        }
    }, [name, taskId]);

    useEffect(() => {
        if (editorRef.current) {
            editorRef.current.innerHTML = description ? renderTaskDescription(description) : "";
        }

        if (markdownInputRef.current) {
            markdownInputRef.current.value = description || "";
        }

        setNewRelatedLinkName("");
        setNewRelatedLinkUrl("");
        setEditingRelatedLinkIndex(null);
        setIsDatePickerOpen(false);
        setCalendarMonth(startOfMonth(selectedDate || new Date()));
        setActiveEditorFormats(getActiveEditorFormats(editorRef.current));
        setInitialDescriptionSnapshot(description || "");
        setIsDescriptionDirty(false);
        setIsMentionMenuOpen(false);
        setMentionQuery("");
        setSelectedMentionIndex(0);
        mentionStateRef.current = null;
    }, [openedTaskId, taskId, selectedDate]);

    useEffect(() => {
        let isCancelled = false;

        async function loadAgendaTasks() {
            if (!currentUser?.uid || !currentUser?.currentAgendaId) {
                if (!isCancelled) {
                    setAgendaTasks([]);
                }
                return;
            }

            const result = await tryCatchDecorator(getUserTasks)(currentUser.uid, currentUser.currentAgendaId);
            if (!result.success || isCancelled) return;

            setAgendaTasks(Array.isArray(result.data) ? result.data : []);
        }

        loadAgendaTasks();
        return () => {
            isCancelled = true;
        };
    }, [currentUser?.uid, currentUser?.currentAgendaId]);

    useEffect(() => {
        if (!openedTaskId || !titleInputRef.current) return;

        const titleEl = titleInputRef.current;
        const resizeTitleSafely = () => autoResizeTitle();
        const rafId = requestAnimationFrame(() => {
            resizeTitleSafely();
            requestAnimationFrame(resizeTitleSafely);
        });

        let resizeObserver = null;
        if (typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver(resizeTitleSafely);
            const panelEl = titleEl.closest(".task-menu");
            if (panelEl) {
                resizeObserver.observe(panelEl);
            }
        }

        return () => {
            cancelAnimationFrame(rafId);
            resizeObserver?.disconnect();
        };
    }, [openedTaskId, taskId, name]);

    useEffect(() => {
        if (!isDatePickerOpen) return;

        const handlePointerDownOutside = ev => {
            const pickerContainer = datePickerContainerRef.current;
            if (!pickerContainer?.contains(ev.target)) {
                setIsDatePickerOpen(false);
            }
        };

        document.addEventListener("pointerdown", handlePointerDownOutside);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDownOutside);
        };
    }, [isDatePickerOpen]);

    useEffect(() => {
        isToolbarStickyRef.current = isToolbarSticky;
    }, [isToolbarSticky]);

    useEffect(() => {
        setIsToolbarSticky(false);
        isToolbarStickyRef.current = false;
        hasToolbarStickyStateChangedRef.current = false;

        const sentinel = toolbarSentinelRef.current;
        if (!sentinel) return;

        const root = sentinel.closest('.blur-bg[data-id="task-menu"]');
        if (!root) return;

        // Activate sticky only after toolbar crosses the visible top edge.
        const STICKY_ACTIVATE_OFFSET_PX = -1;
        const STICKY_DEACTIVATE_OFFSET_PX = 4;
        let frameId = null;

        const syncStickyState = () => {
            frameId = null;
            const currentSticky = isToolbarStickyRef.current;
            const rootRect = root.getBoundingClientRect();
            const sentinelRect = sentinel.getBoundingClientRect();
            const sentinelOffsetFromViewportTop = sentinelRect.top - rootRect.top;

            const nextSticky = currentSticky
                ? sentinelOffsetFromViewportTop <= STICKY_DEACTIVATE_OFFSET_PX
                : sentinelOffsetFromViewportTop <= STICKY_ACTIVATE_OFFSET_PX;

            if (nextSticky !== currentSticky) {
                isToolbarStickyRef.current = nextSticky;
                setIsToolbarSticky(nextSticky);
            }
        };

        const requestSync = () => {
            if (frameId !== null) return;
            frameId = requestAnimationFrame(syncStickyState);
        };

        requestSync();
        root.addEventListener("scroll", requestSync, { passive: true });
        window.addEventListener("resize", requestSync);

        return () => {
            if (frameId !== null) {
                cancelAnimationFrame(frameId);
            }
            root.removeEventListener("scroll", requestSync);
            window.removeEventListener("resize", requestSync);
        };
    }, [openedTaskId, taskId]);

    useEffect(() => {
        const toolbarEl = toolbarRef.current;
        if (!toolbarEl) return;

        if (!hasToolbarStickyStateChangedRef.current) {
            hasToolbarStickyStateChangedRef.current = true;
            return;
        }

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        toolbarEl.getAnimations().forEach(animation => animation.cancel());

        if (!isToolbarSticky) {
            toolbarEl.style.opacity = "";
            toolbarEl.style.transform = "";
            return;
        }

        const enterAnimation = toolbarEl.animate(
            [
                { opacity: 0, transform: "translateY(10px) scale(0.96)" },
                { opacity: 1, transform: "translateY(0) scale(1)" },
            ],
            {
                duration: 220,
                easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            }
        );
        enterAnimation.onfinish = () => {
            toolbarEl.style.opacity = "";
            toolbarEl.style.transform = "";
        };
    }, [isToolbarSticky]);

    function normalizeLinkUrl(url) {
        const trimmed = url.trim();
        if (!trimmed) return "";
        if (/^https?:\/\//i.test(trimmed)) return trimmed;
        return `https://${trimmed}`;
    }

    function addOrUpdateRelatedLink(ev) {
        ev.preventDefault();

        const nameValue = newRelatedLinkName.trim();
        const urlValue = normalizeLinkUrl(newRelatedLinkUrl);
        if (!urlValue) return;

        setTaskData(prevTaskData => ({
            ...prevTaskData,
            relatedLinks: (() => {
                const prevLinks = Array.isArray(prevTaskData.relatedLinks) ? prevTaskData.relatedLinks : [];
                const nextLink = {
                    name: nameValue || urlValue,
                    url: urlValue,
                };

                if (editingRelatedLinkIndex === null) {
                    return [...prevLinks, nextLink];
                }

                return prevLinks.map((link, index) =>
                    index === editingRelatedLinkIndex ? nextLink : link
                );
            })(),
        }));

        setNewRelatedLinkName("");
        setNewRelatedLinkUrl("");
        setEditingRelatedLinkIndex(null);
    }

    function removeRelatedLink(index) {
        setTaskData(prevTaskData => {
            const prevLinks = Array.isArray(prevTaskData.relatedLinks) ? prevTaskData.relatedLinks : [];
            return {
                ...prevTaskData,
                relatedLinks: prevLinks.filter((_, curIndex) => curIndex !== index),
            };
        });
    }

    function startEditingRelatedLink(index) {
        const link = relatedLinks[index];
        if (!link) return;

        setEditingRelatedLinkIndex(index);
        setNewRelatedLinkName(link.name || "");
        setNewRelatedLinkUrl(link.url || "");
    }

    function cancelEditingRelatedLink() {
        setEditingRelatedLinkIndex(null);
        setNewRelatedLinkName("");
        setNewRelatedLinkUrl("");
    }

    function handleRelatedLinkKeyDown(ev) {
        if (ev.key !== "Enter") return;
        ev.preventDefault();
        ev.stopPropagation();
        addOrUpdateRelatedLink(ev);
    }

    const serializedRelatedLinks = React.useMemo(() => {
        return JSON.stringify(
            relatedLinks
                .map(link => {
                    const normalizedUrl = normalizeLinkUrl(link.url || "");
                    const normalizedName = (link.name || "").trim();
                    return {
                        name: normalizedName || normalizedUrl,
                        url: normalizedUrl,
                    };
                })
                .filter(link => link.url)
        );
    }, [relatedLinks]);

    const mentionSuggestions = React.useMemo(() => {
        const normalizedQuery = normalizeSearchText(mentionQuery);

        return agendaTasks
            .filter(task => String(task.id) !== String(taskId))
            .filter(task => {
                if (!normalizedQuery) return true;
                return normalizeSearchText(task.name).includes(normalizedQuery);
            })
            .slice(0, 8);
    }, [agendaTasks, mentionQuery, taskId]);

    useEffect(() => {
        setSelectedMentionIndex(0);
    }, [mentionQuery]);

    function autoResizeTitle() {
        if (!titleInputRef.current) return;
        const titleEl = titleInputRef.current;
        titleEl.style.height = "auto";
        const nextHeight = Math.max(titleEl.scrollHeight + 4, 52);
        titleEl.style.height = `${nextHeight}px`;
    }

    function syncEditorToMarkdown() {
        if (skipNextEditorBlurSyncRef.current) {
            skipNextEditorBlurSyncRef.current = false;
            return;
        }

        if (!editorRef.current || !markdownInputRef.current) return;

        const previousMarkdown = markdownInputRef.current.value;
        const html = editorRef.current.innerHTML;
        const markdown = html === "<br>" ? "" : turndownService.turndown(html).trim();
        const linkedMarkdown = autoLinkMarkdownUrls(markdown);

        markdownInputRef.current.value = linkedMarkdown;
        if (linkedMarkdown !== previousMarkdown) {
            setIsDescriptionDirty(true);
        }
        setTaskData(prevTaskData => ({
            ...prevTaskData,
            description: linkedMarkdown,
        }));
        setActiveEditorFormats(getActiveEditorFormats(editorRef.current));
    }

    function syncActiveEditorFormats() {
        setActiveEditorFormats(getActiveEditorFormats(editorRef.current));
    }

    function closeMentionMenu() {
        mentionStateRef.current = null;
        setIsMentionMenuOpen(false);
        setMentionQuery("");
        setSelectedMentionIndex(0);
    }

    function syncMentionMenu() {
        const editorEl = editorRef.current;
        const formEl = formRef.current;
        if (!editorEl || !formEl) {
            closeMentionMenu();
            return;
        }

        const mentionMatch = getMentionMatch(editorEl);
        if (!mentionMatch) {
            closeMentionMenu();
            return;
        }

        const caretRect = mentionMatch.caretRange.getBoundingClientRect();
        const formRect = formEl.getBoundingClientRect();
        mentionStateRef.current = mentionMatch;
        setMentionQuery(mentionMatch.query);
        setMentionPosition({
            top: Math.max(caretRect.bottom - formRect.top + 12, 0),
            left: Math.max(caretRect.left - formRect.left, 0),
        });
        setIsMentionMenuOpen(true);
    }

    function focusEditor() {
        editorRef.current?.focus();
    }

    function runEditorCommand(command, value = null) {
        focusEditor();
        document.execCommand(command, false, value);
        syncEditorToMarkdown();
        syncActiveEditorFormats();
        syncMentionMenu();
    }

    function handleEditorPaste(ev) {
        const html = ev.clipboardData?.getData("text/html");
        const text = ev.clipboardData?.getData("text/plain");

        if (!html && !text) return;

        ev.preventDefault();

        const markdown = html
            ? turndownService.turndown(html).trim()
            : (text || "").trim();

        if (!markdown) return;

        const renderedHtml = renderTaskDescription(markdown);

        focusEditor();
        document.execCommand("insertHTML", false, renderedHtml);
        syncEditorToMarkdown();
        syncActiveEditorFormats();
        syncMentionMenu();
    }

    function insertTaskMention(task) {
        const mentionMatch = mentionStateRef.current;
        if (!task || !mentionMatch) return;

        const range = document.createRange();
        range.setStart(mentionMatch.textNode, mentionMatch.startOffset);
        range.setEnd(mentionMatch.textNode, mentionMatch.endOffset);
        range.deleteContents();

        const mentionEl = document.createElement("a");
        mentionEl.href = `#task:${task.id}`;
        mentionEl.textContent = `@${task.name}`;
        mentionEl.className = "task-mention";
        mentionEl.setAttribute("data-task-id", String(task.id));
        mentionEl.setAttribute("contenteditable", "false");

        const spacer = document.createTextNode(" ");
        const fragment = document.createDocumentFragment();
        fragment.appendChild(mentionEl);
        fragment.appendChild(spacer);
        range.insertNode(fragment);

        const selection = window.getSelection();
        const nextRange = document.createRange();
        nextRange.setStartAfter(spacer);
        nextRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(nextRange);

        syncEditorToMarkdown();
        syncActiveEditorFormats();
        closeMentionMenu();
        focusEditor();
    }

    function handleEditorKeyDown(ev) {
        if (!isMentionMenuOpen || mentionSuggestions.length === 0) return;

        if (ev.key === "ArrowDown") {
            ev.preventDefault();
            setSelectedMentionIndex(prevIndex => (prevIndex + 1) % mentionSuggestions.length);
            return;
        }

        if (ev.key === "ArrowUp") {
            ev.preventDefault();
            setSelectedMentionIndex(prevIndex => (prevIndex - 1 + mentionSuggestions.length) % mentionSuggestions.length);
            return;
        }

        if (ev.key === "Enter" || ev.key === "Tab") {
            ev.preventDefault();
            insertTaskMention(mentionSuggestions[selectedMentionIndex] || mentionSuggestions[0]);
            return;
        }

        if (ev.key === "Escape") {
            ev.preventDefault();
            closeMentionMenu();
        }
    }

    function handleEditorClick(ev) {
        const mentionLink = ev.target.closest?.("a[data-task-id]");
        if (!mentionLink) return;

        ev.preventDefault();
        ev.stopPropagation();
        skipNextEditorBlurSyncRef.current = true;

        const referencedTaskId = mentionLink.getAttribute("data-task-id");
        if (!referencedTaskId) return;

        const referencedTask = agendaTasks.find(task => String(task.id) === String(referencedTaskId));
        if (referencedTask) {
            const rawLinks = referencedTask.relatedLinks ?? referencedTask.related_links;
            const normalizedLinks = Array.isArray(rawLinks)
                ? rawLinks
                    .filter(link => link && typeof link === "object")
                    .map(link => ({
                        name: (link.name || "").toString(),
                        url: (link.url || "").toString(),
                    }))
                : [];

            setTaskData({
                ...referencedTask,
                relatedLinks: normalizedLinks,
            });
        }

        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set("openedTask", toShortId(referencedTaskId));
            return next;
        });
    }

    useEffect(() => {
        const handleSelectionChange = () => {
            syncActiveEditorFormats();
            syncMentionMenu();
        };

        document.addEventListener("selectionchange", handleSelectionChange);

        return () => {
            document.removeEventListener("selectionchange", handleSelectionChange);
        };
    }, []);

    async function delTask(ev) {
        const result = await tryCatchDecorator(deleteTask)(taskId);
        if (!result.success) return;

        window.dispatchEvent(new CustomEvent("task-deleted", {
            detail: { taskId },
        }));

        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.delete("openedTask");
            return next;
        });
    }

    const taskMenuBtns = [
        {
            icon: Trash03,
            onClick: delTask,
            disabled: false,
            tooltip: t(language, "taskMenuDelete"),
        },
    ]

    const getDate = date => {
        if (!date) return t(language, "taskMenuDateFallback");
        return new Intl.DateTimeFormat(locale, {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
        }).format(date).replaceAll(".", "");
    }

    const weekStartIndex = currentUser?.weekStartsOn === "Sunday" ? 0 : 1;
    const weekdayLabels = React.useMemo(() => {
        const baseSunday = new Date(2024, 0, 7);

        return Array.from({ length: 7 }, (_, index) => {
            const weekDate = new Date(baseSunday);
            weekDate.setDate(baseSunday.getDate() + ((weekStartIndex + index) % 7));

            return new Intl.DateTimeFormat(locale, { weekday: "short" })
                .format(weekDate)
                .replaceAll(".", "")
                .toLowerCase();
        });
    }, [locale, weekStartIndex]);

    const calendarTitle = React.useMemo(() => {
        const formatted = new Intl.DateTimeFormat(locale, {
            month: "long",
            year: "numeric",
        }).format(calendarMonth);

        return formatted.replace(/^./, chr => chr.toUpperCase());
    }, [calendarMonth, locale]);

    const calendarDays = React.useMemo(() => {
        const monthStart = startOfMonth(calendarMonth);
        const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
        const offset = (monthStart.getDay() - weekStartIndex + 7) % 7;
        const totalCells = Math.ceil((offset + monthEnd.getDate()) / 7) * 7;

        return Array.from({ length: totalCells }, (_, index) => {
            const cellDate = new Date(monthStart);
            cellDate.setDate(monthStart.getDate() - offset + index);

            return {
                date: cellDate,
                key: toInputDate(cellDate),
                inCurrentMonth: cellDate.getMonth() === calendarMonth.getMonth(),
                isSelected: selectedDate ? isSameDay(cellDate, selectedDate) : false,
            };
        });
    }, [calendarMonth, selectedDate, weekStartIndex]);

    function changeCalendarMonth(delta) {
        setCalendarMonth(prevMonth => new Date(prevMonth.getFullYear(), prevMonth.getMonth() + delta, 1));
    }

    function handleDateSelect(nextDate) {
        setTaskData(prevTaskData => ({
            ...prevTaskData,
            date: new Date(nextDate),
        }));
        setCalendarMonth(startOfMonth(nextDate));
        setIsDatePickerOpen(false);
    }

    const editorToolbarButtons = [
        { key: "heading", label: t(language, "heading"), icon: Heading01, action: () => runEditorCommand("formatBlock", "h3") },
        { key: "bold", label: t(language, "bold"), icon: Bold01, action: () => runEditorCommand("bold") },
        { key: "italic", label: t(language, "italic"), icon: Italic01, action: () => runEditorCommand("italic") },
        { key: "strikethrough", label: t(language, "strikethrough"), icon: Strikethrough01, action: () => runEditorCommand("strikeThrough") },
        { key: "unordered-list", label: t(language, "bulletList"), icon: Dotpoints01, action: () => runEditorCommand("insertUnorderedList") },
    ];

    if (!openedTaskId) {
        return null;
    }

    return (
        <Blur type="task-menu" forceActive>
            <div className="task-menu task-menu-panel relative mb-20 w-[32rem] max-w-full z-20 text-gray-700 bg-[#dfe2ff] rounded-[28px] px-6 py-7 shadow-lg"
                 onClick={ev => {
                     ev.stopPropagation();
                 }}>
                <div className="w-full flex justify-between text-sm mb-6">
                    <div ref={datePickerContainerRef} className="relative">
                        <button
                            type="button"
                            className="task-menu-date-trigger"
                            onClick={() => setIsDatePickerOpen(prev => !prev)}
                            aria-label={t(language, "changeTaskDate")}
                            aria-expanded={isDatePickerOpen}
                        >
                            <Calendar className="h-4 w-4" />
                            <p>{getDate(selectedDate)}</p>
                        </button>
                        {isDatePickerOpen && (
                            <div className="task-menu-calendar" onClick={ev => ev.stopPropagation()}>
                                <div className="task-menu-calendar-header">
                                    <button
                                        type="button"
                                        className="task-menu-calendar-nav"
                                        onClick={() => changeCalendarMonth(-1)}
                                        aria-label={t(language, "previousMonth")}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <p className="task-menu-calendar-title">{calendarTitle}</p>
                                    <button
                                        type="button"
                                        className="task-menu-calendar-nav"
                                        onClick={() => changeCalendarMonth(1)}
                                        aria-label={t(language, "nextMonth")}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="task-menu-calendar-weekdays">
                                    {weekdayLabels.map((label, index) => (
                                        <span key={`${label}-${index}`}>{label}</span>
                                    ))}
                                </div>
                                <div className="task-menu-calendar-grid">
                                    {calendarDays.map(dayItem => (
                                        <button
                                            key={dayItem.key}
                                            type="button"
                                            className={[
                                                "task-menu-calendar-day",
                                                dayItem.inCurrentMonth ? "" : "is-outside-month",
                                                dayItem.isSelected ? "is-selected" : "",
                                            ].filter(Boolean).join(" ")}
                                            onClick={() => handleDateSelect(dayItem.date)}
                                        >
                                            {dayItem.date.getDate()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>


                    <div className="flex gap-3 items-center text-black">
                        {
                            taskMenuBtns.map((btn, ind) => (
                                <TaskMenuBtn key={ind} {...btn} />
                            ))
                        }
                    </div>
                </div>

                <div>
                    <Form ref={formRef} method="POST" className="task-menu-form relative w-full">
                        <textarea ref={titleInputRef} id="task-name" name="task-name" defaultValue={name}
                                  rows={1}
                                  onInput={autoResizeTitle}
                                  onChange={ev => {
                                      setTaskData(prevTaskData => ({
                                          ...prevTaskData,
                                          name: ev.target.value,
                                      }));
                                      autoResizeTitle();
                                  }}
                                  className={"task-menu-title w-full resize-none overflow-y-hidden border-b border-[#aeb5dd] pr-12 pt-1 pb-4 text-[24px] leading-[1.3] text-black bg-transparent focus:outline-none "
                                      + ((done && "text-black/40") || '')}
                        />
                        <button type="button" className="absolute right-0 top-1 text-black transition-colors duration-200 hover:text-blue-600"
                                onClick={ev => {
                                    ev.preventDefault();
                                    ev.stopPropagation();
                                    setTaskData(prevData =>
                                        ({
                                            ...prevData,
                                           done: !done,
                                       }));
                                }}>
                            <CheckCircle className={`h-[22px] w-[22px] ${done ? "opacity-40" : "opacity-75"}`} />

                        </button>
                        <div ref={toolbarSentinelRef} className="task-menu-toolbar-sentinel" aria-hidden="true" />
                        <div ref={toolbarRef} className={`task-menu-toolbar ${isToolbarSticky ? "is-sticky" : ""}`}>
                            {editorToolbarButtons.map(({ key, label, icon: Icon, text, action, ordered = false }) => (
                                <div key={key} className="relative group/task-btn">
                                <button
                                    key={key}
                                    type="button"
                                    className={`task-menu-icon-btn ${activeEditorFormats[key] ? "is-active" : ""}`}
                                    aria-label={label}
                                    title={label}
                                    aria-pressed={activeEditorFormats[key]}
                                    onMouseDown={ev => {
                                        ev.preventDefault();
                                        action();
                                    }}
                                >
                                    {text ? <span className="task-menu-toolbar-text">{text}</span> : <Icon className="h-[14px] w-[14px]" />}
                                    {ordered && <span className="task-menu-toolbar-order">1.</span>}
                                </button>
                                    <p className="absolute whitespace-pre left-1/2 -translate-x-[50%] top-[120%]
            opacity-0 group-hover/task-btn:opacity-100 transition ease-linear duration-200
             text-white bg-gray-800 rounded text-xs p-1">{label}</p>
                                </div>
                            ))}
                        </div>
                        <div
                            ref={editorRef}
                            className="task-menu-editor mt-5"
                            contentEditable
                            suppressContentEditableWarning
                            data-placeholder={t(language, "notesPlaceholder")}
                            onInput={() => {
                                syncEditorToMarkdown();
                                syncMentionMenu();
                            }}
                            onBlur={syncEditorToMarkdown}
                            onFocus={() => {
                                syncActiveEditorFormats();
                                syncMentionMenu();
                            }}
                            onKeyDown={handleEditorKeyDown}
                            onKeyUp={() => {
                                syncActiveEditorFormats();
                                syncMentionMenu();
                            }}
                            onMouseUp={() => {
                                syncActiveEditorFormats();
                                syncMentionMenu();
                            }}
                            onPaste={handleEditorPaste}
                            onClick={handleEditorClick}
                        />
                        {isMentionMenuOpen && (
                            <div
                                className="task-mention-menu"
                                style={{
                                    top: `${mentionPosition.top}px`,
                                    left: `${mentionPosition.left}px`,
                                }}
                            >
                                {mentionSuggestions.length > 0 ? (
                                    mentionSuggestions.map((task, index) => (
                                        <button
                                            key={task.id}
                                            type="button"
                                            className={`task-mention-option ${index === selectedMentionIndex ? "is-active" : ""}`}
                                            onMouseDown={ev => {
                                                ev.preventDefault();
                                                insertTaskMention(task);
                                            }}
                                        >
                                            <span className="task-mention-option-label">@{task.name}</span>
                                        </button>
                                    ))
                                ) : (
                                    <div className="task-mention-empty">{t(language, "mentionNoResults")}</div>
                                )}
                            </div>
                        )}
                        <section className="mt-5 border-t border-[#aeb5dd] pt-4">
                            <h4 className="text-sm font-semibold text-black">{t(language, "relatedLinks")}</h4>
                            <div className="task-menu-related-links-card mt-4">
                                <label className="task-menu-related-links-field">
                                    <input
                                        type="text"
                                        placeholder={t(language, "relatedLinkName")}
                                        value={newRelatedLinkName}
                                        onChange={ev => setNewRelatedLinkName(ev.target.value)}
                                        onKeyDown={handleRelatedLinkKeyDown}
                                        className="task-menu-related-links-input"
                                    />
                                </label>
                                <label className="task-menu-related-links-field task-menu-related-links-field-url">
                                    <input
                                        type="url"
                                        placeholder="https://..."
                                        value={newRelatedLinkUrl}
                                        onChange={ev => setNewRelatedLinkUrl(ev.target.value)}
                                        onKeyDown={handleRelatedLinkKeyDown}
                                        className="task-menu-related-links-input"
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={addOrUpdateRelatedLink}
                                    className="task-menu-related-links-submit"
                                >
                                    <span className="text-base leading-none">+</span>
                                    {editingRelatedLinkIndex === null ? "Add" : t(language, "update")}
                                </button>
                            </div>
                            {editingRelatedLinkIndex !== null && (
                                <button
                                    type="button"
                                    onClick={cancelEditingRelatedLink}
                                    className="mt-2 text-xs text-[#4b5688] underline underline-offset-2"
                                >
                                    {t(language, "cancelEdit")}
                                </button>
                            )}
                            <ul className="mt-4 space-y-2">
                                {relatedLinks.length === 0 && (
                                    <li className="text-xs text-[#6f79a8]">{t(language, "noLinks")}</li>
                                )}
                                {relatedLinks.map((link, index) => (
                                    <li key={`${index}-${link.url}-${link.name}`} className="rounded-[14px] bg-[#edf0ff] px-4 py-3">
                                        <a
                                            href={normalizeLinkUrl(link.url)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="group/link-row flex items-center justify-between gap-2"
                                            title={normalizeLinkUrl(link.url)}
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-black">{link.name || t(language, "untitledLink")}</p>
                                                <p className="truncate text-xs text-[#4b5688]">{link.url}</p>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 transition-opacity duration-150 group-hover/link-row:opacity-100">
                                                <button
                                                    type="button"
                                                    onClick={ev => {
                                                        ev.preventDefault();
                                                        startEditingRelatedLink(index);
                                                    }}
                                                    className="text-black transition-colors hover:text-blue-600"
                                                    aria-label={t(language, "editLink")}
                                                    title={t(language, "editLink")}
                                                >
                                                    <Edit02 className="h-[14px] w-[14px]" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={ev => {
                                                        ev.preventDefault();
                                                        removeRelatedLink(index);
                                                    }}
                                                    className="text-black transition-colors hover:text-blue-600"
                                                    aria-label={t(language, "removeLink")}
                                                    title={t(language, "removeLink")}
                                                >
                                                    <X className="h-[14px] w-[14px]" />
                                                </button>
                                            </div>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </section>
                        <textarea ref={markdownInputRef} name="task-description" id="task-description" className="hidden" defaultValue={description || ""}
                                  cols="30" rows="10" readOnly></textarea>
                        <input type="hidden" name="task-initial-description" value={initialDescriptionSnapshot} readOnly />
                        <input type="hidden" name="task-description-dirty" value={isDescriptionDirty ? "true" : "false"} readOnly />
                        <input
                            type="hidden"
                            id="task-related-links"
                            name="task-related-links"
                            value={serializedRelatedLinks}
                            readOnly
                        />
                        <input type="checkbox" id="task-done" name="task-done" checked={done} className="hidden"
                               readOnly={true}/>
                        <input type="hidden" id="task-date" name="task-date" value={selectedDate ? toInputDate(selectedDate) : ""} readOnly />
                        <input type="text" id="task-color" name="task-color" value={color || "none"} className="hidden"
                               readOnly={true}/>
                        <input type="text" id="task-id" name="task-id" value={taskId || "none"} className="hidden"
                               readOnly={true}/>
                    </Form>
                </div>

            </div>
        </Blur>
    )
}

export default TaskMenu;
