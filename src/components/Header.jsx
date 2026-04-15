import React from "react"
import { HeaderBtn } from "./HeaderBtn"
import {useAuth} from "../contexts/AuthContext.jsx";
import ProfileMenu from "./menus/ProfileMenu.jsx";
import ExtrasMenu from "./menus/ExtrasMenu.jsx";
import {formDate, getStoredWeekShift, openForm, parseDateOnly, setStoredWeekShift, syncWeekShiftFromUrl} from "../scripts/utils.js";
import { supabase } from "../scripts/supabase.js";
import { DotsVertical, ChevronLeft, ChevronRight, User03 } from "@untitledui/icons";
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

const Header = () => {

    const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
    const [calendarMonth, setCalendarMonth] = React.useState(() => startOfMonth(new Date()));
    const [taskDates, setTaskDates] = React.useState(() => new Set());
    const [holidayNamesByDate, setHolidayNamesByDate] = React.useState(() => ({}));
    const [weekShift, setWeekShift] = React.useState(() => getStoredWeekShift());
    const calendarRef = React.useRef(null);
    const fetchTimeoutRef = React.useRef(null);

    const newDate = new Date();
    newDate.setDate(newDate.getDate() + (weekShift * 7));

    function openLoginForm() {
        openForm("login-form");
    }

    function openProfileMenu(ev) {
        ev.stopPropagation();
        const profileMenu = document.querySelector(".profile-menu");
        const extrasMenu = document.querySelector(".extras-menu");
        if (!profileMenu || !extrasMenu) return;

        const wasOpen = profileMenu.classList.contains("active");
        profileMenu.classList.remove("active");
        extrasMenu.classList.remove("active");
        if (wasOpen) return;

        profileMenu.classList.add("active");
        const buttonPos = ev.currentTarget.getBoundingClientRect();
        profileMenu.style.left = `${Math.round(buttonPos.left + buttonPos.width / 2)}px`;
        profileMenu.style.top = `${Math.round(buttonPos.bottom) + 8}px`;
    }

    function openExtrasMenu(ev) {
        ev.stopPropagation();
        const extrasMenu = document.querySelector(".extras-menu");
        const profileMenu = document.querySelector(".profile-menu");
        if (!extrasMenu || !profileMenu) return;

        const wasOpen = extrasMenu.classList.contains("active");
        extrasMenu.classList.remove("active");
        profileMenu.classList.remove("active");
        if (wasOpen) return;

        extrasMenu.classList.add("active");
        const buttonPos = ev.currentTarget.getBoundingClientRect();
        extrasMenu.style.right = `${Math.round(window.innerWidth - buttonPos.right - 15)}px`;
        extrasMenu.style.top = `${Math.round(buttonPos.bottom) + 8}px`;
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
        setCalendarMonth(startOfMonth(newDate));
    }, [newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), weekShift]);

    React.useEffect(() => {
        if (!isCalendarOpen) return undefined;

        function handlePointerDown(ev) {
            if (calendarRef.current?.contains(ev.target)) return;
            setIsCalendarOpen(false);
        }

        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, [isCalendarOpen]);

    React.useEffect(() => {
        if (!currentUser?.uid || !currentUser?.currentAgendaId) {
            setTaskDates(new Set());
            return undefined;
        }

        const fetchTaskDates = async () => {
            const { data, error } = await supabase
                .from("tasks")
                .select("date")
                .eq("uid", currentUser.uid)
                .eq("agenda_id", currentUser.currentAgendaId);

            if (error) return;

            setTaskDates(new Set((data || []).map(task => formDate(parseDateOnly(task.date)))));
        };

        const scheduleFetchTaskDates = () => {
            if (fetchTimeoutRef.current) {
                clearTimeout(fetchTimeoutRef.current);
            }

            fetchTimeoutRef.current = setTimeout(() => {
                fetchTimeoutRef.current = null;
                fetchTaskDates();
            }, 40);
        };

        fetchTaskDates();

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
                scheduleFetchTaskDates
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
    }, [calendarMonth, language]);

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
                hasTasks: taskDates.has(dateKey),
                holidayName: holidayNamesByDate[dateKey] || "",
            };
        });
    }, [calendarMonth, holidayNamesByDate, taskDates, weekStartIndex]);

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
            className="max-container flex justify-between items-center w-full gap-6 padding-x py-4 lg:py-5 max-lg:py-6 bg-white max-lg:sticky max-lg:top-0 z-50
            dark:bg-gray-800 dark:text-white dark:border-gray-700">
            <div className="relative" ref={calendarRef}>
                <button
                    type="button"
                    className="header-month-trigger text-[36px] font-bold leading-[42px] tracking-[-0.5px] capitalize text-black dark:text-white"
                    onClick={() => setIsCalendarOpen(prev => !prev)}
                    aria-label={t(language, "changeTaskDate")}
                    aria-expanded={isCalendarOpen}
                >
                    <span>{monthName} {newDate.getFullYear()}</span>
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
                                        dayItem.holidayName ? "has-holiday" : "",
                                    ].filter(Boolean).join(" ")}
                                    onClick={() => handleCalendarDaySelect(dayItem.date)}
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

            <div className="flex gap-2">

                {currentUser ?
                    <button className="app-button-hover profile-menu-btn relative group flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#f2f2f2] text-black dark:bg-[#f2f2f2] dark:text-black" onClick={openProfileMenu}>
                        {isImageAvatar(currentUser?.avatar) ? (
                            <img src={currentUser.avatar} alt={currentUser?.name || "Profile"} className="h-full w-full object-cover" />
                        ) : (
                            <h2 className="text-sm font-semibold leading-none">{getUserInitials(currentUser)}</h2>
                        )}
                        <p className="absolute left-1/2 -translate-x-[50%] top-[120%]
        opacity-0 group-hover:opacity-100 transition ease-linear duration-200
         text-white tooltip-surface rounded text-xs p-1">{t(language, "profile")}</p>
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
            <ProfileMenu />
            <ExtrasMenu />
        </header>
    )
}

export default Header
