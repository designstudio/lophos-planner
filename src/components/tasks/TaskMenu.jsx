import React from "react";
import Blur from "../Blur.jsx";
import TaskMenuBtn from "./TaskMenuBtn.jsx";
import { useSearchParams } from "react-router-dom";
import {
    Calendar,
    CheckCircle,
    CheckSquareBroken,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Edit02,
    Trash03,
} from "@untitledui/icons";
import { deleteTask, tryCatchDecorator } from "../../scripts/api.js";
import { useTaskMenu } from "../../contexts/TaskMenuContext.jsx";
import useAnimatedPresence from "../../hooks/useAnimatedPresence.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { formatTaskDetailDate, getAppLanguage, getLocale, t } from "../../scripts/i18n.js";
import { clearTaskFromUrl, closeForm, openForm, parseDateOnly, toShortId } from "../../scripts/utils.js";
import { hasTaskNoteContent, normalizeTaskNote } from "../../scripts/taskNotes.js";
import TaskNoteEditor from "./TaskNoteEditor.jsx";
import CompletedTaskCheckIcon from "./CompletedTaskCheckIcon.jsx";

function MeetingIcon(props) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M13 3.5V6.2C13 7.88016 13 8.72024 13.327 9.36197C13.6146 9.92646 14.0735 10.3854 14.638 10.673C15.2798 11 16.1198 11 17.8 11H20.5M21 12.9882V16.2C21 17.8802 21 18.7202 20.673 19.362C20.3854 19.9265 19.9265 20.3854 19.362 20.673C18.7202 21 17.8802 21 16.2 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V7.8C3 6.11984 3 5.27976 3.32698 4.63803C3.6146 4.07354 4.07354 3.6146 4.63803 3.32698C5.27976 3 6.11984 3 7.8 3H11.0118C11.7455 3 12.1124 3 12.4577 3.08289C12.7638 3.15638 13.0564 3.27759 13.3249 3.44208C13.6276 3.6276 13.887 3.88703 14.4059 4.40589L19.5941 9.59411C20.113 10.113 20.3724 10.3724 20.5579 10.6751C20.7224 10.9436 20.8436 11.2362 20.9171 11.5423C21 11.8876 21 12.2545 21 12.9882Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 16H7M11 12H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
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

function buildCalendarDays(monthDate, weekStartsOn) {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    const weekStartIndex = weekStartsOn === "Sunday" ? 0 : 1;
    const leadingDays = (monthStart.getDay() - weekStartIndex + 7) % 7;
    const totalDays = monthEnd.getDate();
    const cells = [];

    for (let index = leadingDays; index > 0; index -= 1) {
        const date = new Date(monthStart);
        date.setDate(monthStart.getDate() - index);
        cells.push({ date, inMonth: false });
    }

    for (let day = 1; day <= totalDays; day += 1) {
        cells.push({
            date: new Date(monthDate.getFullYear(), monthDate.getMonth(), day),
            inMonth: true,
        });
    }

    while (cells.length % 7 !== 0) {
        const lastDate = cells[cells.length - 1]?.date || monthEnd;
        const date = new Date(lastDate);
        date.setDate(lastDate.getDate() + 1);
        cells.push({ date, inMonth: false });
    }

    return cells;
}

function normalizeLinkUrl(url) {
    const trimmed = (url || "").trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

function getTaskTypeIcon(taskType) {
    return taskType === "meeting" ? MeetingIcon : CheckSquareBroken;
}

export default function TaskMenu() {
    const { taskData, setTaskData } = useTaskMenu();
    const [searchParams, setSearchParams] = useSearchParams();
    const { currentUser, agendas } = useAuth();
    const {
        id: taskId,
        date,
        color,
        name,
        done,
        description,
        task_type: rawTaskType,
        relatedLinks: taskRelatedLinks,
        related_links: taskRelatedLinksLegacy,
        note_format,
        note_blocks,
        note_plain_text,
        note_migrated_at,
    } = taskData;

    const taskType = rawTaskType || "task";
    const language = getAppLanguage(currentUser?.language);
    const locale = getLocale(language);
    const openedTaskId = searchParams.get("task") || searchParams.get("openedTask");
    const currentAgenda = agendas?.find(agenda => String(agenda.id) === String(currentUser?.currentAgendaId));
    const relatedLinksEnabled = currentAgenda?.related_links_enabled ?? true;
    const weekStartsOn = currentUser?.weekStartsOn || "Monday";
    const selectedDate = React.useMemo(() => {
        if (!date) return null;
        return parseDateOnly(date);
    }, [date]);

    const initialRelatedLinks = React.useMemo(() => {
        const rawLinks = taskRelatedLinks ?? taskRelatedLinksLegacy;
        if (!Array.isArray(rawLinks)) return [];

        return rawLinks
            .filter(link => link && typeof link === "object")
            .map(link => ({
                name: (link.name || "").toString(),
                url: (link.url || "").toString(),
            }));
    }, [taskRelatedLinks, taskRelatedLinksLegacy]);

    const initialNote = React.useMemo(() => normalizeTaskNote({
        description,
        note_format,
        note_blocks,
        note_plain_text,
        note_migrated_at,
    }), [description, note_blocks, note_format, note_migrated_at, note_plain_text]);

    const titleInputRef = React.useRef(null);
    const noteEditorRef = React.useRef(null);
    const panelRef = React.useRef(null);
    const handleRef = React.useRef(null);
    const datePickerRef = React.useRef(null);
    const taskTypeMenuRef = React.useRef(null);
    const descriptionFieldRef = React.useRef(null);
    const noteDirtyFieldRef = React.useRef(null);
    const noteFormatFieldRef = React.useRef(null);
    const noteBlocksFieldRef = React.useRef(null);
    const notePlainTextFieldRef = React.useRef(null);
    const noteMigratedAtFieldRef = React.useRef(null);
    const deleteModalRef = React.useRef(null);
    const deleteConfirmButtonRef = React.useRef(null);
    const deleteCancelButtonRef = React.useRef(null);
    const dragStateRef = React.useRef({
        active: false,
        pointerId: null,
        startY: 0,
        currentY: 0,
    });
    const dragResetTimeoutRef = React.useRef(null);

    const [isTaskTypeMenuOpen, setIsTaskTypeMenuOpen] = React.useState(false);
    const { isMounted: isTaskTypeMenuMounted, isVisible: isTaskTypeMenuVisible } = useAnimatedPresence(isTaskTypeMenuOpen);
    const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);
    const { isMounted: isDatePickerMounted, isVisible: isDatePickerVisible } = useAnimatedPresence(isDatePickerOpen);
    const [calendarMonth, setCalendarMonth] = React.useState(() => startOfMonth(selectedDate || new Date()));
    const [relatedLinks, setRelatedLinks] = React.useState(initialRelatedLinks);
    const [newRelatedLinkName, setNewRelatedLinkName] = React.useState("");
    const [newRelatedLinkUrl, setNewRelatedLinkUrl] = React.useState("");
    const [editingRelatedLinkIndex, setEditingRelatedLinkIndex] = React.useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
    const [isDeletingTask, setIsDeletingTask] = React.useState(false);
    const [deleteTaskError, setDeleteTaskError] = React.useState("");
    const [shouldRestoreTaskMenu, setShouldRestoreTaskMenu] = React.useState(false);
    const [selectedTaskType, setSelectedTaskType] = React.useState(taskType);
    const [selectedTaskDate, setSelectedTaskDate] = React.useState(selectedDate);
    const [isTaskDone, setIsTaskDone] = React.useState(taskType === "meeting" ? false : Boolean(done));
    const [noteDraft, setNoteDraft] = React.useState({
        isDirty: false,
        format: initialNote.format,
        description: initialNote.markdown,
        note_format: initialNote.format,
        note_blocks: initialNote.blocks,
        note_plain_text: initialNote.plainText,
        note_migrated_at: initialNote.migratedAt,
    });

    const syncNoteDraftFields = React.useCallback(nextDraft => {
        if (descriptionFieldRef.current) {
            descriptionFieldRef.current.value = nextDraft.description || "";
        }
        if (noteDirtyFieldRef.current) {
            noteDirtyFieldRef.current.value = nextDraft.isDirty ? "true" : "false";
        }
        if (noteFormatFieldRef.current) {
            noteFormatFieldRef.current.value = nextDraft.note_format || "";
        }
        if (noteBlocksFieldRef.current) {
            noteBlocksFieldRef.current.value = nextDraft.note_blocks ? JSON.stringify(nextDraft.note_blocks) : "";
        }
        if (notePlainTextFieldRef.current) {
            notePlainTextFieldRef.current.value = nextDraft.note_plain_text || "";
        }
        if (noteMigratedAtFieldRef.current) {
            noteMigratedAtFieldRef.current.value = nextDraft.note_migrated_at || "";
        }
    }, []);

    const handleNoteDraftChange = React.useCallback(nextDraft => {
        setNoteDraft(nextDraft);
        syncNoteDraftFields(nextDraft);
    }, [syncNoteDraftFields]);

    React.useLayoutEffect(() => {
        if (titleInputRef.current) {
            titleInputRef.current.value = name || "";
            autoResizeTitle();
        }
    }, [name, taskId]);

    React.useEffect(() => {
        if (titleInputRef.current) {
            titleInputRef.current.value = name || "";
            autoResizeTitle();
        }

        setSelectedTaskType(taskType);
        setSelectedTaskDate(selectedDate);
        setIsTaskDone(taskType === "meeting" ? false : Boolean(done));
        setCalendarMonth(startOfMonth(selectedDate || new Date()));
        setRelatedLinks(initialRelatedLinks);
        setNewRelatedLinkName("");
        setNewRelatedLinkUrl("");
        setEditingRelatedLinkIndex(null);
        setIsTaskTypeMenuOpen(false);
        setIsDatePickerOpen(false);
        setNoteDraft({
            isDirty: false,
            format: initialNote.format,
            description: initialNote.markdown,
            note_format: initialNote.format,
            note_blocks: initialNote.blocks,
            note_plain_text: initialNote.plainText,
            note_migrated_at: initialNote.migratedAt,
        });
    }, [done, initialNote.blocks, initialNote.format, initialNote.markdown, initialNote.migratedAt, initialNote.plainText, initialRelatedLinks, name, selectedDate, taskId, taskType]);

    React.useEffect(() => {
        syncNoteDraftFields(noteDraft);
    }, [noteDraft, syncNoteDraftFields]);

    React.useEffect(() => {
        function handleFlushRequest(event) {
            if (event.detail?.type !== "task-menu") return;
            const nextDraft = noteEditorRef.current?.flushPendingState?.();
            if (nextDraft) {
                event.detail.noteDraft = nextDraft;
            }
        }

        window.addEventListener("task-note-flush-request", handleFlushRequest);
        return () => window.removeEventListener("task-note-flush-request", handleFlushRequest);
    }, []);

    React.useEffect(() => {
        const handleEl = handleRef.current;
        const panelEl = panelRef.current;
        if (!handleEl || !panelEl || typeof window === "undefined" || !("PointerEvent" in window)) {
            return undefined;
        }

        const mobileQuery = window.matchMedia("(max-width: 767px)");
        const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

        function clearResetTimer() {
            if (dragResetTimeoutRef.current) {
                window.clearTimeout(dragResetTimeoutRef.current);
                dragResetTimeoutRef.current = null;
            }
        }

        function resetPanelPosition(shouldAnimate) {
            clearResetTimer();
            panelEl.dataset.closeTranslateY = "";

            if (!shouldAnimate || reducedMotionQuery.matches) {
                panelEl.style.transition = "";
                panelEl.style.transform = "";
                panelEl.style.willChange = "";
                return;
            }

            panelEl.style.transition = "transform 180ms ease";
            panelEl.style.transform = "translateY(0)";
            panelEl.style.willChange = "transform";
            dragResetTimeoutRef.current = window.setTimeout(() => {
                panelEl.style.transition = "";
                panelEl.style.transform = "";
                panelEl.style.willChange = "";
                dragResetTimeoutRef.current = null;
            }, 180);
        }

        function requestTaskMenuClose() {
            window.dispatchEvent(new CustomEvent("modal-close-request", {
                detail: { type: "task-menu" },
            }));
        }

        function stopDragging(shouldClose) {
            const dragState = dragStateRef.current;
            if (!dragState.active) return;

            dragState.active = false;

            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", handlePointerCancel);

            if (shouldClose) {
                panelEl.dataset.closeTranslateY = "calc(100% + env(safe-area-inset-bottom))";
                requestTaskMenuClose();
                return;
            }

            resetPanelPosition(true);
        }

        function handlePointerMove(event) {
            const dragState = dragStateRef.current;
            if (!dragState.active || dragState.pointerId !== event.pointerId) return;

            const nextY = Math.max(0, event.clientY - dragState.startY);
            dragState.currentY = nextY;
            panelEl.style.transition = "none";
            panelEl.style.transform = `translateY(${nextY}px)`;
            panelEl.style.willChange = "transform";
            panelEl.dataset.closeTranslateY = "calc(100% + env(safe-area-inset-bottom))";
            event.preventDefault();
        }

        function handlePointerUp(event) {
            const dragState = dragStateRef.current;
            if (!dragState.active || dragState.pointerId !== event.pointerId) return;

            const threshold = Math.min(120, Math.max(100, panelEl.offsetHeight * 0.28));
            stopDragging(dragState.currentY >= threshold);
        }

        function handlePointerCancel(event) {
            const dragState = dragStateRef.current;
            if (!dragState.active || dragState.pointerId !== event.pointerId) return;
            stopDragging(false);
        }

        function handlePointerDown(event) {
            if (!mobileQuery.matches) return;
            if (event.pointerType === "mouse" && event.button !== 0) return;

            clearResetTimer();

            dragStateRef.current.active = true;
            dragStateRef.current.pointerId = event.pointerId;
            dragStateRef.current.startY = event.clientY;
            dragStateRef.current.currentY = 0;

            panelEl.style.transition = "none";
            panelEl.style.willChange = "transform";
            handleEl.setPointerCapture?.(event.pointerId);

            window.addEventListener("pointermove", handlePointerMove, { passive: false });
            window.addEventListener("pointerup", handlePointerUp);
            window.addEventListener("pointercancel", handlePointerCancel);
            event.preventDefault();
        }

        handleEl.addEventListener("pointerdown", handlePointerDown);

        return () => {
            clearResetTimer();
            handleEl.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", handlePointerCancel);
        };
    }, [taskId]);

    React.useEffect(() => {
        if (!openedTaskId) return;
        titleInputRef.current?.focus();
    }, [openedTaskId]);

    React.useEffect(() => {
        if (!isDeleteModalOpen || !deleteModalRef.current) return;

        const modalEl = deleteModalRef.current;
        modalEl.style.transition = "none";
        modalEl.style.transform = "translateY(24px)";
        modalEl.style.opacity = "0";

        requestAnimationFrame(() => {
            modalEl.style.transition = "transform 160ms ease, opacity 160ms ease";
            modalEl.style.transform = "translateY(0)";
            modalEl.style.opacity = "1";
            deleteCancelButtonRef.current?.focus?.();
        });
    }, [isDeleteModalOpen]);

    React.useEffect(() => {
        function handleKeyDown(ev) {
            if (!isDeleteModalOpen) return;

            if (ev.key === "Escape") {
                if (isDeletingTask) return;
                ev.preventDefault();
                closeDeleteTaskModal();
                return;
            }

            if (ev.key !== "Tab") return;

            const focusableElements = [
                deleteConfirmButtonRef.current,
                deleteCancelButtonRef.current,
            ].filter(Boolean);

            if (focusableElements.length === 0) return;

            const currentIndex = focusableElements.indexOf(document.activeElement);
            const nextIndex = ev.shiftKey
                ? (currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1)
                : (currentIndex === -1 || currentIndex === focusableElements.length - 1 ? 0 : currentIndex + 1);

            ev.preventDefault();
            focusableElements[nextIndex]?.focus?.();
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isDeleteModalOpen, isDeletingTask]);

    React.useEffect(() => {
        if (!openedTaskId) return;
        openForm("task-menu");
    }, [openedTaskId]);

    React.useEffect(() => {
        if (isDeleteModalOpen || !shouldRestoreTaskMenu) return;
        openForm("task-menu");
        setShouldRestoreTaskMenu(false);
    }, [isDeleteModalOpen, shouldRestoreTaskMenu]);

    React.useEffect(() => {
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

    React.useEffect(() => {
        if (!isDatePickerOpen) return;

        function handlePointerDown(event) {
            if (!datePickerRef.current?.contains(event.target)) {
                setIsDatePickerOpen(false);
            }
        }

        document.addEventListener("pointerdown", handlePointerDown);
        return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, [isDatePickerOpen]);

    React.useEffect(() => {
        if (!isTaskTypeMenuOpen) return;

        function handlePointerDown(event) {
            if (!taskTypeMenuRef.current?.contains(event.target)) {
                setIsTaskTypeMenuOpen(false);
            }
        }

        document.addEventListener("pointerdown", handlePointerDown);
        return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, [isTaskTypeMenuOpen]);

    function autoResizeTitle() {
        if (!titleInputRef.current) return;
        const titleEl = titleInputRef.current;
        titleEl.style.height = "auto";
        titleEl.style.height = `${Math.max(titleEl.scrollHeight + 4, 52)}px`;
    }

    function openDeleteTaskModal() {
        setDeleteTaskError("");
        setShouldRestoreTaskMenu(false);
        closeForm("task-menu");
        setIsDeleteModalOpen(true);
    }

    function closeDeleteTaskModal() {
        if (isDeletingTask) return;
        setShouldRestoreTaskMenu(true);
        setIsDeleteModalOpen(false);
        setDeleteTaskError("");
    }

    async function handleDeleteTask() {
        if (!taskId) return;

        setIsDeletingTask(true);
        setDeleteTaskError("");
        const result = await tryCatchDecorator(deleteTask)(taskId);
        if (!result.success) {
            setDeleteTaskError(result.message || t(language, "taskDeleteError"));
            setIsDeletingTask(false);
            return;
        }

        window.dispatchEvent(new CustomEvent("task-deleted", {
            detail: { taskId },
        }));

        setTaskData(prev => ({
            ...prev,
            id: null,
            name: "",
            description: "",
            note_format: "markdown",
            note_blocks: null,
            note_plain_text: "",
            note_migrated_at: null,
            relatedLinks: [],
        }));

        clearTaskFromUrl();
        await closeForm("task-menu");
        setSearchParams(prevParams => {
            const next = new URLSearchParams(prevParams);
            next.delete("task");
            next.delete("openedTask");
            return next;
        });
        setShouldRestoreTaskMenu(false);
        setIsDeleteModalOpen(false);
        setIsDeletingTask(false);
    }

    function handleTaskTypeSelect(nextType) {
        setSelectedTaskType(nextType);
        if (nextType === "meeting") {
            setIsTaskDone(false);
        }
        setIsTaskTypeMenuOpen(false);
        noteEditorRef.current?.focus();
    }

    function handleDateSelect(nextDate) {
        setSelectedTaskDate(nextDate);
        setCalendarMonth(startOfMonth(nextDate));
        setIsDatePickerOpen(false);
    }

    function handleToggleDone() {
        if (selectedTaskType === "meeting") return;
        setIsTaskDone(prev => !prev);
    }

    function handleOpenReferencedTask(referencedTaskId) {
        if (!referencedTaskId) return;

        setSearchParams(prevParams => {
            const next = new URLSearchParams(prevParams);
            next.delete("openedTask");
            next.set("task", toShortId(referencedTaskId));
            return next;
        });
    }

    const taskHasNotes = React.useMemo(() => (
        hasTaskNoteContent({
            ...taskData,
            description: noteDraft.description,
            note_format: noteDraft.note_format,
            note_blocks: noteDraft.note_blocks,
            note_plain_text: noteDraft.note_plain_text,
            note_migrated_at: noteDraft.note_migrated_at,
        })
    ), [noteDraft.description, noteDraft.note_blocks, noteDraft.note_format, noteDraft.note_migrated_at, noteDraft.note_plain_text, taskData]);

    function addOrUpdateRelatedLink() {
        const normalizedUrl = (newRelatedLinkUrl || "").trim();
        if (!normalizedUrl) return;

        const nextLink = {
            name: (newRelatedLinkName || "").trim(),
            url: normalizedUrl,
        };

        setRelatedLinks(prevLinks => {
            if (editingRelatedLinkIndex === null) {
                return [...prevLinks, nextLink];
            }

            return prevLinks.map((link, index) => (
                index === editingRelatedLinkIndex ? nextLink : link
            ));
        });

        setNewRelatedLinkName("");
        setNewRelatedLinkUrl("");
        setEditingRelatedLinkIndex(null);
    }

    function startEditingRelatedLink(index) {
        const link = relatedLinks[index];
        if (!link) return;
        setNewRelatedLinkName(link.name || "");
        setNewRelatedLinkUrl(link.url || "");
        setEditingRelatedLinkIndex(index);
    }

    function removeRelatedLink(index) {
        setRelatedLinks(prevLinks => prevLinks.filter((_, currentIndex) => currentIndex !== index));
        if (editingRelatedLinkIndex === index) {
            setNewRelatedLinkName("");
            setNewRelatedLinkUrl("");
            setEditingRelatedLinkIndex(null);
        }
    }

    function cancelEditingRelatedLink() {
        setNewRelatedLinkName("");
        setNewRelatedLinkUrl("");
        setEditingRelatedLinkIndex(null);
    }

    function handleRelatedLinkKeyDown(event) {
        if (event.key !== "Enter") return;
        event.preventDefault();
        addOrUpdateRelatedLink();
    }

    const calendarDays = React.useMemo(
        () => buildCalendarDays(calendarMonth, weekStartsOn),
        [calendarMonth, weekStartsOn]
    );
    const weekdayFormatter = React.useMemo(
        () => new Intl.DateTimeFormat(locale, { weekday: "short" }),
        [locale]
    );
    const calendarTitle = React.useMemo(
        () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(calendarMonth),
        [calendarMonth, locale]
    );
    const serializedRelatedLinks = JSON.stringify(relatedLinks);
    const TaskTypeIcon = getTaskTypeIcon(selectedTaskType);
    const showDoneButton = selectedTaskType !== "meeting";

    return (
        <>
            {!isDeleteModalOpen && (
                <Blur type="task-menu">
                    <div
                        ref={panelRef}
                        className="task-menu task-menu-panel relative z-20 mb-6 w-[32rem] max-w-full rounded-[28px] border-0 outline-none ring-0 px-6 py-6 shadow-none"
                        style={{
                            backgroundColor: "var(--color-bg-surface)",
                            color: "var(--color-text-muted)",
                        }}
                        onClick={event => {
                            event.stopPropagation();
                        }}
                    >
                        <div ref={handleRef} className="task-menu-sheet-handle" aria-hidden="true" />
                        <form className="task-menu-form">
                    <div className="task-menu-header">
                        <div className="task-menu-header-meta">
                            <div ref={datePickerRef} className="relative">
                                <button
                                    type="button"
                                    className="task-menu-date-trigger"
                                    onClick={() => setIsDatePickerOpen(prev => !prev)}
                                    aria-expanded={isDatePickerOpen}
                                >
                                    <Calendar className="h-4 w-4 shrink-0" />
                                    <p>{formatTaskDetailDate(selectedTaskDate, language)}</p>
                                </button>
                                {isDatePickerMounted && (
                                    <div className="task-menu-calendar animated-option-menu option-menu-surface" data-state={isDatePickerVisible ? "open" : "closed"}>
                                        <div className="task-menu-calendar-header">
                                            <button
                                                type="button"
                                                className="task-menu-calendar-nav"
                                                aria-label={t(language, "previousMonth")}
                                                onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </button>
                                            <p className="task-menu-calendar-title capitalize">{calendarTitle}</p>
                                            <button
                                                type="button"
                                                className="task-menu-calendar-nav"
                                                aria-label={t(language, "nextMonth")}
                                                onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <div className="task-menu-calendar-weekdays">
                                            {Array.from({ length: 7 }).map((_, index) => {
                                                const baseDate = new Date(2026, 0, weekStartsOn === "Sunday" ? index + 4 : index + 5);
                                                return (
                                                    <span key={index}>{weekdayFormatter.format(baseDate).replace(/\./g, "")}</span>
                                                );
                                            })}
                                        </div>
                                        <div className="task-menu-calendar-grid">
                                            {calendarDays.map(({ date: calendarDate, inMonth }) => {
                                                const isSelected = selectedTaskDate ? isSameDay(calendarDate, selectedTaskDate) : false;
                                                return (
                                                    <button
                                                        key={calendarDate.toISOString()}
                                                        type="button"
                                                        className={`task-menu-calendar-day ${isSelected ? "is-selected" : ""} ${inMonth ? "" : "is-outside-month"}`}
                                                        onClick={() => handleDateSelect(calendarDate)}
                                                    >
                                                        {calendarDate.getDate()}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div ref={taskTypeMenuRef} className="relative">
                                <button
                                    type="button"
                                    className="task-menu-type-trigger"
                                    onClick={() => setIsTaskTypeMenuOpen(prev => !prev)}
                                    aria-expanded={isTaskTypeMenuOpen}
                                >
                                    <span className="inline-flex min-w-0 items-center gap-2">
                                        <TaskTypeIcon className="h-4 w-4 shrink-0" />
                                        <span>{selectedTaskType === "meeting" ? t(language, "taskTypeMeeting") : t(language, "taskTypeTask")}</span>
                                    </span>
                                    <ChevronDown className="h-4 w-4 shrink-0" />
                                </button>
                                {isTaskTypeMenuMounted && (
                                    <div className="task-menu-type-menu animated-option-menu option-menu-surface" data-state={isTaskTypeMenuVisible ? "open" : "closed"}>
                                        <button
                                            type="button"
                                            className={`task-menu-type-option ${selectedTaskType === "task" ? "is-active" : ""}`}
                                            onClick={() => handleTaskTypeSelect("task")}
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                <CheckSquareBroken className="h-4 w-4 shrink-0" />
                                                <span>{t(language, "taskTypeTask")}</span>
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`task-menu-type-option ${selectedTaskType === "meeting" ? "is-active" : ""}`}
                                            onClick={() => handleTaskTypeSelect("meeting")}
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                <MeetingIcon className="h-4 w-4 shrink-0" />
                                                <span>{t(language, "taskTypeMeeting")}</span>
                                            </span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="task-menu-header-actions">
                            <TaskMenuBtn
                                icon={Trash03}
                                onClick={openDeleteTaskModal}
                                tooltip={t(language, "taskMenuDelete")}
                                buttonClassName="task-menu-delete-btn"
                            />
                        </div>
                    </div>

                    <div className="relative">
                        <textarea
                            ref={titleInputRef}
                            id="task-name"
                            name="task-name"
                            defaultValue={name}
                            onInput={autoResizeTitle}
                            rows={1}
                            className={"task-menu-title w-full resize-none overflow-y-hidden pt-0 pb-2 text-[24px] leading-[1.3] bg-transparent focus:outline-none "
                                + (selectedTaskType !== "meeting" ? "pr-12 " : "")
                                + ((isTaskDone && "opacity-40") || "")}
                            style={{ color: "var(--color-text-strong)" }}
                        />
                        {showDoneButton && (
                            <button
                                type="button"
                                className="absolute right-0 top-0 transition-colors duration-200 hover:opacity-70"
                                style={{ color: "var(--color-text-strong)" }}
                                onClick={event => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    handleToggleDone();
                                }}
                                aria-label={t(language, isTaskDone ? "markAsPending" : "markAsDone")}
                            >
                                {isTaskDone ? (
                                    <CompletedTaskCheckIcon className="h-[22px] w-[22px] opacity-40" />
                                ) : (
                                    <CheckCircle className="h-[22px] w-[22px] opacity-75" />
                                )}
                            </button>
                        )}
                    </div>

                    <div className="task-menu-content-divider" aria-hidden="true" />

                    <TaskNoteEditor
                        ref={noteEditorRef}
                        className="task-menu-editor"
                        task={{
                            id: taskId,
                            description,
                            note_format,
                            note_blocks,
                            note_plain_text,
                            note_migrated_at,
                        }}
                        language={language}
                        onNoteChange={handleNoteDraftChange}
                        onTaskMentionClick={handleOpenReferencedTask}
                    />

                    {relatedLinksEnabled && (
                        <section className="mt-4 pt-4" style={{ borderTop: "1px solid var(--color-border-default)" }}>
                            <h4 className="text-sm font-semibold" style={{ color: "var(--color-text-strong)" }}>{t(language, "relatedLinks")}</h4>
                            <div className="task-menu-related-links-card mt-4">
                                <label className="task-menu-related-links-field">
                                    <input
                                        type="text"
                                        placeholder={t(language, "relatedLinkName")}
                                        value={newRelatedLinkName}
                                        onChange={event => setNewRelatedLinkName(event.target.value)}
                                        onKeyDown={handleRelatedLinkKeyDown}
                                        className="task-menu-related-links-input"
                                    />
                                </label>
                                <label className="task-menu-related-links-field task-menu-related-links-field-url">
                                    <input
                                        type="url"
                                        placeholder="https://..."
                                        value={newRelatedLinkUrl}
                                        onChange={event => setNewRelatedLinkUrl(event.target.value)}
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
                                    {editingRelatedLinkIndex === null ? t(language, "add") : t(language, "update")}
                                </button>
                            </div>
                            {editingRelatedLinkIndex !== null && (
                                <button
                                    type="button"
                                    onClick={cancelEditingRelatedLink}
                                    className="mt-2 text-xs underline underline-offset-2"
                                    style={{ color: "var(--color-text-subtle)" }}
                                >
                                    {t(language, "cancelEdit")}
                                </button>
                            )}
                            <ul className="mt-4 space-y-2">
                                {relatedLinks.length === 0 && (
                                    <li className="text-xs" style={{ color: "var(--color-text-subtle)" }}>{t(language, "noLinks")}</li>
                                )}
                                {relatedLinks.map((link, index) => (
                                    <li
                                        key={`${index}-${link.url}-${link.name}`}
                                        className="rounded-[14px] px-4 py-3"
                                        style={{ backgroundColor: "var(--color-bg-surface-muted)" }}
                                    >
                                        <a
                                            href={normalizeLinkUrl(link.url)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="group/link-row flex items-center justify-between gap-2"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium" style={{ color: "var(--color-text-strong)" }}>{link.name || t(language, "untitledLink")}</p>
                                                <p className="truncate text-xs" style={{ color: "var(--color-text-subtle)" }}>{link.url}</p>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 transition-opacity duration-150 group-hover/link-row:opacity-100">
                                                <div className="relative group/edit-link">
                                                    <button
                                                        type="button"
                                                        onClick={event => {
                                                            event.preventDefault();
                                                            startEditingRelatedLink(index);
                                                        }}
                                                        className="transition-opacity hover:opacity-70"
                                                        style={{ color: "var(--color-text-strong)" }}
                                                        aria-label={t(language, "editLink")}
                                                    >
                                                        <Edit02 className="h-[14px] w-[14px]" />
                                                    </button>
                                                    <p className="pointer-events-none absolute bottom-[150%] left-1/2 -translate-x-1/2 whitespace-pre rounded-ds-sm tooltip-surface p-1 ds-type-caption opacity-0 transition ease-linear duration-200 group-hover/edit-link:opacity-100">
                                                        {t(language, "editLink")}
                                                    </p>
                                                </div>
                                                <div className="relative group/remove-link">
                                                    <button
                                                        type="button"
                                                        onClick={event => {
                                                            event.preventDefault();
                                                            removeRelatedLink(index);
                                                        }}
                                                        className="transition-opacity hover:opacity-70"
                                                        style={{ color: "var(--color-text-strong)" }}
                                                        aria-label={t(language, "removeLink")}
                                                    >
                                                        <X className="h-[14px] w-[14px]" />
                                                    </button>
                                                    <p className="pointer-events-none absolute bottom-[150%] left-1/2 -translate-x-1/2 whitespace-pre rounded-ds-sm tooltip-surface p-1 ds-type-caption opacity-0 transition ease-linear duration-200 group-hover/remove-link:opacity-100">
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

                    <textarea
                        ref={descriptionFieldRef}
                        name="task-description"
                        id="task-description"
                        className="hidden"
                        value={noteDraft.description || ""}
                        readOnly
                    />
                    <input ref={noteDirtyFieldRef} type="hidden" name="task-description-dirty" value={noteDraft.isDirty ? "true" : "false"} readOnly />
                    <input ref={noteFormatFieldRef} type="hidden" name="task-note-format" value={noteDraft.note_format || ""} readOnly />
                    <input ref={noteBlocksFieldRef} type="hidden" name="task-note-blocks" value={noteDraft.note_blocks ? JSON.stringify(noteDraft.note_blocks) : ""} readOnly />
                    <input ref={notePlainTextFieldRef} type="hidden" name="task-note-plain-text" value={noteDraft.note_plain_text || ""} readOnly />
                    <input ref={noteMigratedAtFieldRef} type="hidden" name="task-note-migrated-at" value={noteDraft.note_migrated_at || ""} readOnly />
                    <input type="hidden" name="task-related-links" value={serializedRelatedLinks} readOnly />
                    <input type="checkbox" id="task-done" name="task-done" checked={showDoneButton && isTaskDone} className="hidden" readOnly />
                    <input type="hidden" id="task-type" name="task-type" value={selectedTaskType || "task"} readOnly />
                    <input type="hidden" id="task-date" name="task-date" value={selectedTaskDate ? toInputDate(selectedTaskDate) : ""} readOnly />
                    <input type="text" id="task-color" name="task-color" value={color || "none"} className="hidden" readOnly />
                    <input type="text" id="task-id" name="task-id" value={taskId || "none"} className="hidden" readOnly />
                        </form>
                    </div>
                </Blur>
            )}

            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto overscroll-contain px-4 pb-10 pt-16 ds-overlay" onClick={closeDeleteTaskModal}>
                    <div
                        ref={deleteModalRef}
                        className="ds-modal-shell relative mb-6 w-[32rem] max-w-full px-6 py-7"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-task-modal-title"
                        aria-describedby="delete-task-modal-description"
                        onClick={ev => ev.stopPropagation()}
                    >
                        <h4 id="delete-task-modal-title" className="ds-type-h4 text-ds-text-default">
                            {t(language, "taskDeleteConfirmTitle")}
                        </h4>
                        <p id="delete-task-modal-description" className="ds-type-body mt-3 text-ds-text-default">
                            {t(language, taskHasNotes ? "taskDeleteConfirmMessageWithNotes" : "taskDeleteConfirmMessage")}
                        </p>

                        {deleteTaskError && (
                            <p className="ds-alert ds-alert-danger mt-3">
                                {deleteTaskError}
                            </p>
                        )}

                        <div className="mt-5 flex items-center gap-3">
                            <button
                                ref={deleteConfirmButtonRef}
                                type="button"
                                disabled={isDeletingTask}
                                onClick={handleDeleteTask}
                                className="app-button-hover ds-button-danger bg-ds-danger-solid text-ds-text-inverse ds-type-body rounded-full px-6 py-2 font-bold disabled:opacity-20"
                            >
                                {isDeletingTask ? `${t(language, "confirmDeleteTask")}...` : t(language, "confirmDeleteTask")}
                            </button>
                            <button
                                ref={deleteCancelButtonRef}
                                type="button"
                                disabled={isDeletingTask}
                                onClick={closeDeleteTaskModal}
                                className="app-button-hover ds-button-secondary ds-type-body rounded-full px-6 py-2 font-bold disabled:opacity-20"
                            >
                                {t(language, "cancel")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
