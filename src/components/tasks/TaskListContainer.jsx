import React, { useEffect, useState } from 'react';
import { arrayMove } from "@dnd-kit/sortable";
import TaskList from './TaskList.jsx';
import { supabase } from "../../scripts/supabase.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getTaskById, normalizeTaskRecord, updateTask } from "../../scripts/api.js";
import { formDate, getStoredWeekShift, parseDateOnly, syncWeekShiftFromUrl } from "../../scripts/utils.js";
import { getAppLanguage, t } from "../../scripts/i18n.js";
import { getCountryCodeForLanguage, getHolidaysByYears } from "../../scripts/holidays.js";
import BrandedLoadingIndicator from '../BrandedLoadingIndicator.jsx';

const TaskListContainer = ({
    dndEnabled = false,
    activeTaskId: externalActiveTaskId = null,
    onRegisterDndApi,
}) => {
    const [weekShift, setWeekShift] = useState(() => getStoredWeekShift());
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
    const holidaysEnabled = currentAgenda?.holidays_enabled ?? true;
    const relatedLinksEnabled = currentAgenda?.related_links_enabled ?? true;

    function sortTasksForDisplay(list, sortCompletedTasks = true) {
        return [...list].sort((taskA, taskB) => {
            // First, separate completed from non-completed if sortCompletedTasks is enabled
            if (sortCompletedTasks) {
                const aCompleted = taskA.task_type === "meeting" ? 0 : (taskA.done ? 1 : 0);
                const bCompleted = taskB.task_type === "meeting" ? 0 : (taskB.done ? 1 : 0);
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
                    ...normalizeTaskRecord(task),
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
        setWeekShift(syncWeekShiftFromUrl());
    }, []);

    useEffect(() => {
        function handleWeekShiftChange(ev) {
            setWeekShift(Number(ev.detail?.weekShift) || 0);
        }

        window.addEventListener("lophos-planner:week-shift-change", handleWeekShiftChange);
        return () => window.removeEventListener("lophos-planner:week-shift-change", handleWeekShiftChange);
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
                    ...normalizeTaskRecord(createdTask),
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

                const nextTasks = sortTasksForDisplay(prevTasks.flatMap(task => {
                    if (String(task.id) !== String(taskId)) return [task];
                    changed = true;

                    const nextTask = {
                        ...normalizeTaskRecord({
                            ...task,
                            ...updates,
                            date: updates.date ? parseDateOnly(updates.date) : task.date,
                        }),
                    };

                    if (nextTask.is_board_task === true) {
                        return [];
                    }

                    return [nextTask];
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

    function getRenderedTaskContainers(taskId, sourceTasks = tasksRef.current) {
        const normalizedTaskId = String(taskId);
        const containers = [];

        dates.forEach((date, index) => {
            const dateKey = formDate(date);
            const hasTask = sourceTasks.some(task => (
                String(task.id) === normalizedTaskId
                && formDate(task.date) === dateKey
                && task.is_board_task !== true
            ));

            if (hasTask) {
                containers.push(`week:${index}`);
            }
        });

        return containers;
    }

    function dispatchTaskUpdatedLocal(taskId, updates) {
        window.dispatchEvent(new CustomEvent("task-updated-local", {
            detail: {
                taskId,
                updates,
            },
        }));
    }

    function moveTaskToColumn(taskId, toListInd) {
        return async (targetIndex = null) => {
            const destinationDate = dates[toListInd];
            if (!destinationDate) return;

            const taskToMove = tasksRef.current.find(task => String(task.id) === String(taskId))
                || await getTaskById(taskId).catch(() => null);
            if (!taskToMove) return;

            const destinationKey = formDate(destinationDate);
            const isBoardTask = !!taskToMove.is_board_task;
            const sourceKey = formDate(taskToMove.date);
            if (!isBoardTask && sourceKey === destinationKey) return;

            const destinationTasks = sortTasksForDisplay(
                tasksRef.current.filter(task => formDate(task.date) === destinationKey && String(task.id) !== String(taskId)),
                shouldSortCompletedTasks
            );
            const safeInsertIndex = Number.isInteger(targetIndex)
                ? Math.max(0, Math.min(targetIndex, destinationTasks.length))
                : destinationTasks.length;

            if (isBoardTask) {
                const movedTask = normalizeTaskForWeekDrop(taskToMove, destinationDate, safeInsertIndex);
                const reorderedDestinationTasks = [...destinationTasks];
                reorderedDestinationTasks.splice(safeInsertIndex, 0, movedTask);
                const normalizedDestinationTasks = reorderedDestinationTasks.map((task, index) => (
                    normalizeTaskForWeekDrop(task, destinationDate, index)
                ));
                const remainingTasks = tasksRef.current.filter(task => (
                    String(task.id) !== String(taskId) && formDate(task.date) !== destinationKey
                ));

                const nextTasks = sortTasksForDisplay(
                    [...remainingTasks, ...normalizedDestinationTasks],
                    shouldSortCompletedTasks
                );

                tasksRef.current = nextTasks;
                setTasks(nextTasks);

                const updates = {
                    date: formDate(destinationDate),
                    order: safeInsertIndex,
                    is_board_task: false,
                    board_column_id: null,
                    board_order: null,
                };

                try {
                    dispatchTaskUpdatedLocal(taskId, updates);
                    await updateTask(taskId, updates);
                    const destinationTasksToPersist = normalizedDestinationTasks.filter(task => String(task.id) !== String(taskId));
                    if (destinationTasksToPersist.length > 0) {
                        await persistTaskPositions(destinationTasksToPersist);
                    }
                } catch {
                    await reloadTasks();
                }
                return {
                    operation: "move board → week",
                    payload: {
                        taskId: String(taskId),
                        targetContainerId: `week:${toListInd}`,
                        targetIndex: safeInsertIndex,
                        persistedTask: movedTask,
                    },
                };
            }

            const sourceTasks = sortTasksForDisplay(
                tasksRef.current.filter(task => formDate(task.date) === sourceKey && String(task.id) !== String(taskId)),
                shouldSortCompletedTasks
            ).map((task, index) => ({
                ...task,
                date: parseDateOnly(task.date),
                order: index,
            }));

            const movedTask = normalizeTaskForWeekDrop(taskToMove, destinationDate, safeInsertIndex);
            const reorderedDestinationTasks = [...destinationTasks];
            reorderedDestinationTasks.splice(safeInsertIndex, 0, movedTask);
            const normalizedDestinationTasks = reorderedDestinationTasks.map((task, index) => (
                normalizeTaskForWeekDrop(task, destinationDate, index)
            ));

            const affectedTasks = [...sourceTasks, ...normalizedDestinationTasks];
            applyTaskUpdates(affectedTasks);
            await persistTaskPositions(affectedTasks);
            return {
                operation: "move week → week",
                payload: {
                    taskId: String(taskId),
                    sourceContainerId: `week:${dateKeyToIndex.get(sourceKey) ?? -1}`,
                    targetContainerId: `week:${toListInd}`,
                    targetIndex: safeInsertIndex,
                    persistedTasks: affectedTasks,
                },
            };
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
                .eq('agenda_id', currentUser.currentAgendaId)
                .or('is_board_task.is.null,is_board_task.eq.false')
                .order('order');

            if (!error) {
                setTasks(sortTasksForDisplay((data || []).map(normalizeTaskRecord), shouldSortCompletedTasks));
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
            if (!holidaysEnabled) {
                setHolidayNamesByDate({});
                return;
            }

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
    }, [curDate, dayOfWeek, holidaysEnabled, language]);

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

    const dateKeyToIndex = new Map(dates.map((date, index) => [formDate(date), index]));
    function getColumnTasks(listIndex, sourceTasks = tasksRef.current) {
        const columnDate = dates[listIndex];
        if (!columnDate) return [];

        const columnKey = formDate(columnDate);
        return sortTasksForDisplay(
            sourceTasks.filter(task => formDate(task.date) === columnKey),
            shouldSortCompletedTasks
        );
    }

    function resolveColumnIndexFromTaskId(taskId, sourceTasks = tasksRef.current) {
        const task = sourceTasks.find(entry => String(entry.id) === String(taskId));
        if (!task) return -1;
        return dateKeyToIndex.get(formDate(task.date)) ?? -1;
    }

    function normalizeTaskForWeekDrop(task, targetDate, order) {
        return {
            ...task,
            date: parseDateOnly(targetDate),
            order,
            is_board_task: false,
            board_column_id: null,
            board_order: null,
        };
    }

    function getSafeWeekInsertIndex(tasksInColumn, targetIndex) {
        if (!Number.isInteger(targetIndex)) return tasksInColumn.length;
        return Math.max(0, Math.min(targetIndex, tasksInColumn.length));
    }

    async function commitWeekDrop({ activeId, activeData, target }) {
        const targetColumnIndex = Number(target?.containerIndex);
        if (!Number.isInteger(targetColumnIndex) || targetColumnIndex < 0 || targetColumnIndex >= dates.length) {
            return null;
        }

        const sourceZone = activeData?.zone;
        const safeTargetIndex = getSafeWeekInsertIndex(
            getColumnTasks(targetColumnIndex).filter(task => String(task.id) !== String(activeId)),
            target?.index
        );

        if (sourceZone === "board") {
            return moveTaskToColumn(activeId, targetColumnIndex)(safeTargetIndex);
        }

        const sourceColumnIndex = Number(activeData?.containerIndex);
        if (!Number.isInteger(sourceColumnIndex) || sourceColumnIndex < 0) {
            return null;
        }

        const sourceTasks = getColumnTasks(sourceColumnIndex);
        const sourceDate = dates[sourceColumnIndex];
        const targetDate = dates[targetColumnIndex];
        if (!sourceDate || !targetDate) return null;

        if (sourceColumnIndex === targetColumnIndex) {
            const oldIndex = sourceTasks.findIndex(task => String(task.id) === String(activeId));
            if (oldIndex < 0) return null;

            const fallbackTargetIndex = sourceTasks.length - 1;
            const safeIndex = getSafeWeekInsertIndex(sourceTasks.filter(task => String(task.id) !== String(activeId)), target?.index);
            const newIndex = target?.overType === "task"
                ? sourceTasks.findIndex(task => String(task.id) === String(target?.taskId))
                : fallbackTargetIndex;

            const finalIndex = newIndex < 0 ? safeIndex : newIndex;
            if (oldIndex === finalIndex) {
                return {
                    operation: "no-op",
                    payload: {
                        taskId: String(activeId),
                        sourceContainerId: `week:${sourceColumnIndex}`,
                        targetContainerId: `week:${targetColumnIndex}`,
                        targetIndex: finalIndex,
                    },
                };
            }

            const reorderedTasks = arrayMove(sourceTasks, oldIndex, finalIndex).map((task, index) => (
                normalizeTaskForWeekDrop(task, sourceDate, index)
            ));

            applyTaskUpdates(reorderedTasks);
            await persistTaskPositions(reorderedTasks);

            return {
                operation: "reorder same container",
                payload: {
                    taskId: String(activeId),
                    sourceContainerId: `week:${sourceColumnIndex}`,
                    targetContainerId: `week:${targetColumnIndex}`,
                    sourceIndex: oldIndex,
                    targetIndex: finalIndex,
                    persistedTasks: reorderedTasks,
                },
            };
        }

        const sourceWithoutActive = sourceTasks
            .filter(task => String(task.id) !== String(activeId))
            .map((task, index) => normalizeTaskForWeekDrop(task, sourceDate, index));
        const targetTasks = getColumnTasks(targetColumnIndex)
            .filter(task => String(task.id) !== String(activeId));
        const taskToMove = tasksRef.current.find(task => String(task.id) === String(activeId))
            || (activeData?.task ? normalizeTaskRecord(activeData.task) : null);
        if (!taskToMove) return null;

        const movedTask = normalizeTaskForWeekDrop(taskToMove, targetDate, safeTargetIndex);
        const nextTargetTasks = [...targetTasks];
        nextTargetTasks.splice(safeTargetIndex, 0, movedTask);
        const normalizedTargetTasks = nextTargetTasks.map((task, index) => (
            normalizeTaskForWeekDrop(task, targetDate, index)
        ));
        const affectedTasks = [...sourceWithoutActive, ...normalizedTargetTasks];

        applyTaskUpdates(affectedTasks);
        await persistTaskPositions(affectedTasks);

        return {
            operation: "move week → week",
            payload: {
                taskId: String(activeId),
                sourceContainerId: `week:${sourceColumnIndex}`,
                targetContainerId: `week:${targetColumnIndex}`,
                sourceIndex: Number(activeData?.index),
                targetIndex: safeTargetIndex,
                persistedTasks: affectedTasks,
            },
        };
    }

    useEffect(() => {
        if (!onRegisterDndApi) return;

        onRegisterDndApi({
            commitDrop: args => commitWeekDrop(args),
            getRenderedTaskContainers: taskId => getRenderedTaskContainers(taskId),
        });

        return () => {
            onRegisterDndApi(null);
        };
    }, [onRegisterDndApi, shouldSortCompletedTasks, externalActiveTaskId, weekShift, currentUser?.currentAgendaId, tasks.length]);

    if (loading || !minLoadingDone) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-white text-black dark:bg-ds-background-page dark:text-ds-text-default">
                <BrandedLoadingIndicator size={80} />
            </div>
        );
    }

    return (
        <>
            <div className="w-full padding-x flex flex-col gap-6 py-4 text-black dark:text-ds-text-default lg:mt-0 lg:grid lg:grid-cols-6 lg:gap-6 lg:pt-10">
                {dates.slice(0, 5).map((date, index) => (
                    <TaskList
                        date={date}
                        key={index}
                        ind={index}
                        active={formDate(new Date()) === formDate(date)}
                        last={false}
                        moveTaskToColumn={moveTaskToColumn}
                        maxTasks={maxTasks}
                        changeMaxTasks={changeMaxTasks}
                        tasksData={tasksData[formDate(date)]}
                        holidayName={holidayNamesByDate[formDate(date)] || ""}
                        activeTaskId={externalActiveTaskId}
                        dndEnabled={dndEnabled}
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
                            moveTaskToColumn={moveTaskToColumn}
                            maxTasks={maxTasks}
                            changeMaxTasks={changeMaxTasks}
                            tasksData={tasksData[formDate(date)]}
                            holidayName={holidayNamesByDate[formDate(date)] || ""}
                            activeTaskId={externalActiveTaskId}
                            dndEnabled={dndEnabled}
                        />
                    ))}
                </div>
            </div>
        </>
    );
};

export default TaskListContainer;
