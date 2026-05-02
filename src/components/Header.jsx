import React from "react"
import { HeaderBtn } from "./HeaderBtn"
import {useAuth} from "../contexts/AuthContext.jsx";
import ProfileMenu from "./menus/ProfileMenu.jsx";
import ExtrasMenu from "./menus/ExtrasMenu.jsx";
import {formDate, getStoredWeekShift, openForm, parseDateOnly, setPageScrollLocked, setStoredWeekShift, syncWeekShiftFromUrl} from "../scripts/utils.js";
import { supabase } from "../scripts/supabase.js";
import { getAgendaTasks } from "../scripts/api.js";
import { DotsVertical, ChevronLeft, ChevronRight, Star06, User03 } from "@untitledui/icons";
import { getAppLanguage, getLocale, t } from "../scripts/i18n.js";
import { getCountryCodeForLanguage, getHolidaysByYears } from "../scripts/holidays.js";

function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameDay(dateA, dateB) {
    return dateA.getFullYear() === dateB.getFullYear()
        && dateA.getMonth() === dateB.getMonth()
        && dateA.getDate() === dateB.getDate();
}

function isImageAvatar(value) {
    return typeof value === "string" && (value.startsWith("data:image/") || value.startsWith("http://") || value.startsWith("https://"));
}

function getUserInitials(user) {
    const source = (user?.name || user?.email || "U").trim();
    const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
    const initials = parts.map(part => part[0]?.toUpperCase()).join("");
    return initials || "U";
}

const Header = ({ onOpenAbout = () => {} }) => {

    const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
    const [activeMenu, setActiveMenu] = React.useState(null);
    const [profileMenuStyle, setProfileMenuStyle] = React.useState({});
    const [extrasMenuStyle, setExtrasMenuStyle] = React.useState({});
    const [calendarMonth, setCalendarMonth] = React.useState(() => startOfMonth(new Date()));
    const [taskDates, setTaskDates] = React.useState(() => new Set());
    const [agendaTasks, setAgendaTasks] = React.useState(() => []);
    const [holidayNamesByDate, setHolidayNamesByDate] = React.useState(() => ({}));
    const [weekShift, setWeekShift] = React.useState(() => getStoredWeekShift());
    const calendarRef = React.useRef(null);
    const fetchTimeoutRef = React.useRef(null);

    const newDate = React.useMemo(() => {
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + (weekShift * 7));
        return nextDate;
    }, [weekShift]);

    function openLoginForm() {
        openForm("login-form");
    }

    function closeHeaderMenus() {
        setActiveMenu(null);
    }

    function openProfileMenu(ev) {
        ev.stopPropagation();
        const buttonPos = ev.currentTarget.getBoundingClientRect();
        setProfileMenuStyle({
            left: `${Math.round(buttonPos.left + buttonPos.width / 2)}px`,
            top: `${Math.round(buttonPos.bottom) + 8}px`,
        });
        setActiveMenu(prevMenu => prevMenu === "profile" ? null : "profile");
    }

    function openExtrasMenu(ev) {
        ev.stopPropagation();
        const buttonPos = ev.currentTarget.getBoundingClientRect();
        setExtrasMenuStyle({
            right: `${Math.round(window.innerWidth - buttonPos.right - 15)}px`,
            top: `${Math.round(buttonPos.bottom) + 8}px`,
        });
        setActiveMenu(prevMenu => prevMenu === "extras" ? null : "extras");
    }

    function toPrevWeek() {
        setWeekShift(prevShift => setStoredWeekShift(prevShift - 1));
    }

    function toNextWeek() {
        setWeekShift(prevShift => setStoredWeekShift(prevShift + 1));
    }

    const {currentUser} = useAuth();
    const language = getAppLanguage(currentUser?.language);
    const locale = getLocale(language);
    const weekStartIndex = currentUser?.weekStartsOn === "Sunday" ? 0 : 1;

    React.useEffect(() => {
        setWeekShift(syncWeekShiftFromUrl());
    }, []);

    React.useEffect(() => {
        function handleWeekShiftChange(ev) {
            setWeekShift(Number(ev.detail?.weekShift) || 0);
        }

        window.addEventListener("lophos-planner:week-shift-change", handleWeekShiftChange);
        return () => window.removeEventListener("lophos-planner:week-shift-change", handleWeekShiftChange);
    }, []);

    React.useEffect(() => {
        const nextMonth = startOfMonth(newDate);
        setCalendarMonth(prevMonth => {
            if (
                prevMonth.getFullYear() === nextMonth.getFullYear()
                && prevMonth.getMonth() === nextMonth.getMonth()
            ) {
                return prevMonth;
            }

            return nextMonth;
        });
    }, [newDate]);

    React.useEffect(() => {
        if (isCalendarOpen) return;
        const nextMonth = startOfMonth(newDate);
        setCalendarMonth(prevMonth => {
            if (
                prevMonth.getFullYear() === nextMonth.getFullYear()
                && prevMonth.getMonth() === nextMonth.getMonth()
            ) {
                return prevMonth;
            }

            return nextMonth;
        });
    }, [isCalendarOpen, newDate]);

    React.useEffect(() => {
        if (!activeMenu) return undefined;

        function handleCloseMenus() {
            setActiveMenu(null);
        }

        function handleKeyDown(ev) {
            if (ev.key !== "Escape") return;
            setActiveMenu(null);
        }

        window.addEventListener("click", handleCloseMenus);
        window.addEventListener("scroll", handleCloseMenus, { passive: true });
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("click", handleCloseMenus);
            window.removeEventListener("scroll", handleCloseMenus);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [activeMenu]);

    React.useEffect(() => {
        if (!isCalendarOpen) return undefined;

        setPageScrollLocked(true);

        function handleKeyDown(ev) {
            if (ev.key !== "Escape") return;
            ev.preventDefault();
            setIsCalendarOpen(false);
        }

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            setPageScrollLocked(false);
        };
    }, [isCalendarOpen]);

    React.useEffect(() => {
        if (!currentUser?.uid || !currentUser?.currentAgendaId) {
            setTaskDates(new Set());
            setAgendaTasks([]);
            return undefined;
        }

        const fetchAgendaTasks = async () => {
            const tasks = await getAgendaTasks(currentUser.currentAgendaId);
            const nextTasks = (tasks || [])
                .filter(task => task && !task.is_board_task)
                .sort((a, b) => {
                    const dateA = new Date(a.date).getTime();
                    const dateB = new Date(b.date).getTime();
                    if (dateA !== dateB) return dateA - dateB;
                    return (Number(a.order) || 0) - (Number(b.order) || 0);
                });

            setAgendaTasks(nextTasks);
            setTaskDates(new Set(nextTasks.map(task => formDate(parseDateOnly(task.date)))));
        };

        const scheduleFetchAgendaTasks = () => {
            if (fetchTimeoutRef.current) {
                clearTimeout(fetchTimeoutRef.current);
            }

            fetchTimeoutRef.current = setTimeout(() => {
                fetchTimeoutRef.current = null;
                fetchAgendaTasks();
            }, 40);
        };

        fetchAgendaTasks();

        const channel = supabase
            .channel(`header-task-dates:${currentUser.uid}:${currentUser.currentAgendaId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "tasks",
                    filter: `agenda_id=eq.${currentUser.currentAgendaId}`,
                },
                scheduleFetchAgendaTasks
            )
            .subscribe();

        return () => {
            if (fetchTimeoutRef.current) {
                clearTimeout(fetchTimeoutRef.current);
                fetchTimeoutRef.current = null;
            }

            supabase.removeChannel(channel);
        };
    }, [currentUser?.uid, currentUser?.currentAgendaId]);

    React.useEffect(() => {
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
    }, [calendarMonth.getFullYear(), calendarMonth.getMonth(), language]);

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

    const calendarYear = calendarMonth.getFullYear();

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
                isWeekend: [0, 6].includes(cellDate.getDay()),
                hasTasks: taskDates.has(dateKey),
                holidayName: holidayNamesByDate[dateKey] || "",
            };
        });
    }, [calendarMonth, holidayNamesByDate, taskDates]);

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

        agendaTasks.forEach(task => {
            if (!task?.date) return;
            const taskDate = parseDateOnly(task.date);
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

        Object.values(nextMap).forEach(tasks => {
            tasks.sort((a, b) => {
                const orderA = Number(a.order) || 0;
                const orderB = Number(b.order) || 0;
                if (orderA !== orderB) return orderA - orderB;
                return String(a.name || "").localeCompare(String(b.name || ""));
            });
        });

        return nextMap;
    }, [agendaTasks, calendarMonth]);

    function getTaskChipClassName(task) {
        const color = (task?.color || "").toString();
        if (color.includes("amber-500")) return "bg-amber-500 text-black";
        if (color.includes("green-500")) return "bg-green-500 text-white";
        if (color.includes("red-500")) return "bg-rose-500 text-white";
        return "bg-[rgba(244,244,247,1)] text-black dark:bg-black dark:text-white";
    }

    const monthLabel = React.useMemo(() => {
        return new Intl.DateTimeFormat(locale, {
            month: "long",
            year: "numeric",
        }).format(calendarMonth)
            .replace(/\sde\s/i, " ")
            .replace(/^./, chr => chr.toUpperCase());
    }, [calendarMonth, locale]);

    function changeCalendarMonth(delta) {
        setCalendarMonth(prevMonth => new Date(prevMonth.getFullYear(), prevMonth.getMonth() + delta, 1));
    }

    function getStartOfWeek(refDate) {
        const start = parseDateOnly(refDate);
        const offset = (start.getDay() - weekStartIndex + 7) % 7;
        start.setDate(start.getDate() - offset);
        return start;
    }

    function handleCalendarDaySelect(date) {
        const todayWeekStart = getStartOfWeek(new Date());
        const targetWeekStart = getStartOfWeek(date);
        const nextShift = Math.round((targetWeekStart - todayWeekStart) / (7 * 24 * 60 * 60 * 1000));

        setWeekShift(setStoredWeekShift(nextShift));
        setCalendarMonth(startOfMonth(date));
        setIsCalendarOpen(false);
    }

    const headerBtns = [
        {
            textColor: "text-black dark:text-black",
            bgColor: "bg-[#f2f2f2] dark:bg-[#f2f2f2]",
            icon: Star06,
            tooltip: t(language, "generateStatus"),
            onClick: () => openForm("status-generator-form"),
        },
        {
            textColor: "text-gray-900 dark:text-white",
            bgColor: "",
            icon: DotsVertical,
            tooltip: t(language, "extras"),
            onClick: openExtrasMenu,
            style: { backgroundColor: '#f2f2f2' },
        },
        {
            textColor: "text-white dark:text-gray-100",
            bgColor: "bg-black dark:bg-black",
            icon: ChevronLeft,
            onClick: toPrevWeek,
            className: "ml-4",
        },
        {
            textColor: "text-white dark:text-gray-100",
            bgColor: "bg-black dark:bg-black",
            icon: ChevronRight,
            onClick: toNextWeek,
        },
    ]

    const monthName = new Intl.DateTimeFormat(locale, { month: "long" }).format(newDate);
    return (
        <header
            className="max-container flex justify-between items-center w-full gap-6 padding-x py-4 pb-3 lg:py-5 lg:pb-3 max-lg:py-6 max-lg:pb-3 bg-white max-lg:sticky max-lg:top-0 z-50
            dark:bg-gray-800 dark:text-white dark:border-gray-700">
            <div className="relative" ref={calendarRef}>
                <button
                    type="button"
                    className="header-month-trigger text-[22px] font-bold leading-[28px] tracking-[-0.5px] capitalize text-black dark:text-white lg:text-[36px] lg:leading-[42px]"
                    onClick={() => setIsCalendarOpen(prev => !prev)}
                    aria-label={t(language, "changeTaskDate")}
                    aria-expanded={isCalendarOpen}
                >
                    <span>{monthName} {newDate.getFullYear()}</span>
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
                            <div
                                className="header-month-overview-drawer"
                            >
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
                                                            aria-label={dayItem.holidayName
                                                                ? `${dayItem.date.getDate()} - ${dayItem.holidayName}`
                                                                : `${dayItem.date.getDate()}`}
                                                        >
                                                            <span className="header-month-overview-day-number">
                                                                {dayItem.date.getDate()}
                                                            </span>
                                                            <div className="header-month-overview-day-chips">
                                                                {dayItem.holidayName && (
                                                                    <span
                                                                        className="header-month-overview-holiday-chip"
                                                                        title={dayItem.holidayName}
                                                                    >
                                                                        {t(language, "holidayLabel")} - {dayItem.holidayName}
                                                                    </span>
                                                                )}
                                                                {(calendarTasksByDate[dayItem.key] || []).slice(0, 4).map(task => (
                                                                    <span
                                                                        key={task.id}
                                                                        className={`header-month-overview-task-chip ${getTaskChipClassName(task)} ${task?.done ? "opacity-50 line-through" : ""}`}
                                                                        title={task.name}
                                                                    >
                                                                        {task.name}
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

            <div className="flex gap-2">

                {currentUser ?
                    <button
                        type="button"
                        className="app-button-hover profile-menu-btn relative group flex h-10 w-10 items-center justify-center overflow-visible rounded-full bg-[#f2f2f2] text-black dark:bg-[#f2f2f2] dark:text-black"
                        onClick={openProfileMenu}
                        aria-label={t(language, "profile")}
                        aria-expanded={activeMenu === "profile"}
                    >
                        <span className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full">
                        {isImageAvatar(currentUser?.avatar) ? (
                            <img src={currentUser.avatar} alt={currentUser?.name || "Profile"} className="h-full w-full object-cover" />
                        ) : (
                            <h2 className="text-sm font-semibold leading-none">{getUserInitials(currentUser)}</h2>
                        )}
                        </span>
                        <p className="absolute left-1/2 -translate-x-[50%] top-[120%]
        whitespace-nowrap opacity-0 group-hover:opacity-100 transition ease-linear duration-200
         text-white tooltip-surface rounded text-xs p-1 pointer-events-none z-50">{t(language, "profile")}</p>
                    </button>
                    : <HeaderBtn {...{
                        textColor: "text-gray-900 dark:text-white",
                        bgColor: "bg-blue-200 dark:bg-blue-700",
                        icon: User03,
                        onClick: openLoginForm,
                        tooltip: t(language, "login"),
                    }}/>}
                {
                    headerBtns.map((btn, index) => (
                        <HeaderBtn {...btn} key={index}/>
                    ))
                }
            </div>
            <ProfileMenu
                isOpen={activeMenu === "profile"}
                style={profileMenuStyle}
                onClose={closeHeaderMenus}
            />
            <ExtrasMenu
                isOpen={activeMenu === "extras"}
                style={extrasMenuStyle}
                onClose={closeHeaderMenus}
                onOpenAbout={onOpenAbout}
            />
        </header>
    )
}

export default Header
