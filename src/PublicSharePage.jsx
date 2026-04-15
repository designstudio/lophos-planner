import React from "react";
import Lottie from "lottie-react";
import todoLoadingAnimation from "./assets/todo-loading.json";
import { useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, X, Calendar, StickerSquare, LinkExternal01, SearchMd, XCircle, Attachment02 } from "@untitledui/icons";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { getPublicAgendaByShareToken } from "./scripts/api.js";
import { formatDayMonth, getLocale, t } from "./scripts/i18n.js";
import { formDate, matchesShortId, toShortId } from "./scripts/utils.js";

function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameDay(dateA, dateB) {
    return dateA.getFullYear() === dateB.getFullYear()
        && dateA.getMonth() === dateB.getMonth()
        && dateA.getDate() === dateB.getDate();
}

function normalizeRelatedLinks(task) {
    const rawLinks = task?.relatedLinks ?? task?.related_links;
    if (!Array.isArray(rawLinks)) return [];

    return rawLinks
        .filter(link => link && typeof link === "object")
        .map(link => ({
            name: (link.name || "").toString(),
            url: (link.url || "").toString(),
        }))
        .filter(link => link.url);
}

function normalizeLinkUrl(url) {
    const trimmed = (url || "").trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

function normalizeSearchText(text) {
    return (text || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function sanitizePublicHtml(html) {
    return DOMPurify.sanitize(html || "", {
        USE_PROFILES: { html: true },
        ADD_ATTR: ["class", "data-task-id", "contenteditable", "target", "rel"],
    });
}

function renderPublicDescription(markdown) {
    const rawHtml = marked.parse(markdown || "");
    const htmlWithMentions = rawHtml.replace(
        /<a href="#task:([^"]+)">/g,
        '<a href="#task:$1" data-task-id="$1" class="task-mention" contenteditable="false">'
    );
    return sanitizePublicHtml(htmlWithMentions);
}

function renderPublicTaskTitle(task, relatedLinkCount, maxLength = 34) {
    const taskName = task.name || "";
    const isTruncated = taskName.length > maxLength;
    const visibleTaskName = taskName.slice(0, maxLength) + (isTruncated ? "..." : "");

    return (
        <div className={`relative min-w-0 flex-1 ${isTruncated ? "group/task-title" : ""}`}>
            <h5 className={`public-task-title min-w-0 flex items-center gap-1 text-black ${task.done ? "opacity-40 line-through" : ""}`}>
                {task.description && <StickerSquare className="h-4 w-4 shrink-0" />}
                {relatedLinkCount > 0 && <Attachment02 className="h-4 w-4 shrink-0" />}
                <span className="block min-w-0 truncate">{visibleTaskName}</span>
            </h5>
            {isTruncated && (
                <p className="pointer-events-none absolute bottom-[120%] left-1/2 z-20 w-max max-w-[16rem] -translate-x-[50%] rounded tooltip-surface p-2 text-left text-xs leading-4 text-white opacity-0 transition-opacity delay-0 duration-150 ease-linear whitespace-normal break-words group-hover/task-title:opacity-100 group-hover/task-title:delay-[700ms]">
                    {taskName}
                </p>
            )}
        </div>
    );
}

function sortPublicBoardColumns(list) {
    return [...(list || [])].sort((columnA, columnB) => {
        const aOrder = Number(columnA.sort_order ?? 0);
        const bOrder = Number(columnB.sort_order ?? 0);
        if (aOrder !== bOrder) return aOrder - bOrder;

        const aCreatedAt = columnA.created_at || "";
        const bCreatedAt = columnB.created_at || "";
        if (aCreatedAt !== bCreatedAt) return String(aCreatedAt).localeCompare(String(bCreatedAt));

        return String(columnA.id).localeCompare(String(columnB.id));
    });
}

function sortPublicBoardTasks(list) {
    return [...(list || [])].sort((taskA, taskB) => {
        const aCompleted = taskA.done ? 1 : 0;
        const bCompleted = taskB.done ? 1 : 0;
        if (aCompleted !== bCompleted) return aCompleted - bCompleted;

        const aOrder = Number(taskA.board_order ?? 0);
        const bOrder = Number(taskB.board_order ?? 0);
        if (aOrder !== bOrder) return aOrder - bOrder;

        return String(taskA.id).localeCompare(String(taskB.id));
    });
}

function isImageAvatar(value) {
    return typeof value === "string" && (value.startsWith("data:image/") || value.startsWith("http://") || value.startsWith("https://"));
}

const MODAL_EXIT_DURATION_MS = 140;

export default function PublicSharePage() {
    const { shareToken } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();

    const [loading, setLoading] = React.useState(true);
    const [minLoadingDone, setMinLoadingDone] = React.useState(false);
    const [owner, setOwner] = React.useState(null);
    const [agenda, setAgenda] = React.useState(null);
    const [tasks, setTasks] = React.useState([]);
    const [boardColumns, setBoardColumns] = React.useState([]);
    const [selectedTask, setSelectedTask] = React.useState(null);
    const [isTaskPreviewOpen, setIsTaskPreviewOpen] = React.useState(false);
    const [isTaskPreviewVisible, setIsTaskPreviewVisible] = React.useState(false);
    const [isSearchOpen, setIsSearchOpen] = React.useState(false);
    const [isSearchVisible, setIsSearchVisible] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
    const [calendarMonth, setCalendarMonth] = React.useState(() => startOfMonth(new Date()));
    const calendarRef = React.useRef(null);
    const taskPreviewCloseTimeoutRef = React.useRef(null);
    const searchCloseTimeoutRef = React.useRef(null);

    React.useEffect(() => {
        const timer = setTimeout(() => setMinLoadingDone(true), 700);
        return () => clearTimeout(timer);
    }, []);

    React.useEffect(() => () => {
        if (taskPreviewCloseTimeoutRef.current) {
            clearTimeout(taskPreviewCloseTimeoutRef.current);
            taskPreviewCloseTimeoutRef.current = null;
        }
        if (searchCloseTimeoutRef.current) {
            clearTimeout(searchCloseTimeoutRef.current);
            searchCloseTimeoutRef.current = null;
        }
    }, []);

    React.useEffect(() => {
        let mounted = true;

        async function refreshPublicAgenda(showLoading = false) {
            if (showLoading) {
                setLoading(true);
            }

            try {
                const data = await getPublicAgendaByShareToken(shareToken);
                if (!mounted) return;

                if (!data) {
                    setOwner(null);
                    setAgenda(null);
                    setTasks([]);
                    setBoardColumns([]);
                    return;
                }

                setOwner(data.owner || null);
                setAgenda(data.agenda || null);
                setTasks(Array.isArray(data.tasks) ? data.tasks : []);
                setBoardColumns(Array.isArray(data.boardColumns) ? data.boardColumns : []);
            } catch {
                if (!mounted) return;
                setOwner(null);
                setAgenda(null);
                setTasks([]);
                setBoardColumns([]);
            } finally {
                if (mounted && showLoading) {
                    setLoading(false);
                }
            }
        }

        refreshPublicAgenda(true);
        const intervalId = setInterval(() => {
            refreshPublicAgenda(false);
        }, 15000);

        return () => {
            mounted = false;
            clearInterval(intervalId);
        };
    }, [shareToken]);

    React.useEffect(() => {
        const baseTitle = "Lophos Planner";
        const agendaName = (agenda?.name || "").trim();
        document.title = agendaName ? `${agendaName} - ${baseTitle}` : baseTitle;
    }, [agenda?.name]);

    const language = owner?.language || "ptBR";
    const dateFormat = owner?.dateFormat || "DD-MM";
    const weekStartsOn = owner?.weekStartsOn || "Monday";
    const agendaAccent = agenda?.color || "#3b82f6";
    const relatedLinksEnabled = agenda?.related_links_enabled ?? true;
    const isMobile = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 1023px)").matches;
    const publicTaskTitleMaxLength = isMobile ? 40 : 34;

    const now = new Date();
    const weekShift = Number(searchParams.get("weekShift") || 0);
    const openedTaskId = searchParams.get("task") || searchParams.get("openedTask");
    const shiftedDate = new Date(now);
    shiftedDate.setDate(shiftedDate.getDate() + (weekShift * 7));

    const weekStartIndex = weekStartsOn === "Sunday" ? 0 : 1;
    const dayOfWeek = (shiftedDate.getDay() - weekStartIndex + 7) % 7;

    React.useEffect(() => {
        setCalendarMonth(startOfMonth(shiftedDate));
    }, [shiftedDate.getFullYear(), shiftedDate.getMonth()]);

    React.useEffect(() => {
        if (!isCalendarOpen) return undefined;

        function handlePointerDown(ev) {
            if (calendarRef.current?.contains(ev.target)) return;
            setIsCalendarOpen(false);
        }

        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, [isCalendarOpen]);

    const dates = [];
    const tasksData = {};
    const shouldSortCompletedTasks = agenda?.sort_completed_tasks ?? true;
    const boardTaskList = React.useMemo(() => tasks.filter(task => task?.is_board_task), [tasks]);
    const weeklyTasks = React.useMemo(() => tasks.filter(task => !task?.is_board_task), [tasks]);

    const sortedTasks = [...weeklyTasks].sort((taskA, taskB) => {
        // First, separate completed from non-completed if sortCompletedTasks is enabled
        if (shouldSortCompletedTasks) {
            const aCompleted = taskA.done ? 1 : 0;
            const bCompleted = taskB.done ? 1 : 0;
            if (aCompleted !== bCompleted) return aCompleted - bCompleted;
        }

        const dateDiff = new Date(taskA.date).getTime() - new Date(taskB.date).getTime();
        if (dateDiff !== 0) return dateDiff;

        const orderDiff = (taskA.order ?? 0) - (taskB.order ?? 0);
        if (orderDiff !== 0) return orderDiff;

        return String(taskA.id).localeCompare(String(taskB.id));
    });

    for (let i = -dayOfWeek; i < -dayOfWeek + 7; i += 1) {
        const date = new Date(shiftedDate);
        date.setDate(date.getDate() + i);
        dates.push(date);
        tasksData[formDate(date)] = sortedTasks.filter(task => formDate(task.date) === formDate(date));
    }

    const publicBoardColumns = React.useMemo(() => sortPublicBoardColumns(boardColumns), [boardColumns]);
    const publicBoardTasks = React.useMemo(() => sortPublicBoardTasks(boardTaskList), [boardTaskList]);
    const shouldShowBoard = publicBoardColumns.length > 0 || publicBoardTasks.length > 0;

    function getBoardColumnTasks(columnId) {
        return publicBoardTasks.filter(task => String(task.board_column_id) === String(columnId));
    }

    function moveWeek(step) {
        const next = weekShift + step;
        setSearchParams(prev => {
            const nextParams = new URLSearchParams(prev);
            nextParams.set("weekShift", String(next));
            return nextParams;
        });
    }

    function setOpenedTaskInUrl(taskId) {
        setSearchParams(prev => {
            const nextParams = new URLSearchParams(prev);
            nextParams.delete("openedTask");
            nextParams.set("task", toShortId(taskId));
            return nextParams;
        });
    }

    function clearOpenedTaskInUrl() {
        setSearchParams(prev => {
            const nextParams = new URLSearchParams(prev);
            nextParams.delete("task");
            nextParams.delete("openedTask");
            return nextParams;
        });
    }

    function openTaskPreview(task) {
        if (taskPreviewCloseTimeoutRef.current) {
            clearTimeout(taskPreviewCloseTimeoutRef.current);
            taskPreviewCloseTimeoutRef.current = null;
        }

        setSelectedTask(task);
        setIsTaskPreviewOpen(true);
        requestAnimationFrame(() => setIsTaskPreviewVisible(true));
        setOpenedTaskInUrl(task.id);
    }

    function closeTaskPreview() {
        setIsTaskPreviewVisible(false);
        clearOpenedTaskInUrl();

        if (taskPreviewCloseTimeoutRef.current) {
            clearTimeout(taskPreviewCloseTimeoutRef.current);
        }
        taskPreviewCloseTimeoutRef.current = setTimeout(() => {
            setIsTaskPreviewOpen(false);
            setSelectedTask(null);
            taskPreviewCloseTimeoutRef.current = null;
        }, MODAL_EXIT_DURATION_MS);
    }

    function openReferencedTask(taskId) {
        if (!taskId) return;

        const referencedTask = tasks.find(item => String(item.id) === String(taskId));
        if (referencedTask) {
            openTaskPreview(referencedTask);
            return;
        }

        setSearchParams(prev => {
            const nextParams = new URLSearchParams(prev);
            nextParams.delete("openedTask");
            nextParams.set("task", toShortId(taskId));
            return nextParams;
        });
    }

    function openSearchModal() {
        if (searchCloseTimeoutRef.current) {
            clearTimeout(searchCloseTimeoutRef.current);
            searchCloseTimeoutRef.current = null;
        }

        setIsSearchOpen(true);
        requestAnimationFrame(() => setIsSearchVisible(true));
    }

    function closeSearchModal() {
        setIsSearchVisible(false);

        if (searchCloseTimeoutRef.current) {
            clearTimeout(searchCloseTimeoutRef.current);
        }
        searchCloseTimeoutRef.current = setTimeout(() => {
            setIsSearchOpen(false);
            setSearchQuery("");
            searchCloseTimeoutRef.current = null;
        }, MODAL_EXIT_DURATION_MS);
    }

    React.useEffect(() => {
        if (!openedTaskId) {
            if (selectedTask) {
                setIsTaskPreviewVisible(false);
                if (taskPreviewCloseTimeoutRef.current) {
                    clearTimeout(taskPreviewCloseTimeoutRef.current);
                }
                taskPreviewCloseTimeoutRef.current = setTimeout(() => {
                    setIsTaskPreviewOpen(false);
                    setSelectedTask(null);
                    taskPreviewCloseTimeoutRef.current = null;
                }, MODAL_EXIT_DURATION_MS);
            } else {
                setIsTaskPreviewVisible(false);
                setIsTaskPreviewOpen(false);
                setSelectedTask(null);
            }
            return;
        }

        const task = tasks.find(item => matchesShortId(item.id, openedTaskId));
        if (task) {
            if (taskPreviewCloseTimeoutRef.current) {
                clearTimeout(taskPreviewCloseTimeoutRef.current);
                taskPreviewCloseTimeoutRef.current = null;
            }
            setSelectedTask(task);
            setIsTaskPreviewOpen(true);
            requestAnimationFrame(() => setIsTaskPreviewVisible(true));
        }
    }, [openedTaskId, tasks]);

    React.useEffect(() => {
        function handleKeyDown(ev) {
            if (ev.key !== "Escape") return;

            if (isSearchOpen) {
                ev.preventDefault();
                closeSearchModal();
                return;
            }

            if (isTaskPreviewOpen) {
                ev.preventDefault();
                closeTaskPreview();
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isSearchOpen, isTaskPreviewOpen]);

    function getStartOfWeek(refDate) {
        const start = new Date(refDate);
        const startIndex = weekStartsOn === "Sunday" ? 0 : 1;
        const offset = (start.getDay() - startIndex + 7) % 7;
        start.setDate(start.getDate() - offset);
        start.setHours(0, 0, 0, 0);
        return start;
    }

    const weekdayLabels = React.useMemo(() => {
        const baseSunday = new Date(2024, 0, 7);

        return Array.from({ length: 7 }, (_, index) => {
            const weekDate = new Date(baseSunday);
            weekDate.setDate(baseSunday.getDate() + ((weekStartIndex + index) % 7));

            return new Intl.DateTimeFormat(getLocale(language), { weekday: "short" })
                .format(weekDate)
                .replaceAll(".", "")
                .toLowerCase();
        });
    }, [language, weekStartIndex]);

    const calendarTitle = React.useMemo(() => {
        const formatted = new Intl.DateTimeFormat(getLocale(language), {
            month: "long",
            year: "numeric",
        }).format(calendarMonth);

        return formatted.replace(/^./, chr => chr.toUpperCase());
    }, [calendarMonth, language]);

    const taskDateKeys = React.useMemo(() => {
        return new Set(tasks.map(task => formDate(task.date)));
    }, [tasks]);

    const calendarDays = React.useMemo(() => {
        const monthStart = startOfMonth(calendarMonth);
        const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
        const offset = (monthStart.getDay() - weekStartIndex + 7) % 7;
        const totalCells = Math.ceil((offset + monthEnd.getDate()) / 7) * 7;
        const today = new Date();

        return Array.from({ length: totalCells }, (_, index) => {
            const cellDate = new Date(monthStart);
            cellDate.setDate(monthStart.getDate() - offset + index);
            const dateKey = formDate(cellDate);

            return {
                date: cellDate,
                key: dateKey,
                inCurrentMonth: cellDate.getMonth() === calendarMonth.getMonth(),
                isToday: isSameDay(cellDate, today),
                hasTasks: taskDateKeys.has(dateKey),
            };
        });
    }, [calendarMonth, taskDateKeys, weekStartIndex]);

    function changeCalendarMonth(delta) {
        setCalendarMonth(prevMonth => new Date(prevMonth.getFullYear(), prevMonth.getMonth() + delta, 1));
    }

    function handleCalendarDaySelect(date) {
        const todayWeekStart = getStartOfWeek(new Date());
        const targetWeekStart = getStartOfWeek(date);
        const nextShift = Math.round((targetWeekStart - todayWeekStart) / (7 * 24 * 60 * 60 * 1000));

        setSearchParams(prevSearchParams => {
            const nextParams = new URLSearchParams(prevSearchParams);
            if (nextShift === 0) {
                nextParams.delete("weekShift");
            } else {
                nextParams.set("weekShift", String(nextShift));
            }
            return nextParams;
        });

        setCalendarMonth(startOfMonth(date));
        setIsCalendarOpen(false);
    }

    function openTaskFromSearch(task) {
        const taskDate = new Date(task.date);
        const todayWeekStart = getStartOfWeek(new Date());
        const taskWeekStart = getStartOfWeek(taskDate);
        const nextShift = Math.round((taskWeekStart - todayWeekStart) / (7 * 24 * 60 * 60 * 1000));

        setSearchParams(prev => {
            const nextParams = new URLSearchParams(prev);
            nextParams.set("weekShift", String(nextShift));
            nextParams.delete("openedTask");
            nextParams.set("task", toShortId(task.id));
            return nextParams;
        });

        setSelectedTask(task);
        setIsSearchOpen(false);
        setSearchQuery("");
    }

    function handleTaskMentionClick(ev) {
        const mentionLink = ev.target.closest?.("a[data-task-id]");
        if (!mentionLink) return;

        ev.preventDefault();
        ev.stopPropagation();

        const referencedTaskId = mentionLink.getAttribute("data-task-id");
        openReferencedTask(referencedTaskId);
    }

    const filteredSearchTasks = React.useMemo(() => {
        const query = normalizeSearchText(searchQuery);
        if (!query) return [];

        const queryTokens = query.split(/\s+/).filter(Boolean);

        return tasks
            .filter(task => {
                const relatedLinks = relatedLinksEnabled ? normalizeRelatedLinks(task) : [];
                const haystack = normalizeSearchText([
                    task.name,
                    task.description,
                    ...relatedLinks.map(link => link.name),
                    ...relatedLinks.map(link => link.url),
                ].join(" "));

                return queryTokens.every(token => haystack.includes(token));
            })
            .slice(0, 12);
    }, [searchQuery, tasks, relatedLinksEnabled]);

    const activeTaskDate = selectedTask?.date ? new Date(selectedTask.date) : null;
    const hasSelectedDescription = !!selectedTask?.description?.trim();
    const selectedRelatedLinks = selectedTask && relatedLinksEnabled ? normalizeRelatedLinks(selectedTask) : [];
    const hasSelectedRelatedLinks = selectedRelatedLinks.length > 0;
    const previewDateText = activeTaskDate
        ? new Intl.DateTimeFormat(getLocale(language), {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
        }).format(activeTaskDate).replaceAll(".", "")
        : t(language, "taskMenuDateFallback");

    if (loading || !minLoadingDone) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Lottie animationData={todoLoadingAnimation} loop style={{ width: 80, height: 80 }} />
            </div>
        );
    }

    if (!owner) {
        return (
            <div className="min-h-screen bg-white px-6 py-8 text-xl font-semibold text-black">
                {t(language, "publicAgendaUnavailable")}
            </div>
        );
    }

    const monthName = new Intl.DateTimeFormat(getLocale(language), { month: "long" }).format(shiftedDate);

    return (
        <div
            className="public-share-page min-w-screen min-h-screen bg-white text-black"
            style={{
                '--agenda-accent': agendaAccent,
                '--agenda-accent-soft': /^#([0-9a-fA-F]{6})$/.test(agendaAccent) ? `${agendaAccent}22` : 'rgba(59, 130, 246, 0.2)',
            }}
        >
            <header className="max-container max-lg:sticky max-lg:top-0 max-lg:z-50 flex items-center justify-between gap-6 bg-white px-6 py-4 max-lg:py-6 lg:px-6 lg:py-5">
                <div className="relative" ref={calendarRef}>
                    <button
                        type="button"
                        className="header-month-trigger text-[36px] font-bold leading-[42px] tracking-[-0.5px] capitalize text-black"
                        onClick={() => setIsCalendarOpen(prev => !prev)}
                        aria-label={t(language, "changeTaskDate")}
                        aria-expanded={isCalendarOpen}
                    >
                        <span>{monthName} {shiftedDate.getFullYear()}</span>
                    </button>

                    {isCalendarOpen && (
                        <div className="task-menu-calendar header-month-calendar" onClick={ev => ev.stopPropagation()}>
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
                                            dayItem.isToday ? "is-selected" : "",
                                            dayItem.hasTasks ? "has-tasks" : "",
                                        ].filter(Boolean).join(" ")}
                                        onClick={() => handleCalendarDaySelect(dayItem.date)}
                                    >
                                        {dayItem.date.getDate()}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#f2f2f2] text-sm font-semibold"
                        title={t(language, "publicAgendaBy")}
                    >
                        {isImageAvatar((agenda?.avatar || "").trim()) ? (
                            <img src={agenda.avatar} alt={agenda?.name || "Agenda"} className="h-full w-full object-cover" />
                        ) : (
                            (agenda?.name || owner.name || "U").trim().slice(0, 1).toUpperCase()
                        )}
                    </button>
                    <div className="relative group/public-search">
                        <button
                            type="button"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f2f2f2] text-black"
                            onClick={openSearchModal}
                            title={t(language, "search")}
                        >
                            <SearchMd className="h-[18px] w-[18px] lg:h-5 lg:w-5" />
                        </button>
                        <p className="pointer-events-none absolute left-1/2 top-[120%] -translate-x-[50%] whitespace-pre rounded tooltip-surface p-1 text-xs text-white opacity-0 transition ease-linear duration-200 group-hover/public-search:opacity-100">
                            {t(language, "search")}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="ml-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black text-white"
                        onClick={() => moveWeek(-1)}
                    >
                        <ChevronLeft className="h-4 w-4 lg:h-5 lg:w-5" />
                    </button>
                    <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black text-white"
                        onClick={() => moveWeek(1)}
                    >
                        <ChevronRight className="h-4 w-4 lg:h-5 lg:w-5" />
                    </button>
                </div>
            </header>

            <main className="w-full flex flex-col gap-[30px] px-6 pb-6 pt-4 lg:grid lg:grid-cols-6 lg:gap-6 lg:px-6 lg:pt-10">
                {dates.slice(0, 5).map((date, index) => {
                    const dateKey = formDate(date);
                    const dayText = new Intl.DateTimeFormat(getLocale(language), { weekday: "long" }).format(date);
                    const label = language === "ptBR"
                        ? dayText.replace("-feira", "").replace(/^./, c => c.toUpperCase())
                        : dayText;
                    const active = formDate(new Date()) === dateKey;

                    return (
                        <div className="public-day-block min-w-0 flex flex-col" key={`${dateKey}-${index}`}>
                            <div className={`flex items-center justify-between border-b-2 py-3 ${active ? "agenda-accent-border" : "border-black"}`} style={active ? { borderColor: agendaAccent } : undefined}>
                                <h2 className={`public-date-label tracking-[-0.5px] ${active ? "agenda-accent-text" : "text-black"}`} style={active ? { color: agendaAccent } : undefined}>
                                    {formatDayMonth(date, language, dateFormat)}
                                </h2>
                                <h3 className={`public-weekday-label tracking-[-0.5px] ${active ? "agenda-accent-text opacity-50" : "text-black opacity-20"}`} style={active ? { color: agendaAccent } : undefined}>
                                    {label}
                                </h3>
                            </div>

                            {tasksData[dateKey].map(task => (
                                <button
                                    type="button"
                                    className="group agenda-accent-hover-border task-item-row task-row-border w-full border-b text-left transition-colors duration-150"
                                    key={task.id}
                                    onClick={() => openTaskPreview(task)}
                                >
                                    <div className="task flex h-[41px] items-center justify-between px-0">
                                        {renderPublicTaskTitle(task, relatedLinksEnabled ? normalizeRelatedLinks(task).length : 0, publicTaskTitleMaxLength)}
                                    </div>
                                </button>
                            ))}

                            {/* Apenas 1 linha vazia por dia no mobile, 10 no desktop */}
                            {(() => {
                                const isMobile = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 1023px)").matches;
                                const emptyRows = isMobile ? Math.max(0, 1 - tasksData[dateKey].length) : Math.max(0, 10 - tasksData[dateKey].length);
                                    return Array.from({ length: emptyRows }).map((_, emptyIndex) => (
                                        <div className="task-row-border h-[41px] w-full border-b" key={`empty-${dateKey}-${emptyIndex}`} />
                                    ));
                                })()}
                        </div>
                    );
                })}

                <div className="min-w-0 flex flex-col gap-[30px]">
                    {dates.slice(5).map((date, index) => {
                        const dateKey = formDate(date);
                        const dayText = new Intl.DateTimeFormat(getLocale(language), { weekday: "long" }).format(date);
                        const label = language === "ptBR"
                            ? dayText.replace("-feira", "").replace(/^./, c => c.toUpperCase())
                            : dayText;
                        const active = formDate(new Date()) === dateKey;

                        return (
                            <div className="public-day-block min-w-0 flex flex-1 flex-col" key={`${dateKey}-${index + 5}`}>
                            <div className={`flex items-center justify-between border-b-2 py-3 ${active ? "agenda-accent-border" : "border-black"}`} style={active ? { borderColor: agendaAccent } : undefined}>
                                <h2 className={`public-date-label tracking-[-0.5px] ${active ? "agenda-accent-text" : "text-black"}`} style={active ? { color: agendaAccent } : undefined}>
                                    {formatDayMonth(date, language, dateFormat)}
                                </h2>
                                <h3 className={`public-weekday-label tracking-[-0.5px] ${active ? "agenda-accent-text opacity-50" : "text-black opacity-20"}`} style={active ? { color: agendaAccent } : undefined}>
                                    {label}
                                </h3>
                            </div>

                            {tasksData[dateKey].map(task => (
                                <button
                                    type="button"
                                    className="group agenda-accent-hover-border task-item-row task-row-border w-full border-b text-left transition-colors duration-150"
                                    key={task.id}
                                    onClick={() => openTaskPreview(task)}
                                >
                                    <div className="task flex h-[41px] items-center justify-between px-0">
                                        {renderPublicTaskTitle(task, relatedLinksEnabled ? normalizeRelatedLinks(task).length : 0, publicTaskTitleMaxLength)}
                                    </div>
                                </button>
                            ))}

                            {/* Apenas 1 linha vazia por dia no mobile, 4 no desktop */}
                                {(() => {
                                    const isMobile = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 1023px)").matches;
                                    const emptyRows = isMobile ? Math.max(0, 1 - tasksData[dateKey].length) : Math.max(0, 4 - tasksData[dateKey].length);
                                        return Array.from({ length: emptyRows }).map((_, emptyIndex) => (
                                            <div className="task-row-border h-[41px] w-full border-b" key={`empty-tail-${dateKey}-${emptyIndex}`} />
                                        ));
                                    })()}
                            </div>
                        );
                    })}
                </div>
            </main>

            {shouldShowBoard && (
                <section className="w-full px-6 pb-6 lg:pb-10">
                    <div className="grid grid-cols-4 gap-6">
                        {publicBoardColumns.map((column, index) => {
                            const columnTasks = getBoardColumnTasks(column.id);
                            const isColumnBlankTitle = !(column.title || "").trim();

                            return (
                                <div className="min-w-0 flex flex-col" key={column.id}>
                                    <div className={`flex items-start justify-between border-b-2 py-3 ${index === 0 && isColumnBlankTitle ? "opacity-40" : ""}`}>
                                        <h2 className={`public-date-label min-w-0 tracking-[-0.5px] ${isColumnBlankTitle ? "opacity-30" : "text-black"}`}>
                                            {column.title || ""}
                                        </h2>
                                        <h3 className="public-weekday-label text-black opacity-20">{""}</h3>
                                    </div>

                                    {columnTasks.map(task => (
                                        <button
                                            type="button"
                                    className="group agenda-accent-hover-border task-item-row task-row-border w-full border-b text-left transition-colors duration-150"
                                            key={task.id}
                                            onClick={() => openTaskPreview(task)}
                                        >
                                            <div className="task flex h-[41px] items-center justify-between px-0">
                                                {renderPublicTaskTitle(task, relatedLinksEnabled ? normalizeRelatedLinks(task).length : 0, 54)}
                                            </div>
                                        </button>
                                    ))}

                                    {(() => {
                                        const isMobile = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 1023px)").matches;
                                        const emptyRows = isMobile ? Math.max(0, 1 - columnTasks.length) : Math.max(0, 7 - columnTasks.length);
                                        return Array.from({ length: emptyRows }).map((_, emptyIndex) => (
                                            <div className="task-row-border h-[41px] w-full border-b" key={`board-empty-${column.id}-${emptyIndex}`} />
                                        ));
                                    })()}
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {isTaskPreviewOpen && selectedTask && (
                <div
                    className={`fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto overscroll-contain px-4 pb-10 pt-16 transition-opacity duration-[160ms] ${isTaskPreviewVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}
                    style={{
                        backgroundColor: "rgba(5, 5, 5, 0.2)",
                        backdropFilter: "blur(2px)",
                        WebkitBackdropFilter: "blur(2px)",
                    }}
                    onClick={closeTaskPreview}
                >
                    <div
                        className={`task-menu task-menu-panel relative z-[80] mb-20 w-[32rem] max-w-full rounded-[28px] bg-[rgb(250,250,252)] px-6 py-7 text-gray-700 shadow-lg transition-all duration-[160ms] ease-in ${isTaskPreviewVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
                        onClick={ev => ev.stopPropagation()}
                    >
                        <div className="mb-6 flex w-full items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-black">
                                <Calendar className="h-4 w-4" />
                                <p>{previewDateText}</p>
                            </div>
                            <div className="relative group/public-close">
                                <button
                                    type="button"
                                    onClick={closeTaskPreview}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-black transition-colors duration-150 hover:bg-[rgba(237,237,242,1)]"
                                    aria-label="Fechar"
                                    title="Fechar"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                                <p className="absolute left-1/2 top-[120%] -translate-x-[50%] whitespace-pre rounded tooltip-surface p-1 text-xs text-white opacity-0 transition ease-linear duration-200 group-hover/public-close:opacity-100">
                                    Fechar
                                </p>
                            </div>
                        </div>

                        <h3 className={`task-menu-title w-full border-b border-[rgba(0,0,0,0.15)] pb-4 pr-10 text-[24px] leading-[1.3] text-black ${selectedTask.done ? "text-black/40" : ""}`}>
                            {selectedTask.name}
                        </h3>

                        {hasSelectedDescription && (
                            <div
                                className="task-menu-editor mt-5"
                                onClick={handleTaskMentionClick}
                                dangerouslySetInnerHTML={{ __html: renderPublicDescription(selectedTask.description || "") }}
                            />
                        )}

                        {hasSelectedRelatedLinks && (
                            <section className={`pt-4 ${hasSelectedDescription ? "mt-5 border-t border-[rgba(0,0,0,0.15)]" : "mt-3"}`}>
                                <h4 className="text-sm font-semibold text-black">{t(language, "relatedLinks")}</h4>
                                <ul className="mt-4 max-h-32 space-y-2 overflow-auto pr-1">
                                    {selectedRelatedLinks.map((link, index) => (
                                        <li key={`${index}-${link.url}-${link.name}`} className="rounded-[14px] bg-[rgba(237,237,242,1)] px-4 py-3">
                                            <a
                                                href={normalizeLinkUrl(link.url)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex min-w-0 items-center justify-between gap-2"
                                                title={normalizeLinkUrl(link.url)}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium text-black">{link.name || normalizeLinkUrl(link.url)}</p>
                                                    <p className="truncate text-xs text-[#6b7280]">{link.url}</p>
                                                </div>
                                                <LinkExternal01 className="h-4 w-4 shrink-0 text-[#6b7280]" />
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </div>
                </div>
            )}

            {isSearchOpen && (
                <div
                    className={`fixed inset-0 z-[70] flex items-start justify-center px-4 pb-10 pt-16 transition-opacity duration-[160ms] ${isSearchVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}
                    style={{
                        backgroundColor: "rgba(5, 5, 5, 0.2)",
                        backdropFilter: "blur(2px)",
                        WebkitBackdropFilter: "blur(2px)",
                    }}
                    onClick={closeSearchModal}
                >
                    <div
                        className={`search-form relative z-[80] w-[28rem] rounded-xl bg-[rgb(250,250,252)] p-4 text-gray-600 transition-all duration-[160ms] ease-in lg:p-8 ${isSearchVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
                        onClick={ev => ev.stopPropagation()}
                    >
                        <h3 className="text-xl font-bold tracking-tight text-black">{t(language, "search")}</h3>

                        <div className="relative">
                            <input
                                className="my-6 w-full border-b py-1 focus:outline-none bg-transparent"
                                type="text"
                                autoFocus
                                value={searchQuery}
                                onChange={ev => setSearchQuery(ev.target.value)}
                                style={{ borderBottomColor: "rgba(0,0,0,0.15)" }}
                            />

                            <button
                                type="button"
                                className={`absolute right-2 top-10 -translate-y-[50%] ${searchQuery ? "" : "hidden"}`}
                                onClick={() => setSearchQuery("")}
                            >
                                <XCircle className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="search-results">
                            {filteredSearchTasks.map(task => (
                                <button
                                    key={task.id}
                                    type="button"
                                    className="group w-full border-b border-gray-300 text-left"
                                    onClick={() => openTaskFromSearch(task)}
                                >
                                    <div className="task flex h-[41px] items-center justify-between px-0">
                                        {renderPublicTaskTitle(task, relatedLinksEnabled ? normalizeRelatedLinks(task).length : 0, publicTaskTitleMaxLength)}
                                        <p className="ml-4 shrink-0 text-gray-400">{formatDayMonth(new Date(task.date), language, dateFormat)}</p>
                                    </div>
                                </button>
                            ))}

                            {!!searchQuery.trim() && filteredSearchTasks.length === 0 && (
                                <p className="py-2 text-sm text-gray-400">
                                    {language === "ptBR" ? "Nenhuma tarefa encontrada." : "No tasks found."}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
