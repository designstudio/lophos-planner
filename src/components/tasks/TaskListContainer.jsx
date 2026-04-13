import React, { useEffect, useState } from 'react';
import Lottie from 'lottie-react';
import todoLoadingAnimation from '../../assets/todo-loading.json';
import TaskList from './TaskList.jsx';
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../scripts/supabase.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { updateTask } from "../../scripts/api.js";
import { formDate, parseDateOnly } from "../../scripts/utils.js";
import { getAppLanguage, t } from "../../scripts/i18n.js";
import { getCountryCodeForLanguage, getHolidaysByYears } from "../../scripts/holidays.js";

const TaskListContainer = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [curDate, setCurDate] = useState(new Date());
    const [tasks, setTasks] = useState([]);
    const [maxTasks, setMaxTasks] = React.useState(10);
    const [loading, setLoading] = useState(true);
    const [minLoadingDone, setMinLoadingDone] = useState(false);
    const [holidayNamesByDate, setHolidayNamesByDate] = useState({});
    const tasksRef = React.useRef([]);
    const fetchTimeoutRef = React.useRef(null);

    const { currentUser, agendas } = useAuth();
    const language = getAppLanguage(currentUser?.language);
    const currentAgenda = agendas?.find(agenda => String(agenda.id) === String(currentUser?.currentAgendaId));
    const shouldSortCompletedTasks = currentAgenda?.sort_completed_tasks ?? true;

    function sortTasksForDisplay(list, sortCompletedTasks = true) {
        return [...list].sort((taskA, taskB) => {
            // First, separate completed from non-completed if sortCompletedTasks is enabled
            if (sortCompletedTasks) {
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
    }

    const changeMaxTasks = (newTasks) => {
        if (newTasks > maxTasks) setMaxTasks(newTasks);
    };

    function applyTaskUpdates(updatedTasks) {
        const updatesById = new Map(
            updatedTasks.map(task => [
                String(task.id),
                {
                    ...task,
                    date: parseDateOnly(task.date),
                },
            ])
        );

        setTasks(prevTasks => {
            const nextTasks = sortTasksForDisplay(
                prevTasks.map(task => updatesById.get(String(task.id)) ?? task),
                shouldSortCompletedTasks
            );
            tasksRef.current = nextTasks;
            return nextTasks;
        });
    }

    useEffect(() => {
        tasksRef.current = tasks;
    }, [tasks]);

    useEffect(() => {
        const timer = setTimeout(() => setMinLoadingDone(true), 700);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        function handleTaskDeleted(ev) {
            const deletedTaskId = ev.detail?.taskId;
            if (!deletedTaskId) return;

            setTasks(prevTasks => {
                const nextTasks = prevTasks.filter(task => String(task.id) !== String(deletedTaskId));
                tasksRef.current = nextTasks;
                return nextTasks;
            });
        }

        function handleTaskCreated(ev) {
            const createdTask = ev.detail?.task;
            if (!createdTask?.id) return;

            setTasks(prevTasks => {
                const normalizedTask = {
                    ...createdTask,
                    date: parseDateOnly(createdTask.date),
                };

                const withoutSameId = prevTasks.filter(task => String(task.id) !== String(normalizedTask.id));
                const nextTasks = sortTasksForDisplay([...withoutSameId, normalizedTask], shouldSortCompletedTasks);
                tasksRef.current = nextTasks;
                return nextTasks;
            });
        }

        function handleTaskUpdatedLocal(ev) {
            const taskId = ev.detail?.taskId;
            const updates = ev.detail?.updates;
            if (!taskId || !updates || typeof updates !== "object") return;

            setTasks(prevTasks => {
                let changed = false;

                const nextTasks = sortTasksForDisplay(prevTasks.map(task => {
                    if (String(task.id) !== String(taskId)) return task;
                    changed = true;

                    return {
                        ...task,
                        ...updates,
                        date: updates.date ? parseDateOnly(updates.date) : task.date,
                    };
                }), shouldSortCompletedTasks);

                if (!changed) return prevTasks;
                tasksRef.current = nextTasks;
                return nextTasks;
            });
        }

        window.addEventListener("task-deleted", handleTaskDeleted);
        window.addEventListener("task-created", handleTaskCreated);
        window.addEventListener("task-updated-local", handleTaskUpdatedLocal);
        return () => {
            window.removeEventListener("task-deleted", handleTaskDeleted);
            window.removeEventListener("task-created", handleTaskCreated);
            window.removeEventListener("task-updated-local", handleTaskUpdatedLocal);
        };
    }, []);

    async function persistTaskPositions(updatedTasks) {
        await Promise.all(
            updatedTasks.map(task =>
                updateTask(task.id, {
                    date: formDate(parseDateOnly(task.date)),
                    order: task.order,
                })
            )
        );
    }

    function moveTaskToColumn(taskId, toListInd) {
        return async () => {
            const destinationDate = dates[toListInd];
            if (!destinationDate) return;

            const taskToMove = tasksRef.current.find(task => String(task.id) === String(taskId));
            if (!taskToMove) return;

            const sourceKey = formDate(taskToMove.date);
            const destinationKey = formDate(destinationDate);
            if (sourceKey === destinationKey) return;

            const sourceTasks = sortTasksForDisplay(
                tasksRef.current.filter(task => formDate(task.date) === sourceKey && String(task.id) !== String(taskId)),
                shouldSortCompletedTasks
            ).map((task, index) => ({
                ...task,
                date: parseDateOnly(task.date),
                order: index,
            }));

            const destinationTasks = sortTasksForDisplay(
                tasksRef.current.filter(task => formDate(task.date) === destinationKey),
                shouldSortCompletedTasks
            );

            const movedTask = {
                ...taskToMove,
                date: parseDateOnly(destinationDate),
                order: destinationTasks.length,
            };

            const reorderedDestinationTasks = [...destinationTasks, movedTask].map((task, index) => ({
                ...task,
                date: parseDateOnly(destinationDate),
                order: index,
            }));

            const affectedTasks = [...sourceTasks, ...reorderedDestinationTasks];
            applyTaskUpdates(affectedTasks);
            await persistTaskPositions(affectedTasks);
        };
    }

    function updateColumnTasks(listInd, nextList) {
        const columnDate = parseDateOnly(dates[listInd]);

        setTasks(prevTasks => {
            const nextIds = new Set(nextList.map(task => String(task.id)));
            const updatedColumnTasks = nextList.map((task, index) => ({
                ...task,
                date: columnDate,
                order: index,
            }));

            const remainingTasks = prevTasks.filter(task => {
                const isSameColumn = formDate(task.date) === formDate(columnDate);
                return !isSameColumn || nextIds.has(String(task.id));
            });

            const updatesById = new Map(
                updatedColumnTasks.map(task => [String(task.id), task])
            );

            const mergedTasks = remainingTasks.map(task => updatesById.get(String(task.id)) ?? task);
            const missingTasks = updatedColumnTasks.filter(task =>
                !mergedTasks.some(existingTask => String(existingTask.id) === String(task.id))
            );

            const nextTasks = sortTasksForDisplay([...mergedTasks, ...missingTasks], shouldSortCompletedTasks);
            tasksRef.current = nextTasks;
            return nextTasks;
        });
    }

    function persistColumns(listIndexes) {
        return async () => {
            await new Promise(resolve => setTimeout(resolve, 0));

            const uniqueIndexes = [...new Set(listIndexes)]
                .filter(index => Number.isInteger(index) && index >= 0 && index < dates.length);

            if (uniqueIndexes.length === 0) return;

            const affectedTasks = uniqueIndexes.flatMap(listIndex => {
                const columnKey = formDate(dates[listIndex]);
                return sortTasksForDisplay(
                    tasksRef.current.filter(task => formDate(task.date) === columnKey),
                    shouldSortCompletedTasks
                ).map((task, order) => ({
                    ...task,
                    date: parseDateOnly(dates[listIndex]),
                    order,
                }));
            });

            if (affectedTasks.length === 0) return;

            applyTaskUpdates(affectedTasks);
            await persistTaskPositions(affectedTasks);
        };
    }

    useEffect(() => {
        if (!currentUser?.uid || !currentUser?.currentAgendaId) {
            setTasks([]);
            setLoading(false);
            return;
        }

        const fetchTasks = async () => {
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('uid', currentUser.uid)
                .eq('agenda_id', currentUser.currentAgendaId)
                .order('order');

            if (!error) {
                setTasks(sortTasksForDisplay((data || []).map(task => ({ ...task, date: parseDateOnly(task.date) })), shouldSortCompletedTasks));
            }

            setLoading(false);
        };

        const scheduleFetchTasks = () => {
            if (fetchTimeoutRef.current) {
                clearTimeout(fetchTimeoutRef.current);
            }

            fetchTimeoutRef.current = setTimeout(() => {
                fetchTimeoutRef.current = null;
                fetchTasks();
            }, 40);
        };

        setLoading(true);
        fetchTasks();

        const channel = supabase
            .channel(`tasks:${currentUser.uid}:${currentUser.currentAgendaId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tasks',
                    filter: `agenda_id=eq.${currentUser.currentAgendaId}`,
                },
                scheduleFetchTasks
            )
            .subscribe();

        return () => {
            if (fetchTimeoutRef.current) {
                clearTimeout(fetchTimeoutRef.current);
                fetchTimeoutRef.current = null;
            }
            supabase.removeChannel(channel);
        };
    }, [currentUser?.uid, currentUser?.currentAgendaId, shouldSortCompletedTasks]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            const openedBlur = document.querySelector(".blur-bg.active");
            document.body.style.overflowY = openedBlur ? "hidden" : "auto";
        }, 50);

        return () => clearInterval(intervalId);
    }, []);

    const weekShift = Number(searchParams.get("weekShift") || 0);

    useEffect(() => {
        const shift = weekShift * 7;
        setCurDate(() => {
            const newDate = new Date();
            newDate.setDate(newDate.getDate() + shift);
            return newDate;
        });
    }, [weekShift]);

    const weekStartIndex = currentUser?.weekStartsOn === "Sunday" ? 0 : 1;
    const dayOfWeek = (curDate.getDay() - weekStartIndex + 7) % 7;

    useEffect(() => {
        const startDate = new Date(+curDate);
        startDate.setDate(startDate.getDate() - dayOfWeek);

        const endDate = new Date(+startDate);
        endDate.setDate(endDate.getDate() + 6);

        const years = [startDate.getFullYear(), endDate.getFullYear()];
        const countryCode = getCountryCodeForLanguage(language);
        let isCancelled = false;

        async function loadWeekHolidays() {
            const holidays = await getHolidaysByYears({ years, countryCode });
            if (isCancelled) return;

            const nextMap = {};
            holidays.forEach(holiday => {
                if (!holiday?.date) return;
                nextMap[holiday.date] = holiday.localName || holiday.name || "";
            });

            setHolidayNamesByDate(nextMap);
        }

        loadWeekHolidays();
        return () => {
            isCancelled = true;
        };
    }, [curDate, dayOfWeek, language]);

    const dates = [];
    const tasksData = {};
    const orderedTasks = sortTasksForDisplay(tasks, shouldSortCompletedTasks);

    for (let i = -dayOfWeek; i < -dayOfWeek + 7; ++i) {
        const newDate = new Date(+curDate);
        newDate.setDate(newDate.getDate() + i);
        dates.push(newDate);
        tasksData[formDate(newDate)] = orderedTasks.filter(task => formDate(task.date) === formDate(newDate));
        changeMaxTasks(tasksData[formDate(newDate)].length + 1);
    }

    if (loading || !minLoadingDone) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-black">
                <Lottie animationData={todoLoadingAnimation} loop style={{ width: 80, height: 80 }} />
            </div>
        );
    }

    return (
        <div className="w-full padding-x flex flex-col gap-6 py-4 lg:mt-0 lg:grid lg:grid-cols-6 lg:gap-6 lg:pt-10 max-lg:mt-20 dark:bg-black dark:text-white">
            {dates.slice(0, 5).map((date, index) => (
                <TaskList
                    date={date}
                    key={index}
                    ind={index}
                    active={formDate(new Date()) === formDate(date)}
                    last={false}
                    updateColumnTasks={updateColumnTasks}
                    persistColumns={persistColumns}
                    moveTaskToColumn={moveTaskToColumn}
                    maxTasks={maxTasks}
                    changeMaxTasks={changeMaxTasks}
                    tasksData={tasksData[formDate(date)]}
                    holidayName={holidayNamesByDate[formDate(date)] || ""}
                />
            ))}

            <div className="flex min-w-0 flex-col gap-[30px]">
                {dates.slice(5).map((date, index) => (
                    <TaskList
                        date={date}
                        key={index}
                        ind={index + 5}
                        active={formDate(new Date()) === formDate(date)}
                        last={true}
                        updateColumnTasks={updateColumnTasks}
                        persistColumns={persistColumns}
                        moveTaskToColumn={moveTaskToColumn}
                        maxTasks={maxTasks}
                        changeMaxTasks={changeMaxTasks}
                        tasksData={tasksData[formDate(date)]}
                        holidayName={holidayNamesByDate[formDate(date)] || ""}
                    />
                ))}
            </div>
        </div>
    );
};

export default TaskListContainer;
