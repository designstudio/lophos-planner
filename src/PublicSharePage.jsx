import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, X, Calendar, StickerSquare, LinkExternal01, SearchMd, XCircle, Attachment02, Umbrella03, CheckSquareBroken } from "@untitledui/icons";
import { getPublicAgendaByShareToken } from "./scripts/api.js";
import { getCountryCodeForLanguage, getHolidaysByYears } from "./scripts/holidays.js";
import { formatDayMonth, formatTaskDetailDate, getLocale, t } from "./scripts/i18n.js";
import { setPageScrollLocked } from "./scripts/utils.js";
import { formDate, matchesShortId, toShortId } from "./scripts/utils.js";
import useIsMobileViewport from "./hooks/useIsMobileViewport.js";
import { hasTaskNoteContent, normalizeTaskNote } from "./scripts/taskNotes.js";
import { renderTaskMarkdown } from "./scripts/taskMarkdown.js";
import BrandedLoadingIndicator from "./components/BrandedLoadingIndicator.jsx";

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

function MeetingIcon(props) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M13 3.5V6.2C13 7.88016 13 8.72024 13.327 9.36197C13.6146 9.92646 14.0735 10.3854 14.638 10.673C15.2798 11 16.1198 11 17.8 11H20.5M21 12.9882V16.2C21 17.8802 21 18.7202 20.673 19.362C20.3854 19.9265 19.9265 20.3854 19.362 20.673C18.7202 21 17.8802 21 16.2 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V7.8C3 6.11984 3 5.27976 3.32698 4.63803C3.6146 4.07354 4.07354 3.6146 4.63803 3.32698C5.27976 3 6.11984 3 7.8 3H11.0118C11.7455 3 12.1124 3 12.4577 3.08289C12.7638 3.15638 13.0564 3.27759 13.3249 3.44208C13.6276 3.6276 13.887 3.88703 14.4059 4.40589L19.5941 9.59411C20.113 10.113 20.3724 10.3724 20.5579 10.6751C20.7224 10.9436 20.8436 11.2362 20.9171 11.5423C21 11.8876 21 12.2545 21 12.9882Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 16H7M11 12H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function renderPublicTaskTitle(task, relatedLinkCount, maxLength = 34) {
    const taskName = task.name || "";
    const isTruncated = taskName.length > maxLength;
    const visibleTaskName = taskName.slice(0, maxLength) + (isTruncated ? "..." : "");

    return (
        <div className={`relative min-w-0 flex-1 ${isTruncated ? "group/task-title" : ""}`}>
            <h5 className={`public-task-title min-w-0 flex items-center gap-1 text-ds-text-default ${task.done ? "opacity-40 line-through" : ""}`}>
                {hasTaskNoteContent(task) && <StickerSquare className="h-4 w-4 shrink-0" />}
                {relatedLinkCount > 0 && <Attachment02 className="h-4 w-4 shrink-0" />}
                <span className="block min-w-0 truncate">{visibleTaskName}</span>
            </h5>
            {isTruncated && (
                <p className="pointer-events-none absolute bottom-[120%] left-1/2 z-20 w-max max-w-[16rem] -translate-x-[50%] rounded-ds-sm tooltip-surface p-2 text-left ds-type-caption text-ds-text-inverse opacity-0 transition-opacity delay-0 duration-150 ease-linear whitespace-normal break-words group-hover/task-title:opacity-100 group-hover/task-title:delay-[700ms]">
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
const PUBLIC_REFRESH_INTERVAL_MS = 30000;
const PUBLIC_FETCH_TIMEOUT_MS = 10000;

function withTimeout(promise, timeoutMs) {
    return new Promise((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
            reject(new Error("Public share request timed out."));
        }, timeoutMs);

        promise
            .then(value => {
                clearTimeout(timeoutId);
                resolve(value);
            })
            .catch(error => {
                clearTimeout(timeoutId);
                reject(error);
            });
    });
}

function PublicTaskNoteContent({ task, className = "", onTaskMentionClick }) {
    const note = React.useMemo(() => normalizeTaskNote(task), [task]);
    const html = React.useMemo(() => renderTaskMarkdown(note.markdown || ""), [note.markdown]);

    const handleClickCapture = React.useCallback(event => {
        if (!onTaskMentionClick) return;

        const eventTarget = event.target;
        if (!(eventTarget instanceof Element)) return;

        const mentionLink = eventTarget.closest('a[href^="#task:"]');
        if (!mentionLink) return;

        const href = mentionLink.getAttribute("href") || "";
        const taskId = href.replace(/^#task:/, "").trim();
        if (!taskId) return;

        event.preventDefault();
        event.stopPropagation();
        onTaskMentionClick(taskId);
    }, [onTaskMentionClick]);

    return (
        <div
            className={className}
            data-note-format="legacy-markdown"
            data-note-read-only="true"
            onClickCapture={handleClickCapture}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

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
    const [holidayNamesByDate, setHolidayNamesByDate] = React.useState(() => ({}));
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

    const isMobile = useIsMobileViewport();

    React.useEffect(() => {
        let mounted = true;
        let intervalId = null;

        async function refreshPublicAgenda(showLoading = false) {
            if (showLoading) {
                setLoading(true);
            }

            try {
                const data = await withTimeout(
                    getPublicAgendaByShareToken(shareToken),
                    PUBLIC_FETCH_TIMEOUT_MS
                );
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

        function startPolling() {
            if (intervalId !== null || document.visibilityState !== "visible") return;

            intervalId = window.setInterval(() => {
                refreshPublicAgenda(false);
            }, PUBLIC_REFRESH_INTERVAL_MS);
        }

        function stopPolling() {
            if (intervalId === null) return;
            clearInterval(intervalId);
            intervalId = null;
        }

        refreshPublicAgenda(true);
        startPolling();

        function handleVisibilityChange() {
            if (document.visibilityState !== "visible") {
                stopPolling();
                return;
            }

            refreshPublicAgenda(false);
            startPolling();
        }

        function handleWindowFocus() {
            refreshPublicAgenda(false);
            startPolling();
        }

        window.addEventListener("focus", handleWindowFocus);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            mounted = false;
            stopPolling();
            window.removeEventListener("focus", handleWindowFocus);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [shareToken]);

    React.useEffect(() => {
        setPageScrollLocked(isTaskPreviewOpen || isSearchOpen || isCalendarOpen);
        return () => setPageScrollLocked(false);
    }, [isTaskPreviewOpen, isSearchOpen, isCalendarOpen]);

    React.useEffect(() => {
        const baseTitle = "Lophos Planner";
        const agendaName = (agenda?.name || "").trim();
        document.title = agendaName ? `${agendaName} - ${baseTitle}` : baseTitle;
    }, [agenda?.name]);

    const language = owner?.language || "ptBR";
    const dateFormat = owner?.dateFormat || "DD-MM";
    const weekStartsOn = owner?.weekStartsOn || "Monday";
    const agendaAccent = agenda?.color || "var(--color-brand-accent)";
    const relatedLinksEnabled = agenda?.related_links_enabled ?? true;
    const holidaysEnabled = agenda?.holidays_enabled ?? true;
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
        if (isCalendarOpen) return;
        setCalendarMonth(startOfMonth(shiftedDate));
    }, [isCalendarOpen, shiftedDate]);

    React.useEffect(() => {
        let isCancelled = false;

        const month = calendarMonth.getMonth();
        const year = calendarMonth.getFullYear();
        const years = [year];
        if (month === 0) years.push(year - 1);
        if (month === 11) years.push(year + 1);

        async function loadHolidays() {
            if (!holidaysEnabled) {
                setHolidayNamesByDate({});
                return;
            }

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
    }, [calendarMonth, holidaysEnabled, language]);

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

    const monthLabel = React.useMemo(() => {
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
        const dayCount = monthEnd.getDate();
        const today = new Date();

        return Array.from({ length: dayCount }, (_, index) => {
            const cellDate = new Date(monthStart);
            cellDate.setDate(monthStart.getDate() + index);
            const dateKey = formDate(cellDate);

            return {
                date: cellDate,
                key: dateKey,
                inCurrentMonth: true,
                isToday: isSameDay(cellDate, today),
                hasTasks: taskDateKeys.has(dateKey),
                isWeekend: [0, 6].includes(cellDate.getDay()),
                holidayName: holidayNamesByDate[dateKey] || "",
            };
        });
    }, [calendarMonth, holidayNamesByDate, taskDateKeys]);

    const calendarWeeks = React.useMemo(() => {
        const weeks = [];
        const monthStartDay = startOfMonth(calendarMonth).getDay();
        const startingOffset = (monthStartDay - weekStartIndex + 7) % 7;
        const trailingOffset = (7 - ((startingOffset + calendarDays.length) % 7)) % 7;
        const paddedDays = Array.from({ length: startingOffset }, () => null)
            .concat(calendarDays)
            .concat(Array.from({ length: trailingOffset }, () => null));

        for (let index = 0; index < paddedDays.length; index += 7) {
            weeks.push(paddedDays.slice(index, index + 7));
        }

        return weeks;
    }, [calendarDays, calendarMonth, weekStartIndex]);

    const calendarTasksByDate = React.useMemo(() => {
        const nextMap = {};

        tasks.forEach(task => {
            if (!task?.date || task?.is_board_task) return;
            const taskDate = new Date(task.date);
            if (
                taskDate.getMonth() !== calendarMonth.getMonth()
                || taskDate.getFullYear() !== calendarMonth.getFullYear()
            ) {
                return;
            }

            const dateKey = formDate(taskDate);
            if (!nextMap[dateKey]) nextMap[dateKey] = [];
            nextMap[dateKey].push(task);
        });

        Object.values(nextMap).forEach(dayTasks => {
            dayTasks.sort((a, b) => {
                const orderA = Number(a.order) || 0;
                const orderB = Number(b.order) || 0;
                if (orderA !== orderB) return orderA - orderB;
                return String(a.name || "").localeCompare(String(b.name || ""));
            });
        });

        return nextMap;
    }, [calendarMonth, tasks]);

    function getTaskChipClassName(task) {
        const color = (task?.color || "").toString();
        if (color.includes("amber-500")) return "bg-ds-warning-solid text-ds-text-on-accent";
        if (color.includes("green-500")) return "bg-ds-success-solid text-ds-text-inverse";
        if (color.includes("red-500")) return "bg-ds-danger-solid text-ds-text-inverse";
        return "bg-ds-background-surface-muted text-ds-text-default";
    }

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

    const filteredSearchTasks = React.useMemo(() => {
        const query = normalizeSearchText(searchQuery);
        if (!query) return [];

        const queryTokens = query.split(/\s+/).filter(Boolean);

        return tasks
            .filter(task => {
                const relatedLinks = relatedLinksEnabled ? normalizeRelatedLinks(task) : [];
                const note = normalizeTaskNote(task);
                const haystack = normalizeSearchText([
                    task.name,
                    note.plainText || note.markdown,
                    ...relatedLinks.map(link => link.name),
                    ...relatedLinks.map(link => link.url),
                ].join(" "));

                return queryTokens.every(token => haystack.includes(token));
            })
            .slice(0, 12);
    }, [searchQuery, tasks, relatedLinksEnabled]);

    const activeTaskDate = selectedTask?.date ? new Date(selectedTask.date) : null;
    const hasSelectedDescription = hasTaskNoteContent(selectedTask);
    const selectedRelatedLinks = selectedTask && relatedLinksEnabled ? normalizeRelatedLinks(selectedTask) : [];
    const hasSelectedRelatedLinks = selectedRelatedLinks.length > 0;
    const previewDateText = formatTaskDetailDate(activeTaskDate, language);
    const selectedTaskType = selectedTask?.task_type === "meeting" ? "meeting" : "task";
    const SelectedTaskTypeIcon = selectedTaskType === "meeting" ? MeetingIcon : CheckSquareBroken;

    if (loading || !minLoadingDone) {
        return (
            <div className="min-h-screen bg-white dark:bg-ds-background-page flex items-center justify-center">
                <BrandedLoadingIndicator size={80} />
            </div>
        );
    }

    if (!owner) {
        return (
            <div className="min-h-screen bg-white px-6 py-8 ds-type-h4 text-ds-text-default dark:bg-ds-background-page">
                {t(language, "publicAgendaUnavailable")}
            </div>
        );
    }

    const monthName = new Intl.DateTimeFormat(getLocale(language), { month: "long" }).format(shiftedDate);

    return (
        <div
            className="public-share-page min-w-screen min-h-screen bg-white text-ds-text-default dark:bg-ds-background-page"
            style={{
                '--agenda-accent': agendaAccent,
                '--agenda-accent-soft': /^#([0-9a-fA-F]{6})$/.test(agendaAccent) ? `${agendaAccent}22` : 'var(--color-brand-accent-subtle)',
            }}
        >
            <header className="max-container max-lg:sticky max-lg:top-0 max-lg:z-50 flex items-center justify-between gap-6 bg-white px-6 py-4 pb-3 max-lg:py-6 max-lg:pb-3 lg:px-6 lg:py-5 lg:pb-3 dark:bg-ds-background-page">
                <div className="relative">
                    <button
                        type="button"
                        className="header-month-trigger ds-type-h1 capitalize text-ds-text-default"
                        onClick={() => setIsCalendarOpen(prev => !prev)}
                        aria-label={t(language, "changeTaskDate")}
                        aria-expanded={isCalendarOpen}
                    >
                        <span>{monthName} {shiftedDate.getFullYear()}</span>
                    </button>

                    <div className={`calendar-overview-modal ${isCalendarOpen ? "active" : ""}`}>
                        <div
                            className="calendar-overview-blur"
                            onClick={() => setIsCalendarOpen(false)}
                        />
                        <div className="calendar-overview-scroll">
                            <div
                                className="header-month-overview-shell"
                                onClick={ev => ev.stopPropagation()}
                            >
                                <div className="header-month-overview-drawer">
                                    <div className="header-month-overview-hero">
                                        <button
                                            type="button"
                                            className="header-month-overview-month-title"
                                            onClick={() => setIsCalendarOpen(false)}
                                        >
                                            {monthLabel}
                                        </button>
                                        <div className="header-month-overview-controls">
                                            <button
                                                type="button"
                                                className="task-menu-calendar-nav"
                                                onClick={() => changeCalendarMonth(-1)}
                                                aria-label={t(language, "previousMonth")}
                                            >
                                                <ChevronLeft className="h-5 w-5" />
                                            </button>
                                            <button
                                                type="button"
                                                className="task-menu-calendar-nav"
                                                onClick={() => changeCalendarMonth(1)}
                                                aria-label={t(language, "nextMonth")}
                                            >
                                                <ChevronRight className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="header-month-overview-body">
                                        <div className="task-menu-calendar-weekdays header-month-overview-weekdays">
                                            {weekdayLabels.map((label, index) => (
                                                <span key={`${label}-${index}`}>{label}</span>
                                            ))}
                                        </div>
                                        <div className="header-month-overview-grid">
                                            {calendarWeeks.map((week, weekIndex) => (
                                                <div key={`${week[0]?.key || weekIndex}`} className="header-month-overview-week">
                                                    {week.map((dayItem, dayIndex) => (
                                                        dayItem ? (
                                                            <button
                                                                key={dayItem.key}
                                                                type="button"
                                                                className={[
                                                                    "header-month-overview-day",
                                                                    dayItem.inCurrentMonth ? "" : "is-outside-month",
                                                                    dayItem.isToday ? "is-selected" : "",
                                                                    dayItem.isWeekend ? "is-weekend" : "",
                                                                    dayItem.holidayName ? "has-holiday" : "",
                                                                ].filter(Boolean).join(" ")}
                                                                onClick={() => handleCalendarDaySelect(dayItem.date)}
                                                            >
                                                                <span className="header-month-overview-day-number">
                                                                    {dayItem.date.getDate()}
                                                                </span>
                                                                <div className="header-month-overview-day-chips">
                                                                    {dayItem.holidayName && (
                                                                        <span className="relative inline-flex max-w-full group/public-holiday-chip">
                                                                            <span className="header-month-overview-holiday-chip">
                                                                                {t(language, "holidayLabel")} - {dayItem.holidayName}
                                                                            </span>
                                                                            <p className="pointer-events-none absolute bottom-[120%] left-1/2 z-20 w-max max-w-[16rem] -translate-x-1/2 rounded-ds-sm tooltip-surface p-2 text-left ds-type-caption opacity-0 transition-opacity delay-0 duration-150 ease-linear whitespace-normal break-words group-hover/public-holiday-chip:opacity-100 group-hover/public-holiday-chip:delay-[700ms]">
                                                                                {dayItem.holidayName}
                                                                            </p>
                                                                        </span>
                                                                    )}
                                                                    {(calendarTasksByDate[dayItem.key] || []).slice(0, 4).map(task => (
                                                                        <span key={task.id} className="relative inline-flex max-w-full group/public-task-chip">
                                                                            <span
                                                                                className={`header-month-overview-task-chip ${getTaskChipClassName(task)} ${task?.done ? "opacity-50 line-through" : ""}`}
                                                                            >
                                                                                {task.name}
                                                                            </span>
                                                                            <p className="pointer-events-none absolute bottom-[120%] left-1/2 z-20 w-max max-w-[16rem] -translate-x-1/2 rounded-ds-sm tooltip-surface p-2 text-left ds-type-caption opacity-0 transition-opacity delay-0 duration-150 ease-linear whitespace-normal break-words group-hover/public-task-chip:opacity-100 group-hover/public-task-chip:delay-[700ms]">
                                                                                {task.name}
                                                                            </p>
                                                                        </span>
                                                                    ))}
                                                                    {(calendarTasksByDate[dayItem.key] || []).length > 4 && (
                                                                        <span className="header-month-overview-more">
                                                                            {`+${(calendarTasksByDate[dayItem.key] || []).length - 4} ${t(language, ((calendarTasksByDate[dayItem.key] || []).length - 4) === 1 ? "moreTaskSingular" : "moreTaskPlural")}`}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </button>
                                                        ) : (
                                                            <div key={`empty-${weekIndex}-${dayIndex}`} className="header-month-overview-empty" aria-hidden="true" />
                                                        )
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex h-10 items-center gap-2">
                    <div className="relative flex h-10 items-center group/public-agenda-avatar">
                        <button
                            type="button"
                            className="app-button-hover header-menu-btn relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-ds-full bg-ds-background-surface-muted ds-type-body-sm font-semibold"
                            aria-label={t(language, "publicAgendaBy")}
                        >
                            {isImageAvatar((agenda?.avatar || "").trim()) ? (
                                <img src={agenda.avatar} alt={agenda?.name || "Agenda"} className="h-full w-full object-cover" />
                            ) : (
                                (agenda?.name || owner.name || "U").trim().slice(0, 1).toUpperCase()
                            )}
                        </button>
                        <p className="pointer-events-none absolute left-1/2 top-[120%] -translate-x-[50%] whitespace-pre rounded-ds-sm tooltip-surface p-1 ds-type-caption text-ds-text-inverse opacity-0 transition ease-linear duration-200 group-hover/public-agenda-avatar:opacity-100">
                            {t(language, "publicAgendaBy")}
                        </p>
                    </div>
                    <div className="relative flex h-10 items-center group/public-search">
                        <button
                            type="button"
                            className="app-button-hover header-menu-btn inline-flex h-10 w-10 items-center justify-center rounded-ds-full bg-ds-background-surface-muted text-ds-text-default"
                            style={{ backgroundColor: "var(--color-bg-surface-muted)" }}
                            onClick={openSearchModal}
                            aria-label={t(language, "search")}
                        >
                            <SearchMd className="h-5 w-5" />
                        </button>
                        <p className="pointer-events-none absolute left-1/2 top-[120%] -translate-x-[50%] whitespace-pre rounded-ds-sm tooltip-surface p-1 ds-type-caption text-ds-text-inverse opacity-0 transition ease-linear duration-200 group-hover/public-search:opacity-100">
                            {t(language, "search")}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="app-button-hover header-menu-btn ml-4 inline-flex h-10 w-10 items-center justify-center rounded-ds-full bg-ds-text-default text-ds-text-inverse dark:bg-ds-background-surface-muted dark:text-ds-text-default"
                        onClick={() => moveWeek(-1)}
                    >
                        <ChevronLeft className="h-4 w-4 lg:h-5 lg:w-5" />
                    </button>
                    <button
                        type="button"
                        className="app-button-hover header-menu-btn inline-flex h-10 w-10 items-center justify-center rounded-ds-full bg-ds-text-default text-ds-text-inverse dark:bg-ds-background-surface-muted dark:text-ds-text-default"
                        onClick={() => moveWeek(1)}
                    >
                        <ChevronRight className="h-4 w-4 lg:h-5 lg:w-5" />
                    </button>
                </div>
            </header>

            <main className="w-full flex flex-col gap-[30px] px-6 pb-6 pt-4 lg:grid lg:grid-cols-6 lg:gap-6 lg:px-6 lg:pt-10">
                {dates.slice(0, 5).map((date, index) => {
                    const dateKey = formDate(date);
                    const holidayName = holidayNamesByDate[dateKey] || "";
                    const dayText = new Intl.DateTimeFormat(getLocale(language), { weekday: "long" }).format(date);
                    const label = language === "ptBR"
                        ? dayText.replace("-feira", "").replace(/^./, c => c.toUpperCase())
                        : dayText;
                    const active = formDate(new Date()) === dateKey;

                    return (
                        <div className="public-day-block min-w-0 flex flex-col" key={`${dateKey}-${index}`}>
                            <div className={`flex items-center justify-between border-b-2 py-3 ${active ? "agenda-accent-border" : "border-ds-text-default"}`} style={active ? { borderColor: agendaAccent } : undefined}>
                                <h2 className={`public-date-label ${active ? "agenda-accent-text" : "text-ds-text-default"}`} style={active ? { color: agendaAccent } : undefined}>
                                    {formatDayMonth(date, language, dateFormat)}
                                </h2>
                                <h3 className={`public-weekday-label ${active ? "agenda-accent-text opacity-50" : "text-ds-text-default opacity-20"}`} style={active ? { color: agendaAccent } : undefined}>
                                    {label}
                                </h3>
                            </div>

                            {holidaysEnabled && holidayName && (
                                <div className="task-row-border h-[41px] w-full border-b bg-transparent">
                                    <p className="task-holiday-item">
                                        <span className="task-holiday-badge gap-1">
                                            <Umbrella03 className="h-4 w-4 shrink-0" />
                                            <span>{t(language, "holidayLabel")} - {holidayName}</span>
                                        </span>
                                    </p>
                                </div>
                            )}

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
                        const holidayName = holidayNamesByDate[dateKey] || "";
                        const dayText = new Intl.DateTimeFormat(getLocale(language), { weekday: "long" }).format(date);
                        const label = language === "ptBR"
                            ? dayText.replace("-feira", "").replace(/^./, c => c.toUpperCase())
                            : dayText;
                        const active = formDate(new Date()) === dateKey;

                        return (
                            <div className="public-day-block min-w-0 flex flex-1 flex-col" key={`${dateKey}-${index + 5}`}>
                            <div className={`flex items-center justify-between border-b-2 py-3 ${active ? "agenda-accent-border" : "border-ds-text-default"}`} style={active ? { borderColor: agendaAccent } : undefined}>
                                <h2 className={`public-date-label ${active ? "agenda-accent-text" : "text-ds-text-default"}`} style={active ? { color: agendaAccent } : undefined}>
                                    {formatDayMonth(date, language, dateFormat)}
                                </h2>
                                <h3 className={`public-weekday-label ${active ? "agenda-accent-text opacity-50" : "text-ds-text-default opacity-20"}`} style={active ? { color: agendaAccent } : undefined}>
                                    {label}
                                </h3>
                            </div>

                            {holidaysEnabled && holidayName && (
                                <div className="task-row-border h-[41px] w-full border-b bg-transparent">
                                    <p className="task-holiday-item">
                                        <span className="task-holiday-badge gap-1">
                                            <Umbrella03 className="h-4 w-4 shrink-0" />
                                            <span>{t(language, "holidayLabel")} - {holidayName}</span>
                                        </span>
                                    </p>
                                </div>
                            )}

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
                    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-4">
                        {publicBoardColumns.map((column, index) => {
                            const columnTasks = getBoardColumnTasks(column.id);
                            const isColumnBlankTitle = !(column.title || "").trim();

                            return (
                                <div className="min-w-0 flex flex-col" key={column.id}>
                                    <div className={`flex items-start justify-between border-b-2 py-3 ${index === 0 && isColumnBlankTitle ? "opacity-40" : ""}`}>
                                        <h2 className={`public-date-label min-w-0 ${isColumnBlankTitle ? "opacity-30" : "text-ds-text-default"}`}>
                                            {column.title || ""}
                                        </h2>
                                        <h3 className="public-weekday-label text-ds-text-default opacity-20">{""}</h3>
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
                        backgroundColor: "var(--color-overlay-scrim)",
                        backdropFilter: "blur(2px)",
                        WebkitBackdropFilter: "blur(2px)",
                    }}
                    onClick={closeTaskPreview}
                >
                    <div
                        className={`task-menu task-menu-panel ds-modal-shell relative z-[80] mb-6 w-[32rem] max-w-full overflow-x-hidden px-6 py-6 text-ds-text-muted transition-all duration-[160ms] ease-in ${isTaskPreviewVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
                        onClick={ev => ev.stopPropagation()}
                    >
                        <div className="task-menu-header">
                            <div className="task-menu-header-meta">
                                <div className="task-menu-date-trigger">
                                    <Calendar className="h-4 w-4 shrink-0" />
                                    <p>{previewDateText}</p>
                                </div>
                                <div className="task-menu-type-trigger">
                                    <span className="inline-flex min-w-0 items-center gap-2">
                                        <SelectedTaskTypeIcon className="h-4 w-4 shrink-0" />
                                        <span>{selectedTaskType === "meeting" ? t(language, "taskTypeMeeting") : t(language, "taskTypeTask")}</span>
                                    </span>
                                </div>
                            </div>
                            <div className="relative group/public-close">
                                <button
                                    type="button"
                                    onClick={closeTaskPreview}
                                    className="app-button-hover inline-flex h-8 w-8 items-center justify-center rounded-ds-full text-ds-text-default transition-colors duration-150 hover:bg-ds-background-surface-muted"
                                    aria-label="Fechar"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                                <p className="absolute left-1/2 top-[120%] -translate-x-[50%] whitespace-pre rounded-ds-sm tooltip-surface p-1 ds-type-caption text-ds-text-inverse opacity-0 transition ease-linear duration-200 group-hover/public-close:opacity-100">
                                    Fechar
                                </p>
                            </div>
                        </div>

                        <h3 className={`task-menu-title w-full pb-2 pr-10 ds-type-h3 text-ds-text-default ${selectedTask.done ? "text-black/40" : ""}`}>
                            {selectedTask.name}
                        </h3>

                        <div className="task-menu-content-divider" aria-hidden="true" />

                        {hasSelectedDescription && (
                            <PublicTaskNoteContent
                                className="task-menu-editor"
                                task={selectedTask}
                                onTaskMentionClick={openReferencedTask}
                            />
                        )}

                        {hasSelectedRelatedLinks && (
                            <section className={`pt-4 ${hasSelectedDescription ? "mt-5 border-t border-ds-border-default" : "mt-3"}`}>
                                <h4 className="ds-type-body-sm font-semibold text-ds-text-default">{t(language, "relatedLinks")}</h4>
                                <ul className="mt-4 max-h-32 space-y-2 overflow-auto pr-1">
                                    {selectedRelatedLinks.map((link, index) => (
                                        <li key={`${index}-${link.url}-${link.name}`} className="group/public-related-link relative rounded-ds-lg bg-ds-background-surface-muted px-4 py-3">
                                            <a
                                                href={normalizeLinkUrl(link.url)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex min-w-0 items-center justify-between gap-2"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium text-ds-text-default">{link.name || normalizeLinkUrl(link.url)}</p>
                                                    <p className="truncate ds-type-caption text-ds-text-muted">{link.url}</p>
                                                </div>
                                                <LinkExternal01 className="h-4 w-4 shrink-0 text-ds-text-muted" />
                                            </a>
                                            <p className="pointer-events-none absolute bottom-[110%] left-1/2 z-20 w-max max-w-[16rem] -translate-x-1/2 rounded-ds-sm tooltip-surface p-2 text-left ds-type-caption opacity-0 transition-opacity delay-0 duration-150 ease-linear whitespace-normal break-words group-hover/public-related-link:opacity-100 group-hover/public-related-link:delay-[700ms]">
                                                {normalizeLinkUrl(link.url)}
                                            </p>
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
                        backgroundColor: "var(--color-overlay-scrim)",
                        backdropFilter: "blur(2px)",
                        WebkitBackdropFilter: "blur(2px)",
                    }}
                    onClick={closeSearchModal}
                >
                    <div
                        className={`search-form ds-modal-shell relative z-[80] w-[28rem] max-w-full p-4 text-ds-text-muted transition-all duration-[160ms] ease-in lg:p-8 ${isSearchVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
                        onClick={ev => ev.stopPropagation()}
                    >
                        <h3 className="ds-type-h4 text-ds-text-default">{t(language, "search")}</h3>

                        <div className="relative">
                            <input
                                className="ds-input-line my-6 w-full py-1 pr-10"
                                type="text"
                                autoFocus
                                value={searchQuery}
                                onChange={ev => setSearchQuery(ev.target.value)}
                                aria-label={t(language, "search")}
                            />

                            <button
                                type="button"
                                className={`app-button-hover absolute right-2 top-10 -translate-y-[50%] rounded-ds-full p-1 text-ds-text-subtle transition-opacity duration-150 hover:opacity-70 ${searchQuery ? "" : "hidden"}`}
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
                                    className="group w-full border-b border-ds-border-default text-left"
                                    onClick={() => openTaskFromSearch(task)}
                                >
                                    <div className="task flex h-[41px] items-center justify-between px-0">
                                        {renderPublicTaskTitle(task, relatedLinksEnabled ? normalizeRelatedLinks(task).length : 0, publicTaskTitleMaxLength)}
                                        <p className="ds-type-caption ml-4 shrink-0 text-ds-text-subtle">{formatDayMonth(new Date(task.date), language, dateFormat)}</p>
                                    </div>
                                </button>
                            ))}

                            {!!searchQuery.trim() && filteredSearchTasks.length === 0 && (
                                <p className="ds-type-body-sm py-2 text-ds-text-subtle">
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
