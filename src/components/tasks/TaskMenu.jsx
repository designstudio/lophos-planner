import React, {useEffect, useLayoutEffect} from "react";
import Blur from "../Blur.jsx";
import TaskMenuBtn from "./TaskMenuBtn.jsx";
import {Form, useSearchParams} from "react-router-dom";
import {tryCatchDecorator, deleteTask, getUserTasks} from "../../scripts/api.js";
import {useTaskMenu} from "../../contexts/TaskMenuContext.jsx";
import { Heading01, Bold01, Italic01, Strikethrough01, Dotpoints01, Trash03, Calendar, CheckCircle, Plus, X, Edit02, ChevronLeft, ChevronRight, ChevronDown, LayoutGrid02, AlertSquare, CheckSquareBroken } from "@untitledui/icons";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getAppLanguage, getLocale, t } from "../../scripts/i18n.js";
import { openForm, parseDateOnly, toShortId } from "../../scripts/utils.js";
import { getCountryCodeForLanguage, getHolidaysByYears } from "../../scripts/holidays.js";
import { autoLinkMarkdownUrls, createTaskTurndownService, getCalloutIconButtonHtml, renderTaskMarkdown, sanitizeTaskHtml } from "../../scripts/taskMarkdown.js";

const turndownService = createTaskTurndownService();

function QuoteIcon(props) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
            {...props}
        >
            <path
                fill="currentColor"
                d="m6.2 18 2.35 -4.05c-0.08335 0.01665 -0.175 0.02915 -0.275 0.0375 -0.1 0.00835 -0.19165 0.0125 -0.275 0.0125 -1.1 0 -2.04165 -0.39165 -2.825 -1.175C4.391665 12.04165 4 11.1 4 10s0.391665 -2.04165 1.175 -2.825C5.95835 6.39165 6.9 6 8 6s2.04165 0.39165 2.825 1.175S12 8.9 12 10c0 0.35 -0.04585 0.69315 -0.1375 1.0295 -0.09165 0.3365 -0.22915 0.66 -0.4125 0.9705L8 18h-1.8Zm9 0 2.35 -4.05c-0.08335 0.01665 -0.175 0.02915 -0.275 0.0375 -0.1 0.00835 -0.19165 0.0125 -0.275 0.0125 -1.1 0 -2.04165 -0.39165 -2.825 -1.175S13 11.1 13 10s0.39165 -2.04165 1.175 -2.825S15.9 6 17 6s2.04165 0.39165 2.825 1.175S21 8.9 21 10c0 0.35 -0.04585 0.69315 -0.1375 1.0295 -0.09165 0.3365 -0.22915 0.66 -0.4125 0.9705L17 18h-1.8ZM7.994 12c0.554 0 1.02685 -0.19385 1.4185 -0.5815 0.39165 -0.38785 0.5875 -0.85865 0.5875 -1.4125 0 -0.554 -0.19385 -1.02685 -0.5815 -1.4185 -0.38785 -0.39165 -0.85865 -0.5875 -1.4125 -0.5875 -0.554 0 -1.02685 0.19385 -1.4185 0.5815 -0.39165 0.38785 -0.5875 0.85865 -0.5875 1.4125 0 0.554 0.19385 1.02685 0.5815 1.4185 0.38785 0.39165 0.85865 0.5875 1.4125 0.5875Zm9 0c0.554 0 1.02685 -0.19385 1.4185 -0.5815 0.39165 -0.38785 0.5875 -0.85865 0.5875 -1.4125 0 -0.554 -0.19385 -1.02685 -0.5815 -1.4185 -0.38785 -0.39165 -0.85865 -0.5875 -1.4125 -0.5875 -0.554 0 -1.02685 0.19385 -1.4185 0.5815 -0.39165 0.38785 -0.5875 0.85865 -0.5875 1.4125 0 0.554 0.19385 1.02685 0.5815 1.4185 0.38785 0.39165 0.85865 0.5875 1.4125 0.5875Z"
            />
        </svg>
    );
}

function NumberedListIcon(props) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="-0.5 -0.5 12 12"
            fill="none"
            aria-hidden="true"
            {...props}
        >
            <path d="M5.041666666666666 2.75h4.125" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5.041666666666666 5.5h4.125" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5.5 8.25h3.6666666666666665" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M1.8333333333333333 7.333333333333333a0.9166666666666666 0.9166666666666666 0 1 1 1.8333333333333333 0c0 0.270875 -0.22916666666666666 0.4583333333333333 -0.4583333333333333 0.6875L1.8333333333333333 9.166666666666666h1.8333333333333333" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2.75 4.583333333333333V1.8333333333333333L1.8333333333333333 2.75" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function MeetingIcon(props) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M13 3.5V6.2C13 7.88016 13 8.72024 13.327 9.36197C13.6146 9.92646 14.0735 10.3854 14.638 10.673C15.2798 11 16.1198 11 17.8 11H20.5M21 12.9882V16.2C21 17.8802 21 18.7202 20.673 19.362C20.3854 19.9265 19.9265 20.3854 19.362 20.673C18.7202 21 17.8802 21 16.2 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V7.8C3 6.11984 3 5.27976 3.32698 4.63803C3.6146 4.07354 4.07354 3.6146 4.63803 3.32698C5.27976 3 6.11984 3 7.8 3H11.0118C11.7455 3 12.1124 3 12.4577 3.08289C12.7638 3.15638 13.0564 3.27759 13.3249 3.44208C13.6276 3.6276 13.887 3.88703 14.4059 4.40589L19.5941 9.59411C20.113 10.113 20.3724 10.3724 20.5579 10.6751C20.7224 10.9436 20.8436 11.2362 20.9171 11.5423C21 11.8876 21 12.2545 21 12.9882Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 16H7M11 12H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function CalloutInfoIcon(props) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.14" />
            <path d="M12 10V16M12 7.75H12.01M21 12C21 16.971 16.971 21 12 21S3 16.971 3 12 7.029 3 12 3 21 7.029 21 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function CalloutWarningIcon(props) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M12 3.5 21 20.5H3L12 3.5Z" fill="currentColor" opacity="0.18" />
            <path d="M12 8.5V13.5M12 17.25H12.01M10.268 4.5 2.715 17.5C1.945 18.826 2.902 20.5 4.447 20.5H19.553C21.098 20.5 22.055 18.826 21.285 17.5L13.732 4.5C12.96 3.171 11.04 3.171 10.268 4.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function renderCalloutTypeIcon(calloutType) {
    const Icon = calloutType === "warning" ? CalloutWarningIcon : CalloutInfoIcon;
    return <Icon className="h-[18px] w-[18px]" />;
}

function getTaskTypeIcon(taskType) {
    return taskType === "meeting" ? MeetingIcon : CheckSquareBroken;
}

function normalizeSearchText(text) {
    return (text || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
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
        "ordered-list": false,
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
        "unordered-list": Boolean(closest("ul")),
        "ordered-list": Boolean(closest("ol")),
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

function getSlashMatch(editorEl) {
    const selection = window.getSelection();
    if (!editorEl || !selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;
    if (!isSelectionInsideEditor(editorEl, selection)) return null;

    const focusNode = selection.focusNode;
    if (!focusNode || focusNode.nodeType !== Node.TEXT_NODE) return null;

    const textBeforeCaret = focusNode.textContent.slice(0, selection.focusOffset);
    const match = textBeforeCaret.match(/(?:^|\s)\/([^\s\/]*)$/);
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
    const { currentUser, agendas } = useAuth();
    const {id: taskId, date, color, name, done, description, task_type: rawTaskType} = taskData;
    const taskType = rawTaskType || "task";
    const isTaskDone = taskType === "meeting" ? false : done;
    const language = getAppLanguage(currentUser?.language);
    const locale = getLocale(language);
    const currentAgenda = agendas?.find(agenda => String(agenda.id) === String(currentUser?.currentAgendaId));
    const relatedLinksEnabled = currentAgenda?.related_links_enabled ?? true;
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
    const slashStateRef = React.useRef(null);
    const slashMenuRef = React.useRef(null);
    const tableUiInteractionRef = React.useRef(false);
    const skipNextEditorBlurSyncRef = React.useRef(false);
    const hasToolbarStickyStateChangedRef = React.useRef(false);
    const isToolbarStickyRef = React.useRef(false);
    const [newRelatedLinkName, setNewRelatedLinkName] = React.useState("");
    const [newRelatedLinkUrl, setNewRelatedLinkUrl] = React.useState("");
    const [editingRelatedLinkIndex, setEditingRelatedLinkIndex] = React.useState(null);
    const [isTaskTypeMenuOpen, setIsTaskTypeMenuOpen] = React.useState(false);
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
    const [isSlashMenuOpen, setIsSlashMenuOpen] = React.useState(false);
    const [slashQuery, setSlashQuery] = React.useState("");
    const [slashMenuPosition, setSlashMenuPosition] = React.useState({ top: 0, left: 0 });
    const [selectedSlashIndex, setSelectedSlashIndex] = React.useState(null);
    const [holidayNamesByDate, setHolidayNamesByDate] = React.useState(() => ({}));
    const taskTypeMenuRef = React.useRef(null);
    const calloutTypeMenuRef = React.useRef(null);
    const activeCalloutRef = React.useRef(null);
    const activeTableRef = React.useRef(null);
    const tableCellMenuRef = React.useRef(null);
    const openedTaskId = searchParams.get("task") || searchParams.get("openedTask");
    const [isCalloutTypeMenuOpen, setIsCalloutTypeMenuOpen] = React.useState(false);
    const [calloutTypeMenuPosition, setCalloutTypeMenuPosition] = React.useState({ top: 0, left: 0 });
    const [activeTableOverlay, setActiveTableOverlay] = React.useState(null);
    const [tableCellMenuState, setTableCellMenuState] = React.useState(null);

    useLayoutEffect(() => {
        if (titleInputRef.current) {
            titleInputRef.current.value = name || "";
            autoResizeTitle();
        }
    }, [name, taskId]);

    useEffect(() => {
        if (editorRef.current) {
            editorRef.current.innerHTML = description ? renderTaskMarkdown(description) : "";
        }

        if (markdownInputRef.current) {
            markdownInputRef.current.value = description || "";
        }

        setNewRelatedLinkName("");
        setNewRelatedLinkUrl("");
        setEditingRelatedLinkIndex(null);
        setIsTaskTypeMenuOpen(false);
        setIsDatePickerOpen(false);
        setCalendarMonth(startOfMonth(selectedDate || new Date()));
        setActiveEditorFormats(getActiveEditorFormats(editorRef.current));
        setInitialDescriptionSnapshot(description || "");
        setIsDescriptionDirty(false);
        setIsMentionMenuOpen(false);
        setMentionQuery("");
        setSelectedMentionIndex(0);
        mentionStateRef.current = null;
        slashStateRef.current = null;
        setIsSlashMenuOpen(false);
        setSlashQuery("");
        setSelectedSlashIndex(null);
        activeCalloutRef.current = null;
        setIsCalloutTypeMenuOpen(false);
        activeTableRef.current = null;
        setActiveTableOverlay(null);
        setTableCellMenuState(null);
    }, [openedTaskId, taskId, selectedDate]);

    useEffect(() => {
        if (!openedTaskId) return;
        openForm("task-menu");
    }, [openedTaskId]);

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
        if (!isTaskTypeMenuOpen) return;

        const handlePointerDownOutside = ev => {
            const menuContainer = taskTypeMenuRef.current;
            if (!menuContainer?.contains(ev.target)) {
                setIsTaskTypeMenuOpen(false);
            }
        };

        document.addEventListener("pointerdown", handlePointerDownOutside);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDownOutside);
        };
    }, [isTaskTypeMenuOpen]);

    useEffect(() => {
        if (!isCalloutTypeMenuOpen) return;

        const handlePointerDownOutside = ev => {
            const menuEl = calloutTypeMenuRef.current;
            if (menuEl?.contains(ev.target)) return;

            const iconButton = ev.target.closest?.(".task-callout-icon-button");
            if (iconButton && editorRef.current?.contains(iconButton)) return;

            setIsCalloutTypeMenuOpen(false);
            activeCalloutRef.current = null;
        };

        document.addEventListener("pointerdown", handlePointerDownOutside);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDownOutside);
        };
    }, [isCalloutTypeMenuOpen]);

    useEffect(() => {
        if (!tableCellMenuState) return;

        const handlePointerDownOutside = ev => {
            const menuEl = tableCellMenuRef.current;
            if (menuEl?.contains(ev.target)) return;

            const cellMenuButton = ev.target.closest?.(".task-table-cell-menu-trigger");
            if (cellMenuButton) return;

            setTableCellMenuState(null);
        };

        document.addEventListener("pointerdown", handlePointerDownOutside);
        return () => document.removeEventListener("pointerdown", handlePointerDownOutside);
    }, [tableCellMenuState]);

    useEffect(() => {
        if (!isSlashMenuOpen) return;

        const handlePointerDownOutside = ev => {
            const menuEl = slashMenuRef.current;
            if (menuEl?.contains(ev.target)) return;
            if (editorRef.current?.contains(ev.target)) return;
            closeSlashMenu();
        };

        document.addEventListener("pointerdown", handlePointerDownOutside);
        return () => document.removeEventListener("pointerdown", handlePointerDownOutside);
    }, [isSlashMenuOpen]);

    useEffect(() => {
        let isCancelled = false;

        const month = calendarMonth.getMonth();
        const year = calendarMonth.getFullYear();
        const years = [year];
        if (month === 0) years.push(year - 1);
        if (month === 11) years.push(year + 1);

        async function loadHolidays() {
            const countryCode = getCountryCodeForLanguage(language);
            const holidays = await getHolidaysByYears({ years, countryCode });
            if (isCancelled) return;

            const nextMap = {};
            holidays.forEach(holiday => {
                if (!holiday?.date) return;
                nextMap[holiday.date] = holiday.localName || holiday.name || "";
            });
            setHolidayNamesByDate(nextMap);
        }

        loadHolidays();
        return () => {
            isCancelled = true;
        };
    }, [calendarMonth, language]);

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
        const sanitizedHtml = sanitizeTaskHtml(editorRef.current.innerHTML);
        const markdown = sanitizedHtml === "<br>" ? "" : turndownService.turndown(sanitizedHtml).trim();
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

    function closeCalloutTypeMenu() {
        activeCalloutRef.current = null;
        setIsCalloutTypeMenuOpen(false);
    }

    function closeTableControls() {
        activeTableRef.current = null;
        setActiveTableOverlay(null);
        setTableCellMenuState(null);
    }

    function lockTableUiInteraction() {
        tableUiInteractionRef.current = true;
        requestAnimationFrame(() => {
            tableUiInteractionRef.current = false;
        });
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

    function closeSlashMenu() {
        slashStateRef.current = null;
        setIsSlashMenuOpen(false);
        setSlashQuery("");
        setSelectedSlashIndex(null);
    }

    function syncSlashMenu() {
        const editorEl = editorRef.current;
        const formEl = formRef.current;
        if (!editorEl || !formEl) {
            closeSlashMenu();
            return;
        }

        const slashMatch = getSlashMatch(editorEl);
        if (!slashMatch) {
            closeSlashMenu();
            return;
        }

        const caretRect = slashMatch.caretRange.getBoundingClientRect();
        const formRect = formEl.getBoundingClientRect();
        slashStateRef.current = slashMatch;
        setSlashQuery(slashMatch.query);
        setSlashMenuPosition({
            top: Math.max(caretRect.bottom - formRect.top + 12, 0),
            left: Math.max(caretRect.left - formRect.left, 0),
        });
        setIsSlashMenuOpen(true);
        closeMentionMenu();
    }

    function focusEditor() {
        editorRef.current?.focus();
    }

    function getTableContextFromNode(node) {
        const element = getElementFromNode(node);
        if (!element) return null;

        const tableEl = element.closest?.("table");
        if (!tableEl || !editorRef.current?.contains(tableEl)) return null;

        const cellEl = element.closest?.("th, td");
        let rowIndex = -1;
        let columnIndex = -1;
        if (cellEl) {
            const rowEl = cellEl.closest("tr");
            const rows = Array.from(tableEl.querySelectorAll("tr"));
            rowIndex = rows.indexOf(rowEl);
            if (rowEl) {
                columnIndex = Array.from(rowEl.querySelectorAll("th, td")).indexOf(cellEl);
            }
        }

        return {
            tableEl,
            shellEl: tableEl.closest(".task-table-shell") || tableEl,
            cellEl,
            rowIndex,
            columnIndex,
        };
    }

    function focusTableCell(cellEl) {
        if (!cellEl) return;

        const targetNode = cellEl.querySelector("p, div, span, br") || cellEl;
        const range = document.createRange();
        const selection = window.getSelection();

        if (targetNode.nodeName === "BR") {
            range.setStartBefore(targetNode);
        } else {
            range.selectNodeContents(targetNode);
        }

        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
        focusEditor();
    }

    function syncActiveTableControls() {
        const selection = window.getSelection();
        const context = selection?.focusNode ? getTableContextFromNode(selection.focusNode) : null;

        if (!context) {
            closeTableControls();
            return;
        }

        const formEl = formRef.current;
        if (!formEl) {
            closeTableControls();
            return;
        }

        const formRect = formEl.getBoundingClientRect();
        const shellRect = context.shellEl.getBoundingClientRect();
        const tableRect = context.tableEl.getBoundingClientRect();
        const visibleLeft = Math.max(tableRect.left, shellRect.left);
        const visibleRight = Math.min(tableRect.right, shellRect.right);
        const visibleWidth = Math.max(visibleRight - visibleLeft, 0);
        const firstRowCells = Array.from(context.tableEl.querySelectorAll("tr:first-child > th, tr:first-child > td"));
        const rows = Array.from(context.tableEl.querySelectorAll("tr"));

        const columnHandles = firstRowCells.map((cellEl, index) => {
            const cellRect = cellEl.getBoundingClientRect();
            return {
                key: `column-${index}`,
                left: cellRect.right - formRect.left,
                top: shellRect.top - formRect.top + 10,
                insertAtIndex: index + 1,
            };
        });

        const rowHandles = rows.map((rowEl, index) => {
            const rowRect = rowEl.getBoundingClientRect();
            return {
                key: `row-${index}`,
                left: shellRect.left - formRect.left + 10,
                top: rowRect.bottom - formRect.top,
                insertAtIndex: index + 1,
            };
        });

        activeTableRef.current = context.tableEl;
        setActiveTableOverlay({
            top: tableRect.top - formRect.top,
            left: visibleLeft - formRect.left,
            width: visibleWidth,
            height: tableRect.height,
            columnHandles,
            rowHandles,
            selectedRowIndex: context.rowIndex,
            selectedColumnIndex: context.columnIndex,
        });
    }

    function updateTableCellMenuForContext(context) {
        if (!context?.cellEl || context.rowIndex < 0 || context.columnIndex < 0) {
            setTableCellMenuState(null);
            return;
        }

        const formEl = formRef.current;
        if (!formEl) return;

        const formRect = formEl.getBoundingClientRect();
        const cellRect = context.cellEl.getBoundingClientRect();
        setTableCellMenuState(prevState => ({
            top: Math.max(cellRect.top - formRect.top + 8, 0),
            left: Math.max(cellRect.right - formRect.left - 22, 0),
            rowIndex: context.rowIndex,
            columnIndex: context.columnIndex,
            isOpen: prevState?.rowIndex === context.rowIndex && prevState?.columnIndex === context.columnIndex
                ? prevState.isOpen
                : false,
        }));
    }

    function runEditorCommand(command, value = null) {
        focusEditor();
        document.execCommand(command, false, value);
        syncEditorToMarkdown();
        syncActiveEditorFormats();
        syncMentionMenu();
        syncSlashMenu();
    }

    function handleEditorPaste(ev) {
        const html = ev.clipboardData?.getData("text/html");
        const text = ev.clipboardData?.getData("text/plain");

        if (!html && !text) return;

        ev.preventDefault();

        const markdown = html
            ? turndownService.turndown(sanitizeTaskHtml(html)).trim()
            : (text || "").trim();

        if (!markdown) return;

        const renderedHtml = renderTaskMarkdown(markdown);

        focusEditor();
        document.execCommand("insertHTML", false, renderedHtml);
        syncEditorToMarkdown();
        syncActiveEditorFormats();
        syncMentionMenu();
        syncSlashMenu();
    }

    function insertMarkdownBlock(markdown) {
        const renderedHtml = renderTaskMarkdown(markdown);
        focusEditor();
        document.execCommand("insertHTML", false, renderedHtml);
        syncEditorToMarkdown();
        syncActiveEditorFormats();
        syncMentionMenu();
        syncSlashMenu();
    }

    function insertQuoteBlock() {
        const editorEl = editorRef.current;
        const selection = window.getSelection();

        if (
            editorEl
            && selection
            && selection.rangeCount > 0
            && !selection.isCollapsed
            && isSelectionInsideEditor(editorEl, selection)
        ) {
            const range = selection.getRangeAt(0);
            const fragment = range.cloneContents();
            const tempContainer = document.createElement("div");
            tempContainer.appendChild(fragment);

            const selectedHtml = sanitizeTaskHtml(tempContainer.innerHTML).trim();
            const quoteHtml = selectedHtml
                ? `<blockquote><p>${selectedHtml}</p></blockquote>`
                : "<blockquote><p></p></blockquote>";

            focusEditor();
            document.execCommand("insertHTML", false, quoteHtml);
            syncEditorToMarkdown();
            syncActiveEditorFormats();
            syncMentionMenu();
            syncSlashMenu();
            return;
        }

        insertMarkdownBlock("> ");
    }

    function insertCalloutBlock() {
        const editorEl = editorRef.current;
        if (!editorEl) {
            insertMarkdownBlock("> [!INFO]\n> ");
            return;
        }

        focusEditor();

        const nextSelection = window.getSelection();
        const range = nextSelection && nextSelection.rangeCount > 0 && isSelectionInsideEditor(editorEl, nextSelection)
            ? nextSelection.getRangeAt(0).cloneRange()
            : (() => {
                const fallbackRange = document.createRange();
                fallbackRange.selectNodeContents(editorEl);
                fallbackRange.collapse(false);
                return fallbackRange;
            })();

        range.deleteContents();

        const calloutWrapper = document.createElement("div");
        calloutWrapper.innerHTML =
            `<div class="task-callout task-callout-info">` +
            `${getCalloutIconButtonHtml("info")}` +
            `<div class="task-callout-body"><p><br></p></div>` +
            `</div>`;

        const calloutEl = calloutWrapper.firstElementChild;
        range.insertNode(calloutEl);

        const bodyParagraph = calloutEl.querySelector(".task-callout-body p");
        const bodyRange = document.createRange();
        bodyRange.setStart(bodyParagraph, 0);
        bodyRange.collapse(true);

        nextSelection?.removeAllRanges();
        nextSelection?.addRange(bodyRange);

        syncEditorToMarkdown();
        syncActiveEditorFormats();
        syncMentionMenu();
        syncSlashMenu();
    }

    function openCalloutTypeMenu(calloutEl, iconButtonEl) {
        const formEl = formRef.current;
        if (!formEl || !calloutEl || !iconButtonEl) return;

        const formRect = formEl.getBoundingClientRect();
        const iconRect = iconButtonEl.getBoundingClientRect();

        activeCalloutRef.current = calloutEl;
        setCalloutTypeMenuPosition({
            top: Math.max(iconRect.top - formRect.top - 8, 0),
            left: Math.max(iconRect.left - formRect.left, 0),
        });
        setIsCalloutTypeMenuOpen(true);
    }

    function updateActiveCalloutType(nextType) {
        const calloutEl = activeCalloutRef.current;
        if (!calloutEl) return;

        calloutEl.classList.remove("task-callout-info", "task-callout-warning");
        calloutEl.classList.add(`task-callout-${nextType}`);

        const iconButtonEl = calloutEl.querySelector(".task-callout-icon-button");
        if (iconButtonEl) {
            iconButtonEl.outerHTML = getCalloutIconButtonHtml(nextType);
        }

        syncEditorToMarkdown();
        syncActiveEditorFormats();
        syncMentionMenu();
        syncSlashMenu();
        closeCalloutTypeMenu();
        focusEditor();
    }

    function insertTableBlock() {
        insertMarkdownBlock("| Coluna 1 | Coluna 2 |\n| --- | --- |\n| Valor 1 | Valor 2 |");
    }

    function addTableColumn(insertAtIndex) {
        const tableEl = activeTableRef.current;
        if (!tableEl) return;

        const rows = Array.from(tableEl.querySelectorAll("tr"));
        if (!rows.length) return;

        const nextColumnNumber = Math.max(...rows.map(row => row.querySelectorAll("th, td").length), 0) + 1;
        const safeInsertIndex = Math.max(0, insertAtIndex ?? nextColumnNumber - 1);

        let focusCell = null;
        rows.forEach((row, rowIndex) => {
            const nextCell = document.createElement(rowIndex === 0 ? "th" : "td");
            nextCell.innerHTML = rowIndex === 0 ? `Coluna ${nextColumnNumber}` : "<br>";
            const cells = Array.from(row.querySelectorAll("th, td"));
            const referenceCell = cells[safeInsertIndex] || null;
            row.insertBefore(nextCell, referenceCell);
            if (rowIndex === 1 || (rowIndex === 0 && rows.length === 1)) {
                focusCell = nextCell;
            }
        });

        const shellEl = tableEl.closest(".task-table-shell");
        if (shellEl) {
            shellEl.scrollLeft = shellEl.scrollWidth;
        }

        syncEditorToMarkdown();
        syncActiveEditorFormats();
        syncMentionMenu();
        syncSlashMenu();
        requestAnimationFrame(() => {
            focusTableCell(focusCell);
            syncActiveTableControls();
        });
    }

    function addTableRow(insertAtIndex) {
        const tableEl = activeTableRef.current;
        if (!tableEl) return;

        const rows = Array.from(tableEl.querySelectorAll("tr"));
        const referenceRow = rows[0];
        if (!referenceRow) return;

        const columnCount = referenceRow.querySelectorAll("th, td").length;
        if (!columnCount) return;

        const tbodyEl = tableEl.querySelector("tbody") || tableEl;
        const newRow = document.createElement("tr");
        let focusCell = null;

        for (let index = 0; index < columnCount; index += 1) {
            const nextCell = document.createElement("td");
            nextCell.innerHTML = "<br>";
            newRow.appendChild(nextCell);
            if (index === 0) focusCell = nextCell;
        }

        const safeInsertIndex = Math.max(1, insertAtIndex ?? rows.length);
        const referenceInsertRow = rows[safeInsertIndex] || null;

        if (referenceInsertRow) {
            referenceInsertRow.parentNode.insertBefore(newRow, referenceInsertRow);
        } else {
            tbodyEl.appendChild(newRow);
        }

        syncEditorToMarkdown();
        syncActiveEditorFormats();
        syncMentionMenu();
        syncSlashMenu();
        requestAnimationFrame(() => {
            focusTableCell(focusCell);
            syncActiveTableControls();
        });
    }

    function setActiveCellVerticalAlign(nextAlign) {
        const context = activeTableRef.current && tableCellMenuState
            ? {
                tableEl: activeTableRef.current,
                rowIndex: tableCellMenuState.rowIndex,
                columnIndex: tableCellMenuState.columnIndex,
            }
            : null;
        if (!context) return;

        const rowEl = context.tableEl.querySelectorAll("tr")[context.rowIndex];
        const cellEl = rowEl?.querySelectorAll("th, td")[context.columnIndex];
        if (!cellEl) return;

        cellEl.setAttribute("data-cell-valign", nextAlign);
        syncEditorToMarkdown();
        syncActiveEditorFormats();
        setTableCellMenuState(prevState => prevState ? { ...prevState, isOpen: false } : prevState);
        requestAnimationFrame(syncActiveTableControls);
    }

    function deleteSelectedTableColumn() {
        if (!activeTableRef.current || !tableCellMenuState) return;

        const rows = Array.from(activeTableRef.current.querySelectorAll("tr"));
        const firstRowColumnCount = rows[0]?.querySelectorAll("th, td").length || 0;
        if (firstRowColumnCount <= 1) {
            deleteActiveTable();
            return;
        }

        rows.forEach(rowEl => {
            const cellEl = rowEl.querySelectorAll("th, td")[tableCellMenuState.columnIndex];
            cellEl?.remove();
        });

        syncEditorToMarkdown();
        syncActiveEditorFormats();
        setTableCellMenuState(null);
        requestAnimationFrame(syncActiveTableControls);
    }

    function deleteSelectedTableRow() {
        if (!activeTableRef.current || !tableCellMenuState) return;

        const totalRows = activeTableRef.current.querySelectorAll("tr").length;
        if (totalRows <= 1) {
            deleteActiveTable();
            return;
        }

        const rowEl = activeTableRef.current.querySelectorAll("tr")[tableCellMenuState.rowIndex];
        rowEl?.remove();

        syncEditorToMarkdown();
        syncActiveEditorFormats();
        setTableCellMenuState(null);
        requestAnimationFrame(syncActiveTableControls);
    }

    function deleteActiveTable() {
        const tableEl = activeTableRef.current;
        if (!tableEl) return;

        const shellEl = tableEl.closest(".task-table-shell");
        shellEl?.remove();
        syncEditorToMarkdown();
        syncActiveEditorFormats();
        closeTableControls();
        focusEditor();
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
        closeSlashMenu();
        focusEditor();
    }

    const slashCommands = React.useMemo(() => ([
        {
            key: "quote",
            label: t(language, "blockquote"),
            icon: QuoteIcon,
            keywords: ["quote", "citacao", "citação", "blockquote"],
            action: insertQuoteBlock,
        },
        {
            key: "callout",
            label: t(language, "callout"),
            icon: AlertSquare,
            keywords: ["callout", "alerta", "informacao", "informação", "info"],
            action: insertCalloutBlock,
        },
        {
            key: "table",
            label: t(language, "table"),
            icon: LayoutGrid02,
            keywords: ["table", "tabela", "grid"],
            action: insertTableBlock,
        },
    ]), [language]);

    const slashSuggestions = React.useMemo(() => {
        const normalizedQuery = normalizeSearchText(slashQuery);
        if (!normalizedQuery) return slashCommands;

        return slashCommands.filter(command => {
            const haystack = [
                command.label,
                ...(command.keywords || []),
            ].map(normalizeSearchText).join(" ");

            return haystack.includes(normalizedQuery);
        });
    }, [slashCommands, slashQuery]);

    useEffect(() => {
        setSelectedSlashIndex(null);
    }, [slashQuery]);

    function insertSlashCommand(command) {
        const slashMatch = slashStateRef.current;
        if (!command || !slashMatch) return;

        const range = document.createRange();
        range.setStart(slashMatch.textNode, slashMatch.startOffset);
        range.setEnd(slashMatch.textNode, slashMatch.endOffset);
        range.deleteContents();

        const selection = window.getSelection();
        const nextRange = document.createRange();
        nextRange.setStart(range.startContainer, range.startOffset);
        nextRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(nextRange);

        closeSlashMenu();
        focusEditor();
        command.action();
    }

    function handleEditorKeyDown(ev) {
        if (isSlashMenuOpen) {
            if (slashSuggestions.length === 0) {
                if (ev.key === "Escape") {
                    ev.preventDefault();
                    closeSlashMenu();
                }
                return;
            }

            if (ev.key === "ArrowDown") {
                ev.preventDefault();
                setSelectedSlashIndex(prevIndex => prevIndex === null
                    ? 0
                    : (prevIndex + 1) % slashSuggestions.length);
                return;
            }

            if (ev.key === "ArrowUp") {
                ev.preventDefault();
                setSelectedSlashIndex(prevIndex => prevIndex === null
                    ? slashSuggestions.length - 1
                    : (prevIndex - 1 + slashSuggestions.length) % slashSuggestions.length);
                return;
            }

            if (ev.key === "Enter" || ev.key === "Tab") {
                ev.preventDefault();
                insertSlashCommand(
                    selectedSlashIndex === null
                        ? slashSuggestions[0]
                        : (slashSuggestions[selectedSlashIndex] || slashSuggestions[0])
                );
                return;
            }

            if (ev.key === "Escape") {
                ev.preventDefault();
                closeSlashMenu();
                return;
            }
        }

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
        const calloutIconButton = ev.target.closest?.(".task-callout-icon-button");
        if (calloutIconButton && editorRef.current?.contains(calloutIconButton)) {
            ev.preventDefault();
            ev.stopPropagation();
            skipNextEditorBlurSyncRef.current = true;

            const calloutEl = calloutIconButton.closest(".task-callout");
            openCalloutTypeMenu(calloutEl, calloutIconButton);
            return;
        }

        const tableContext = getTableContextFromNode(ev.target);
        if (tableContext) {
            requestAnimationFrame(() => {
                syncActiveTableControls();
                updateTableCellMenuForContext(tableContext);
            });
        } else {
            closeTableControls();
        }

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
            next.delete("openedTask");
            next.set("task", toShortId(referencedTaskId));
            return next;
        });
    }

    useEffect(() => {
        const handleSelectionChange = () => {
            if (tableUiInteractionRef.current) return;
            syncActiveEditorFormats();
            syncMentionMenu();
            syncSlashMenu();
            syncActiveTableControls();
            const selection = window.getSelection();
            const context = selection?.focusNode ? getTableContextFromNode(selection.focusNode) : null;
            updateTableCellMenuForContext(context);
        };

        document.addEventListener("selectionchange", handleSelectionChange);

        return () => {
            document.removeEventListener("selectionchange", handleSelectionChange);
        };
    }, []);

    useEffect(() => {
        if (!activeTableOverlay || !activeTableRef.current) return;

        const shellEl = activeTableRef.current.closest(".task-table-shell");
        if (!shellEl) return;

        const handleTableShellScroll = () => {
            requestAnimationFrame(syncActiveTableControls);
        };

        shellEl.addEventListener("scroll", handleTableShellScroll, { passive: true });
        window.addEventListener("resize", handleTableShellScroll);

        return () => {
            shellEl.removeEventListener("scroll", handleTableShellScroll);
            window.removeEventListener("resize", handleTableShellScroll);
        };
    }, [activeTableOverlay]);

    async function delTask(ev) {
        const result = await tryCatchDecorator(deleteTask)(taskId);
        if (!result.success) return;

        window.dispatchEvent(new CustomEvent("task-deleted", {
            detail: { taskId },
        }));

        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.delete("task");
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
            buttonClassName: "task-menu-delete-btn",
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
                holidayName: holidayNamesByDate[toInputDate(cellDate)] || "",
            };
        });
    }, [calendarMonth, holidayNamesByDate, selectedDate, weekStartIndex]);

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

    function handleTaskTypeSelect(nextTaskType) {
        const normalizedTaskType = nextTaskType === "meeting" ? "meeting" : "task";

        setTaskData(prevTaskData => ({
            ...prevTaskData,
            task_type: normalizedTaskType,
            done: normalizedTaskType === "meeting" ? false : prevTaskData.done,
        }));
        setIsTaskTypeMenuOpen(false);
    }

    const editorToolbarButtons = [
        { key: "heading", label: t(language, "heading"), icon: Heading01, action: () => runEditorCommand("formatBlock", "h3") },
        { key: "bold", label: t(language, "bold"), icon: Bold01, action: () => runEditorCommand("bold") },
        { key: "italic", label: t(language, "italic"), icon: Italic01, action: () => runEditorCommand("italic") },
        { key: "strikethrough", label: t(language, "strikethrough"), icon: Strikethrough01, action: () => runEditorCommand("strikeThrough") },
        { key: "unordered-list", label: t(language, "bulletList"), icon: Dotpoints01, action: () => runEditorCommand("insertUnorderedList") },
        { key: "ordered-list", label: t(language, "numberedList"), icon: NumberedListIcon, action: () => runEditorCommand("insertOrderedList") },
    ];

    if (!openedTaskId) {
        return null;
    }

    return (
        <Blur type="task-menu">
            <div className="task-menu task-menu-panel relative mb-6 w-[32rem] max-w-full z-20 text-gray-700 bg-[rgb(250,250,252)] rounded-[28px] px-6 py-7 shadow-lg"
                 onClick={ev => {
                     ev.stopPropagation();
                 }}>
                <div className="mb-4 flex w-full items-center justify-between text-sm">
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
                            <div className="task-menu-calendar option-menu-surface" onClick={ev => ev.stopPropagation()}>
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
                                                dayItem.holidayName ? "has-holiday" : "",
                                            ].filter(Boolean).join(" ")}
                                            onClick={() => handleDateSelect(dayItem.date)}
                                            aria-label={dayItem.holidayName
                                                ? `${dayItem.date.getDate()} - ${dayItem.holidayName}`
                                                : `${dayItem.date.getDate()}`}
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
                                  className={"task-menu-title w-full resize-none overflow-y-hidden pt-0 pb-4 text-[24px] leading-[1.3] text-black bg-transparent focus:outline-none "
                                      + (taskType !== "meeting" ? "pr-12 " : "")
                                      + ((isTaskDone && "text-black/40") || '')}
                        />
                        {taskType !== "meeting" && (
                            <button
                                type="button"
                                className="absolute right-0 top-0 text-black transition-colors duration-200 hover:text-black/70"
                                onClick={ev => {
                                    ev.preventDefault();
                                    ev.stopPropagation();
                                    setTaskData(prevData => ({
                                        ...prevData,
                                        done: !prevData.done,
                                    }));
                                }}
                            >
                                <CheckCircle className={`h-[22px] w-[22px] ${isTaskDone ? "opacity-40" : "opacity-75"}`} />
                            </button>
                        )}
                        <div ref={toolbarSentinelRef} className="task-menu-toolbar-sentinel" aria-hidden="true" />
                        <div ref={toolbarRef} className={`task-menu-toolbar ${isToolbarSticky ? "is-sticky" : ""}`}>
                            {editorToolbarButtons.map(({ key, label, icon: Icon, text, action, ordered = false }) => (
                                <div key={key} className="relative group/task-btn">
                                <button
                                    key={key}
                                    type="button"
                                    className={`task-menu-icon-btn ${activeEditorFormats[key] ? "is-active" : ""}`}
                                    aria-label={label}
                                    aria-pressed={activeEditorFormats[key]}
                                    onMouseDown={ev => {
                                        ev.preventDefault();
                                        action();
                                    }}
                                >
                                    {text ? <span className="task-menu-toolbar-text">{text}</span> : <Icon className="h-[14px] w-[14px]" />}
                                    {ordered && <span className="task-menu-toolbar-order">1.</span>}
                                </button>
                                    <p className="pointer-events-none absolute whitespace-pre left-1/2 -translate-x-[50%] top-[120%]
            opacity-0 group-hover/task-btn:opacity-100 transition ease-linear duration-200
             text-white bg-gray-800 rounded text-xs p-1">{label}</p>
                                </div>
                            ))}
                            <div ref={taskTypeMenuRef} className="relative inline-flex shrink-0">
                                {(() => {
                                    const TaskTypeIcon = getTaskTypeIcon(taskType);
                                    return (
                                <button
                                    type="button"
                                    className="task-menu-type-trigger"
                                    onClick={ev => {
                                        ev.preventDefault();
                                        ev.stopPropagation();
                                        setIsTaskTypeMenuOpen(prev => !prev);
                                    }}
                                    aria-expanded={isTaskTypeMenuOpen}
                                >
                                    {rawTaskType ? <TaskTypeIcon className="h-[14px] w-[14px] shrink-0 text-black" /> : null}
                                    <span className="truncate">
                                        {rawTaskType
                                            ? (taskType === "meeting" ? t(language, "taskTypeMeeting") : t(language, "taskTypeTask"))
                                            : t(language, "taskType")}
                                    </span>
                                    <ChevronDown className="h-4 w-4 shrink-0 text-black" />
                                </button>
                                    );
                                })()}
                                {isTaskTypeMenuOpen && (
                                    <div className="task-menu-type-menu option-menu-surface" onClick={ev => ev.stopPropagation()}>
                                        <button
                                            type="button"
                                            className={`task-menu-type-option ${taskType !== "meeting" ? "is-active" : ""}`}
                                            onClick={() => handleTaskTypeSelect("task")}
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                <CheckSquareBroken className="h-[14px] w-[14px] shrink-0" />
                                            <span>{t(language, "taskTypeTask")}</span>
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`task-menu-type-option ${taskType === "meeting" ? "is-active" : ""}`}
                                            onClick={() => handleTaskTypeSelect("meeting")}
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                <MeetingIcon className="h-[14px] w-[14px] shrink-0" />
                                            <span>{t(language, "taskTypeMeeting")}</span>
                                            </span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div
                            ref={editorRef}
                            className="task-menu-editor mt-4"
                            contentEditable
                            suppressContentEditableWarning
                            data-placeholder={t(language, "notesPlaceholder")}
                            onInput={() => {
                                syncEditorToMarkdown();
                                syncMentionMenu();
                                syncSlashMenu();
                            }}
                            onBlur={() => {
                                syncEditorToMarkdown();
                                closeMentionMenu();
                            }}
                            onFocus={() => {
                                syncActiveEditorFormats();
                                syncMentionMenu();
                                syncSlashMenu();
                            }}
                            onKeyDown={handleEditorKeyDown}
                            onKeyUp={() => {
                                syncActiveEditorFormats();
                                syncMentionMenu();
                                syncSlashMenu();
                            }}
                            onMouseUp={() => {
                                syncActiveEditorFormats();
                                syncMentionMenu();
                                syncSlashMenu();
                            }}
                            onPaste={handleEditorPaste}
                            onClick={handleEditorClick}
                        />
                        {isSlashMenuOpen && (
                            <div
                                ref={slashMenuRef}
                                className="task-inline-menu task-inline-menu-slash"
                                style={{
                                    top: `${slashMenuPosition.top}px`,
                                    left: `${slashMenuPosition.left}px`,
                                }}
                            >
                                <div className="task-inline-menu-section">
                                    <p className="task-inline-menu-title">{t(language, "insertElement")}</p>
                                </div>
                                {slashSuggestions.length > 0 ? (
                                    slashSuggestions.map((command, index) => {
                                        const Icon = command.icon;
                                        return (
                                            <button
                                                key={command.key}
                                                type="button"
                                                className={`task-inline-menu-option ${index === selectedSlashIndex ? "is-active" : ""}`}
                                                onMouseEnter={() => setSelectedSlashIndex(index)}
                                                onMouseDown={ev => {
                                                    if (ev.button !== 0) return;
                                                    ev.preventDefault();
                                                    insertSlashCommand(command);
                                                }}
                                            >
                                                <span className="task-inline-menu-option-icon">
                                                    <Icon className="h-[16px] w-[16px]" />
                                                </span>
                                                <span className="task-inline-menu-option-content">
                                                    <span className="task-inline-menu-option-label">{command.label}</span>
                                                </span>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="task-inline-menu-empty">{t(language, "slashNoResults")}</div>
                                )}
                            </div>
                        )}
                        {isMentionMenuOpen && (
                            <div
                                className="task-inline-menu task-inline-menu-mention"
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
                                            className={`task-inline-menu-option ${index === selectedMentionIndex ? "is-active" : ""}`}
                                            onMouseDown={ev => {
                                                ev.preventDefault();
                                                insertTaskMention(task);
                                            }}
                                        >
                                            <span className="task-inline-menu-option-content">
                                                <span className="task-inline-menu-option-label">@{task.name}</span>
                                            </span>
                                        </button>
                                    ))
                                ) : (
                                    <div className="task-inline-menu-empty">{t(language, "mentionNoResults")}</div>
                                )}
                            </div>
                        )}
                        {isCalloutTypeMenuOpen && (
                            <div
                                ref={calloutTypeMenuRef}
                                className="task-callout-type-menu option-menu-surface"
                                style={{
                                    top: `${calloutTypeMenuPosition.top}px`,
                                    left: `${calloutTypeMenuPosition.left}px`,
                                    transform: "translateY(calc(-100% - 8px))",
                                }}
                                onClick={ev => ev.stopPropagation()}
                            >
                                <button
                                    type="button"
                                    className="task-callout-type-option"
                                    aria-label={t(language, "calloutInfo")}
                                    onMouseDown={ev => {
                                        ev.preventDefault();
                                        updateActiveCalloutType("info");
                                    }}
                                >
                                    <span className="task-callout-type-option-icon">
                                        {renderCalloutTypeIcon("info")}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    className="task-callout-type-option"
                                    aria-label={t(language, "calloutAlert")}
                                    onMouseDown={ev => {
                                        ev.preventDefault();
                                        updateActiveCalloutType("warning");
                                    }}
                                >
                                    <span className="task-callout-type-option-icon">
                                        {renderCalloutTypeIcon("warning")}
                                    </span>
                                </button>
                            </div>
                        )}
                        {activeTableOverlay && (
                            <div
                                className="task-table-active-outline"
                                style={{
                                    top: `${activeTableOverlay.top}px`,
                                    left: `${activeTableOverlay.left}px`,
                                    width: `${activeTableOverlay.width}px`,
                                    height: `${activeTableOverlay.height}px`,
                                }}
                                aria-hidden="true"
                            />
                        )}
                        {activeTableOverlay && (
                            <>
                                {activeTableOverlay.columnHandles.map(handle => (
                                    <button
                                        key={handle.key}
                                        type="button"
                                        className="task-table-handle task-table-handle-column"
                                        style={{
                                            top: `${handle.top}px`,
                                            left: `${handle.left}px`,
                                        }}
                                    onMouseDown={ev => {
                                        ev.preventDefault();
                                        lockTableUiInteraction();
                                        addTableColumn(handle.insertAtIndex);
                                    }}
                                        aria-label={t(language, "table")}
                                    >
                                        <span className="task-table-handle-dot" />
                                        <Plus className="task-table-handle-plus h-[12px] w-[12px]" />
                                    </button>
                                ))}
                                {activeTableOverlay.rowHandles.map(handle => (
                                    <button
                                        key={handle.key}
                                        type="button"
                                        className="task-table-handle task-table-handle-row"
                                        style={{
                                            top: `${handle.top}px`,
                                            left: `${handle.left}px`,
                                        }}
                                    onMouseDown={ev => {
                                        ev.preventDefault();
                                        lockTableUiInteraction();
                                        addTableRow(handle.insertAtIndex);
                                    }}
                                        aria-label={t(language, "table")}
                                    >
                                        <span className="task-table-handle-dot" />
                                        <Plus className="task-table-handle-plus h-[12px] w-[12px]" />
                                    </button>
                                ))}
                            </>
                        )}
                        {tableCellMenuState && (
                            <>
                                <button
                                    type="button"
                                    className="task-table-cell-menu-trigger"
                                    style={{
                                        top: `${tableCellMenuState.top}px`,
                                        left: `${tableCellMenuState.left}px`,
                                    }}
                                    onMouseDown={ev => {
                                        ev.preventDefault();
                                        ev.stopPropagation();
                                        lockTableUiInteraction();
                                        setTableCellMenuState(prev => prev ? { ...prev, isOpen: !prev.isOpen } : prev);
                                    }}
                                    aria-label="Cell options"
                                >
                                    <ChevronDown className="h-[12px] w-[12px]" />
                                </button>
                                {tableCellMenuState.isOpen && (
                                    <div
                                        ref={tableCellMenuRef}
                                        className="task-table-cell-menu option-menu-surface"
                                        style={{
                                            top: `${tableCellMenuState.top + 26}px`,
                                            left: `${Math.max(tableCellMenuState.left - 180, 0)}px`,
                                        }}
                                        onClick={ev => ev.stopPropagation()}
                                    >
                                        <button type="button" className="task-table-cell-menu-option" onMouseDown={ev => { ev.preventDefault(); lockTableUiInteraction(); setActiveCellVerticalAlign("top"); }}>
                                            {t(language, "tableAlignTop")}
                                        </button>
                                        <button type="button" className="task-table-cell-menu-option" onMouseDown={ev => { ev.preventDefault(); lockTableUiInteraction(); setActiveCellVerticalAlign("middle"); }}>
                                            {t(language, "tableAlignMiddle")}
                                        </button>
                                        <button type="button" className="task-table-cell-menu-option" onMouseDown={ev => { ev.preventDefault(); lockTableUiInteraction(); setActiveCellVerticalAlign("bottom"); }}>
                                            {t(language, "tableAlignBottom")}
                                        </button>
                                        <div className="task-table-cell-menu-divider" />
                                        <button type="button" className="task-table-cell-menu-option" onMouseDown={ev => { ev.preventDefault(); lockTableUiInteraction(); deleteSelectedTableColumn(); }}>
                                            {t(language, "tableDeleteColumn")}
                                        </button>
                                        <button type="button" className="task-table-cell-menu-option" onMouseDown={ev => { ev.preventDefault(); lockTableUiInteraction(); deleteSelectedTableRow(); }}>
                                            {t(language, "tableDeleteRow")}
                                        </button>
                                        <button type="button" className="task-table-cell-menu-option is-danger" onMouseDown={ev => { ev.preventDefault(); lockTableUiInteraction(); deleteActiveTable(); }}>
                                            {t(language, "tableDeleteTable")}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                        {relatedLinksEnabled && (
                        <section className="mt-4 border-t border-[rgba(0,0,0,0.15)] pt-4">
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
                                    className="mt-2 text-xs text-[#6b7280] underline underline-offset-2"
                                >
                                    {t(language, "cancelEdit")}
                                </button>
                            )}
                            <ul className="mt-4 space-y-2">
                                {relatedLinks.length === 0 && (
                                    <li className="text-xs text-[#6b7280]">{t(language, "noLinks")}</li>
                                )}
                                {relatedLinks.map((link, index) => (
                                    <li key={`${index}-${link.url}-${link.name}`} className="rounded-[14px] bg-[rgba(237,237,242,1)] px-4 py-3">
                                        <a
                                            href={normalizeLinkUrl(link.url)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="group/link-row flex items-center justify-between gap-2"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-black">{link.name || t(language, "untitledLink")}</p>
                                                <p className="truncate text-xs text-[#6b7280]">{link.url}</p>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 transition-opacity duration-150 group-hover/link-row:opacity-100">
                                                <div className="relative group/edit-link">
                                                    <button
                                                        type="button"
                                                        onClick={ev => {
                                                            ev.preventDefault();
                                                            startEditingRelatedLink(index);
                                                        }}
                                                        className="text-black transition-colors hover:text-black/70"
                                                        aria-label={t(language, "editLink")}
                                                    >
                                                        <Edit02 className="h-[14px] w-[14px]" />
                                                    </button>
                                                    <p className="pointer-events-none absolute bottom-[150%] left-1/2 -translate-x-1/2 whitespace-pre rounded tooltip-surface p-1 text-xs text-white opacity-0 transition ease-linear duration-200 group-hover/edit-link:opacity-100">
                                                        {t(language, "editLink")}
                                                    </p>
                                                </div>
                                                <div className="relative group/remove-link">
                                                    <button
                                                        type="button"
                                                        onClick={ev => {
                                                            ev.preventDefault();
                                                            removeRelatedLink(index);
                                                        }}
                                                        className="text-black transition-colors hover:text-black/70"
                                                        aria-label={t(language, "removeLink")}
                                                    >
                                                        <X className="h-[14px] w-[14px]" />
                                                    </button>
                                                    <p className="pointer-events-none absolute bottom-[150%] left-1/2 -translate-x-1/2 whitespace-pre rounded tooltip-surface p-1 text-xs text-white opacity-0 transition ease-linear duration-200 group-hover/remove-link:opacity-100">
                                                        {t(language, "removeLink")}
                                                    </p>
                                                </div>
                                            </div>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </section>
                        )}
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
                        <input type="checkbox" id="task-done" name="task-done" checked={isTaskDone} className="hidden"
                               readOnly={true}/>
                        <input type="hidden" id="task-type" name="task-type" value={taskType || "task"} readOnly />
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
