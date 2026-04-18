import React, { useEffect } from "react";
import { DotsHorizontal, Plus, ChevronRight, ChevronLeft, Trash03, StickerSquare, CheckCircle, Attachment02 } from "@untitledui/icons";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useTaskMenu } from "../../contexts/TaskMenuContext.jsx";
import { getAppLanguage, t } from "../../scripts/i18n.js";
import {
    createBoardColumns,
    createTask,
    deleteBoardColumn,
    getBoardColumns,
    getTaskById,
    toggleDoneTask,
    tryCatchDecorator,
    updateBoardColumn,
    updateTask,
} from "../../scripts/api.js";
import { formDate, getDefaultBoardColumns, matchesShortId, openForm, parseDateOnly, toShortId } from "../../scripts/utils.js";
import { supabase } from "../../scripts/supabase.js";

function sortBoardTasks(list) {
    return [...list].sort((taskA, taskB) => {
        const aCompleted = taskA.done ? 1 : 0;
        const bCompleted = taskB.done ? 1 : 0;
        if (aCompleted !== bCompleted) return aCompleted - bCompleted;

        const aOrder = Number(taskA.board_order ?? 0);
        const bOrder = Number(taskB.board_order ?? 0);
        if (aOrder !== bOrder) return aOrder - bOrder;

        return String(taskA.id).localeCompare(String(taskB.id));
    });
}

function sortBoardColumns(list) {
    return [...list].sort((columnA, columnB) => {
        const aOrder = Number(columnA.sort_order ?? 0);
        const bOrder = Number(columnB.sort_order ?? 0);
        if (aOrder !== bOrder) return aOrder - bOrder;

        const aCreatedAt = columnA.created_at || "";
        const bCreatedAt = columnB.created_at || "";
        if (aCreatedAt !== bCreatedAt) return String(aCreatedAt).localeCompare(String(bCreatedAt));

        return String(columnA.id).localeCompare(String(columnB.id));
    });
}

function normalizeBoardTasks(tasks) {
    return sortBoardTasks((tasks || []).map(task => ({
        ...task,
        date: parseDateOnly(task.date),
        is_board_task: true,
        board_order: Number.isFinite(Number(task.board_order)) ? Number(task.board_order) : 0,
    })));
}

function normalizeBoardColumns(columns) {
    return sortBoardColumns((columns || []).map((column, index) => ({
        ...column,
        id: String(column?.id || `board-column-${index + 1}`),
        uid: column?.uid || null,
        agenda_id: column?.agenda_id || null,
        title: typeof column?.title === "string" ? column.title : "",
        sort_order: Number.isFinite(Number(column?.sort_order)) ? Number(column.sort_order) : index,
        hidden: !!column?.hidden,
    })));
}

function buildDefaultBoardColumnsPayload(agendaId, uid) {
    return getDefaultBoardColumns(agendaId).map((column, index) => ({
        id: column.id,
        uid,
        agenda_id: agendaId,
        title: column.title,
        sort_order: index,
        hidden: false,
    }));
}

function generateBoardColumnId() {
    const randomId = globalThis.crypto?.randomUUID?.();
    if (randomId) return `board-column-${randomId}`;
    return `board-column-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function BoardTaskItem({ task, index, onToggleDone, onDragStart }) {
    const isDraggingRef = React.useRef(false);
    const { setTaskData } = useTaskMenu();
    const [searchParams, setSearchParams] = useSearchParams();
    const openedTask = searchParams.get("task") || searchParams.get("openedTask");
    const isMobile = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 1023px)").matches;
    const canDrag = !isMobile;
    const MAX_TASK_NAME_LENGTH = isMobile ? 54 : 58;
    const isTaskNameTruncated = task.name.length > MAX_TASK_NAME_LENGTH;
    const visibleTaskName = task.name.slice(0, MAX_TASK_NAME_LENGTH) + (isTaskNameTruncated ? "..." : "");
    const relatedLinks = Array.isArray(task.related_links) ? task.related_links : Array.isArray(task.relatedLinks) ? task.relatedLinks : [];

    const taskMenuPayload = React.useMemo(() => ({
        ...task,
        color: task.color || "white text-black dark:text-white dark:bg-black",
        description: task.description || "",
        relatedLinks,
        is_board_task: true,
    }), [task, relatedLinks]);

    const syncTaskMenuData = React.useCallback(() => {
        setTaskData(prev => {
            const sameTask = String(prev?.id) === String(taskMenuPayload.id)
                && prev?.name === taskMenuPayload.name
                && prev?.done === taskMenuPayload.done
                && prev?.color === taskMenuPayload.color
                && prev?.description === taskMenuPayload.description;

            if (sameTask) return prev;
            return taskMenuPayload;
        });
    }, [setTaskData, taskMenuPayload]);

    function openTaskMenu(ev) {
        ev.stopPropagation();
        if (isDraggingRef.current) return;

        if (openedTask && matchesShortId(task.id, openedTask)) {
            syncTaskMenuData();
            openForm("task-menu");
            return;
        }

        setSearchParams(prevParams => {
            const nextParams = new URLSearchParams(prevParams);
            nextParams.delete("openedTask");
            nextParams.set("task", toShortId(task.id));
            return nextParams;
        });

        syncTaskMenuData();
    }

    return (
        <div
            className="group agenda-accent-hover-border task-row-border task-item-row w-full border-b transition-colors duration-150 dark:border-gray-700"
            data-ind={index}
            data-task-id={task.id}
            draggable={canDrag}
            onDragStart={ev => {
                if (!canDrag) return;
                isDraggingRef.current = true;
                onDragStart?.(ev, task.id);
            }}
            onDragEnd={() => {
                setTimeout(() => {
                    isDraggingRef.current = false;
                }, 0);
            }}
        >
            <div className={`task flex items-center justify-between h-[41px] px-0 ${canDrag ? "cursor-grab" : "cursor-default"}`} onClick={openTaskMenu}>
                <div className={`relative min-w-0 flex-1 ${isTaskNameTruncated ? "group/task-title" : ""}`}>
                    <h5 className={`task-title min-w-0 flex items-center gap-1 px-0 py-0 text-[14px] font-normal leading-[41px] ${task.done ? "opacity-40 line-through" : ""}`}>
                        {task.description && <StickerSquare className="h-4 w-4 shrink-0" />}
                        {relatedLinks.length > 0 && <Attachment02 className="h-4 w-4 shrink-0" />}
                        <span className="block min-w-0 truncate">{visibleTaskName}</span>
                    </h5>
                    {isTaskNameTruncated && (
                        <p className="pointer-events-none absolute bottom-[120%] left-1/2 z-20 w-max max-w-[16rem] -translate-x-[50%] rounded bg-gray-800 p-2 text-left text-xs leading-4 text-white opacity-0 transition-opacity delay-0 duration-150 ease-linear whitespace-normal break-words group-hover/task-title:opacity-100 group-hover/task-title:delay-[700ms]">
                            {task.name}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    className="toggle-done ml-2 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 max-lg:opacity-100"
                    onClick={ev => {
                        ev.stopPropagation();
                        onToggleDone(task.id);
                    }}
                >
                    <CheckCircle className={`h-5 w-5 ${task.done ? "opacity-50" : ""}`} />
                </button>
            </div>
        </div>
    );
}

function BoardColumn({
    column,
    index,
    language,
    tasks,
    canDelete,
    canMoveLeft,
    canMoveRight,
    onRenameColumn,
    onMoveLeft,
    onMoveRight,
    onDeleteColumn,
    onAddColumn,
    onCreateTask,
    onAssignTask,
    onToggleTaskDone,
}) {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [isDropActive, setIsDropActive] = React.useState(false);
    const [draftTitle, setDraftTitle] = React.useState(typeof column.title === "string" ? column.title : "");
    const menuRef = React.useRef(null);
    const inputRef = React.useRef(null);

    useEffect(() => {
        function handlePointerDown(ev) {
            if (menuRef.current?.contains(ev.target)) return;
            setIsMenuOpen(false);
        }

        window.addEventListener("mousedown", handlePointerDown);
        return () => window.removeEventListener("mousedown", handlePointerDown);
    }, []);

    useEffect(() => {
        setDraftTitle(typeof column.title === "string" ? column.title : "");
    }, [column.id, column.title]);

    async function commitTitle() {
        const nextName = String(draftTitle || "");
        const currentName = typeof column.title === "string" ? column.title : "";
        if (nextName === currentName) return;
        await onRenameColumn(column.id, nextName);
    }

    async function handleFocusOut(ev) {
        const nextName = String(ev.currentTarget.value || "").trim();
        if (!nextName) return;
        ev.currentTarget.value = "";
        await onCreateTask(column.id, nextName);
    }

    async function handleKeyDown(ev) {
        if (ev.key === "Enter") {
            ev.preventDefault();
            const nextName = String(ev.currentTarget.value || "").trim();
            if (!nextName) return;
            ev.currentTarget.value = "";
            await onCreateTask(column.id, nextName);
            return;
        }

        if (ev.key === "Escape") {
            ev.currentTarget.value = "";
            ev.currentTarget.blur();
        }
    }

    function handleDragOver(ev) {
        const taskId = ev.dataTransfer?.getData("text/plain");
        if (!taskId) return;
        ev.preventDefault();
        setIsDropActive(true);
    }

    function handleDragLeave(ev) {
        if (!ev.currentTarget.contains(ev.relatedTarget)) {
            setIsDropActive(false);
        }
    }

    async function handleDrop(ev) {
        const taskId = ev.dataTransfer?.getData("text/plain");
        setIsDropActive(false);
        if (!taskId) return;

        ev.preventDefault();
        await onAssignTask(taskId, column.id);
    }

    return (
        <div
            className={`task-list flex w-full min-w-0 flex-col rounded-[20px] bg-transparent ${isDropActive ? "agenda-accent-soft-bg" : ""}`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className="relative" ref={menuRef}>
                <div className="group flex items-start justify-between gap-3 py-3 border-b-2 border-black/30 dark:border-white/30">
                    <input
                        type="text"
                        value={draftTitle}
                        onChange={ev => setDraftTitle(ev.target.value)}
                        onBlur={() => {
                            void commitTitle();
                        }}
                        onKeyDown={ev => {
                            if (ev.key === "Enter") {
                                ev.preventDefault();
                                ev.currentTarget.blur();
                                return;
                            }

                            if (ev.key === "Escape") {
                                ev.preventDefault();
                                setDraftTitle(typeof column.title === "string" ? column.title : "");
                                ev.currentTarget.blur();
                            }
                        }}
                        className="min-w-0 flex-1 bg-transparent text-[21px] font-bold leading-[28px] tracking-[-0.5px] text-black/30 outline-none dark:text-white/30"
                    />
                    <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-black opacity-0 transition-opacity duration-150 hover:bg-[rgba(17,24,39,0.08)] group-hover:opacity-100"
                        onClick={() => setIsMenuOpen(prev => !prev)}
                    >
                        <DotsHorizontal className="h-5 w-5" />
                    </button>

                    {isMenuOpen && (
                        <div className="board-column-menu">
                            {canMoveLeft && (
                                <button
                                    type="button"
                                    className="board-column-menu-item"
                                    onClick={() => {
                                        onMoveLeft(column.id);
                                        setIsMenuOpen(false);
                                    }}
                                >
                                    <span>{t(language, "boardColumnMoveLeft")}</span>
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                            )}
                            {canMoveRight && (
                                <button
                                    type="button"
                                    className="board-column-menu-item"
                                    onClick={() => {
                                        onMoveRight(column.id);
                                        setIsMenuOpen(false);
                                    }}
                                >
                                    <span>{t(language, "boardColumnMoveRight")}</span>
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            )}
                            <button
                                type="button"
                                className="board-column-menu-item"
                                onClick={() => {
                                    onAddColumn(column.id);
                                    setIsMenuOpen(false);
                                }}
                            >
                                <span>{t(language, "boardColumnAdd")}</span>
                                <Plus className="h-4 w-4" />
                            </button>
                            {canDelete && (
                                <button
                                    type="button"
                                    className="board-column-menu-item"
                                    onClick={() => {
                                        onDeleteColumn(column.id);
                                        setIsMenuOpen(false);
                                    }}
                                >
                                    <span>{t(language, "boardColumnDelete")}</span>
                                    <Trash03 className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
                {tasks.map((task, taskIndex) => (
                    <BoardTaskItem
                        key={task.id}
                        task={task}
                        index={taskIndex}
                        onToggleDone={onToggleTaskDone}
                        onDragStart={(ev, taskId) => {
                            ev.dataTransfer.setData("text/plain", String(taskId));
                            ev.dataTransfer.effectAllowed = "move";
                        }}
                    />
                ))}

                <form className="add-task" onSubmit={ev => ev.preventDefault()}>
                    <input
                        ref={inputRef}
                        type="text"
                        name="add-task-name"
                        onBlur={handleFocusOut}
                        onKeyDown={handleKeyDown}
                        placeholder=""
                        className="task-field-border-bottom task-row-border relative z-10 h-[41px] w-full bg-transparent p-0 text-[14px] text-black outline-none transition-colors duration-150 dark:bg-transparent dark:text-white"
                    />
                </form>

                {Array.from({ length: Math.max(0, 6 - tasks.length) }, (_, emptyIndex) => (
                    <div
                        className="task-row-border h-[41px] w-full border-b bg-white dark:border-gray-700 dark:bg-black"
                        key={`${column.id}-empty-${emptyIndex}`}
                        onClick={() => inputRef.current?.focus?.()}
                    >
                        <p className="opacity-0 cursor-default">placeholder</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function BoardViewContainer() {
    const { currentUser } = useAuth();
    const language = getAppLanguage(currentUser?.language);
    const agendaId = currentUser?.currentAgendaId || null;

    const [columns, setColumns] = React.useState([]);
    const [tasks, setTasks] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [minLoadingDone, setMinLoadingDone] = React.useState(false);
    const columnsRef = React.useRef([]);
    const tasksRef = React.useRef([]);
    const columnsFetchTimeoutRef = React.useRef(null);
    const tasksFetchTimeoutRef = React.useRef(null);

    useEffect(() => {
        columnsRef.current = columns;
    }, [columns]);

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

        function handleTaskUpdatedLocal(ev) {
            const taskId = ev.detail?.taskId;
            const updates = ev.detail?.updates;
            if (!taskId || !updates || typeof updates !== "object") return;

            setTasks(prevTasks => {
                let changed = false;

                const nextTasks = sortBoardTasks(prevTasks.flatMap(task => {
                    if (String(task.id) !== String(taskId)) return [task];
                    changed = true;

                    const nextTask = {
                        ...task,
                        ...updates,
                        date: updates.date ? parseDateOnly(updates.date) : task.date,
                    };

                    if (nextTask.is_board_task === false) {
                        return [];
                    }

                    return [nextTask];
                }));

                if (!changed && updates.is_board_task === true) {
                    const fallbackTask = {
                        id: taskId,
                        ...updates,
                        date: updates.date ? parseDateOnly(updates.date) : new Date(),
                    };

                    const nextTask = normalizeBoardTasks([fallbackTask])[0];
                    if (nextTask) {
                        changed = true;
                        nextTasks.push(nextTask);
                        nextTasks.sort((a, b) => {
                            const aCompleted = a.done ? 1 : 0;
                            const bCompleted = b.done ? 1 : 0;
                            if (aCompleted !== bCompleted) return aCompleted - bCompleted;

                            const aOrder = Number(a.board_order ?? 0);
                            const bOrder = Number(b.board_order ?? 0);
                            if (aOrder !== bOrder) return aOrder - bOrder;

                            return String(a.id).localeCompare(String(b.id));
                        });
                    }
                }

                if (!changed) return prevTasks;
                tasksRef.current = nextTasks;
                return nextTasks;
            });
        }

        window.addEventListener("task-deleted", handleTaskDeleted);
        window.addEventListener("task-updated-local", handleTaskUpdatedLocal);
        return () => {
            window.removeEventListener("task-deleted", handleTaskDeleted);
            window.removeEventListener("task-updated-local", handleTaskUpdatedLocal);
        };
    }, []);

    async function fetchBoardColumns(seedIfEmpty = false) {
        if (!currentUser?.uid || !agendaId) return [];

        let currentColumns = [];
        try {
            currentColumns = await getBoardColumns(agendaId);
        } catch {
            return [];
        }

        if (currentColumns.length === 0 && seedIfEmpty) {
            const defaults = buildDefaultBoardColumnsPayload(agendaId, currentUser.uid);
            const created = await createBoardColumns(defaults);
            return normalizeBoardColumns(created.length > 0 ? created : defaults);
        }

        return normalizeBoardColumns(currentColumns);
    }

    async function fetchBoardTasks() {
        if (!currentUser?.uid || !agendaId) return [];

        const { data, error } = await supabase
            .from("tasks")
            .select("*")
            .eq("agenda_id", agendaId)
            .eq("is_board_task", true);

        if (error) return [];
        return normalizeBoardTasks(data || []);
    }

    function applyColumns(nextColumns) {
        const normalized = normalizeBoardColumns(nextColumns);
        columnsRef.current = normalized;
        setColumns(normalized);
        return normalized;
    }

    function applyTasks(nextTasks) {
        const normalized = normalizeBoardTasks(nextTasks);
        tasksRef.current = normalized;
        setTasks(normalized);
        return normalized;
    }

    function dispatchTaskUpdatedLocal(taskId, updates) {
        window.dispatchEvent(new CustomEvent("task-updated-local", {
            detail: {
                taskId,
                updates,
            },
        }));
    }

    async function reloadColumns(seedIfEmpty = false) {
        const nextColumns = await fetchBoardColumns(seedIfEmpty);
        return applyColumns(nextColumns);
    }

    async function reloadTasks() {
        const nextTasks = await fetchBoardTasks();
        return applyTasks(nextTasks);
    }

    useEffect(() => {
        if (!currentUser?.uid || !agendaId) {
            setColumns([]);
            setTasks([]);
            setLoading(false);
            return;
        }

        let cancelled = false;

        const scheduleReloadColumns = () => {
            if (columnsFetchTimeoutRef.current) {
                clearTimeout(columnsFetchTimeoutRef.current);
            }

            columnsFetchTimeoutRef.current = setTimeout(() => {
                columnsFetchTimeoutRef.current = null;
                void reloadColumns(false);
            }, 40);
        };

        const scheduleReloadTasks = () => {
            if (tasksFetchTimeoutRef.current) {
                clearTimeout(tasksFetchTimeoutRef.current);
            }

            tasksFetchTimeoutRef.current = setTimeout(() => {
                tasksFetchTimeoutRef.current = null;
                void reloadTasks();
            }, 40);
        };

        setLoading(true);

        Promise.all([reloadColumns(true), reloadTasks()]).finally(() => {
            if (!cancelled) {
                setLoading(false);
            }
        });

        const tasksChannel = supabase
            .channel(`board-tasks:${currentUser.uid}:${agendaId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "tasks",
                    filter: `agenda_id=eq.${agendaId}`,
                },
                scheduleReloadTasks
            )
            .subscribe();

        const columnsChannel = supabase
            .channel(`board-columns:${currentUser.uid}:${agendaId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "board_columns",
                    filter: `agenda_id=eq.${agendaId}`,
                },
                scheduleReloadColumns
            )
            .subscribe();

        return () => {
            cancelled = true;

            if (columnsFetchTimeoutRef.current) {
                clearTimeout(columnsFetchTimeoutRef.current);
                columnsFetchTimeoutRef.current = null;
            }

            if (tasksFetchTimeoutRef.current) {
                clearTimeout(tasksFetchTimeoutRef.current);
                tasksFetchTimeoutRef.current = null;
            }

            supabase.removeChannel(tasksChannel);
            supabase.removeChannel(columnsChannel);
        };
    }, [currentUser?.uid, agendaId]);

    async function persistColumnOrder(nextColumns) {
        const normalized = sortBoardColumns(nextColumns).map((column, index) => ({
            ...column,
            sort_order: index,
        }));

        applyColumns(normalized);

        try {
            await Promise.all(
                normalized.map((column, index) =>
                    updateBoardColumn(column.id, { sort_order: index })
                )
            );
        } catch {
            await reloadColumns(false);
        }
    }

    async function renameColumn(columnId, title) {
        const nextTitle = String(title || "");
        const nextColumns = columnsRef.current.map(column => (
            String(column.id) === String(columnId)
                ? { ...column, title: nextTitle }
                : column
        ));

        applyColumns(nextColumns);

        try {
            await updateBoardColumn(columnId, { title: nextTitle });
        } catch {
            await reloadColumns(false);
        }
    }

    async function reorderColumn(columnId, direction) {
        const current = [...columnsRef.current];
        const index = current.findIndex(column => String(column.id) === String(columnId));
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return;

        const nextColumns = [...current];
        [nextColumns[index], nextColumns[nextIndex]] = [nextColumns[nextIndex], nextColumns[index]];
        await persistColumnOrder(nextColumns);
    }

    async function addColumnAfter(columnId) {
        const current = [...columnsRef.current];
        const index = current.findIndex(column => String(column.id) === String(columnId));
        const insertionIndex = index >= 0 ? index + 1 : current.length;
        const newColumn = {
            id: generateBoardColumnId(),
            uid: currentUser?.uid || null,
            agenda_id: agendaId,
            title: "",
            sort_order: insertionIndex,
            hidden: false,
        };

        const nextColumns = [
            ...current.slice(0, insertionIndex),
            newColumn,
            ...current.slice(insertionIndex),
        ].map((column, nextIndex) => ({
            ...column,
            sort_order: nextIndex,
        }));

        applyColumns(nextColumns);

        try {
            await createBoardColumns([newColumn]);
            await Promise.all(
                nextColumns.map((column, nextIndex) =>
                    updateBoardColumn(column.id, { sort_order: nextIndex })
                )
            );
        } catch {
            await reloadColumns(false);
        }
    }

    async function deleteColumn(columnId) {
        const current = [...columnsRef.current];
        if (current.length <= 1) return;

        const index = current.findIndex(column => String(column.id) === String(columnId));
        if (index < 0) return;

        const fallbackTarget = current[index - 1] || current[index + 1] || null;
        if (!fallbackTarget) return;

        const sourceTasks = sortBoardTasks(
            tasksRef.current.filter(task => String(task.board_column_id) === String(columnId))
        );
        const targetTasks = sortBoardTasks(
            tasksRef.current.filter(task => String(task.board_column_id) === String(fallbackTarget.id))
        );

        const mergedTasks = [...targetTasks, ...sourceTasks.map(task => ({
            ...task,
            board_column_id: fallbackTarget.id,
        }))].map((task, nextIndex) => ({
            ...task,
            board_column_id: fallbackTarget.id,
            board_order: nextIndex,
        }));

        const remainingTasks = tasksRef.current.filter(task => {
            const taskColumnId = String(task.board_column_id || "");
            return taskColumnId !== String(columnId) && taskColumnId !== String(fallbackTarget.id);
        });

        const nextColumns = current
            .filter(column => String(column.id) !== String(columnId))
            .map((column, nextIndex) => ({
                ...column,
                sort_order: nextIndex,
            }));

        applyColumns(nextColumns);
        applyTasks([...remainingTasks, ...mergedTasks]);

        try {
            await Promise.all(
                mergedTasks.map(task =>
                    updateTask(task.id, {
                        board_column_id: task.board_column_id,
                        board_order: task.board_order,
                    })
                )
            );
            await deleteBoardColumn(columnId);
            await Promise.all(
                nextColumns.map((column, nextIndex) =>
                    updateBoardColumn(column.id, { sort_order: nextIndex })
                )
            );
        } catch {
            await reloadColumns(false);
            await reloadTasks();
        }
    }

    async function createTaskInColumn(columnId, taskName) {
        const nextName = String(taskName || "").trim();
        if (!nextName || !currentUser?.uid || !agendaId) return;

        const boardOrder = getColumnTasks(columnId).length;
        const result = await tryCatchDecorator(createTask)({
            name: nextName,
            color: "white text-black dark:text-white dark:bg-black",
            date: formDate(new Date()),
            uid: currentUser.uid,
            agenda_id: agendaId,
            done: false,
            related_links: [],
            is_board_task: true,
            board_column_id: columnId,
            board_order: boardOrder,
        });

        if (!result.success || !result.data) return;

        const createdTask = {
            ...result.data,
            is_board_task: true,
            board_column_id: columnId,
            board_order: boardOrder,
            date: parseDateOnly(result.data.date),
        };

        applyTasks([...tasksRef.current.filter(task => String(task.id) !== String(createdTask.id)), createdTask]);
    }

    async function assignTaskToColumn(taskId, columnId) {
        if (!taskId || !columnId) return;

        const taskToMove = tasksRef.current.find(task => String(task.id) === String(taskId))
            || await getTaskById(taskId).catch(() => null);
        if (!taskToMove) return;

        const taskIsBoardTask = taskToMove.is_board_task !== false;
        if (taskIsBoardTask && String(taskToMove.board_column_id) === String(columnId)) return;

        const sourceColumnId = String(taskToMove.board_column_id || "");
        const sourceTasks = taskIsBoardTask
            ? sortBoardTasks(
                tasksRef.current.filter(task => String(task.board_column_id) === sourceColumnId && String(task.id) !== String(taskId))
            ).map((task, nextIndex) => ({
                ...task,
                board_column_id: sourceColumnId,
                board_order: nextIndex,
            }))
            : [];

        const destinationTasks = sortBoardTasks(
            tasksRef.current.filter(task => String(task.board_column_id) === String(columnId))
        );

        const movedTask = {
            ...taskToMove,
            board_column_id: columnId,
            board_order: destinationTasks.length,
            is_board_task: true,
            date: parseDateOnly(taskToMove.date || new Date()),
        };

        const reorderedDestinationTasks = [...destinationTasks, movedTask].map((task, nextIndex) => ({
            ...task,
            board_column_id: columnId,
            board_order: nextIndex,
            is_board_task: true,
        }));

        const remainingTasks = taskIsBoardTask ? tasksRef.current.filter(task => {
            const taskColumnId = String(task.board_column_id || "");
            return taskColumnId !== sourceColumnId && taskColumnId !== String(columnId);
        }) : tasksRef.current.slice();

        const nextTasks = sortBoardTasks([
            ...remainingTasks,
            ...sourceTasks,
            ...reorderedDestinationTasks,
        ]);

        applyTasks(nextTasks);

        try {
            await updateTask(taskId, {
                is_board_task: true,
                board_column_id: columnId,
                board_order: destinationTasks.length,
            });

            dispatchTaskUpdatedLocal(taskId, {
                is_board_task: true,
                board_column_id: columnId,
                board_order: destinationTasks.length,
            });

            if (taskIsBoardTask) {
                await Promise.all(
                    [...sourceTasks, ...reorderedDestinationTasks].map(task =>
                        updateTask(task.id, {
                            board_column_id: task.board_column_id,
                            board_order: task.board_order,
                        })
                    )
                );
            }
        } catch {
            await reloadTasks();
        }
    }

    async function toggleTaskDone(taskId) {
        applyTasks(tasksRef.current.map(task => (
            String(task.id) === String(taskId)
                ? { ...task, done: !task.done }
                : task
        )));

        const result = await tryCatchDecorator(toggleDoneTask)(taskId);
        if (!result.success) {
            await reloadTasks();
        }
    }

    function getColumnTasks(columnId) {
        return sortBoardTasks(tasksRef.current.filter(task => String(task.board_column_id) === String(columnId)));
    }

    if (loading || !minLoadingDone) {
        return null;
    }

    return (
        <div className="w-full padding-x py-4 lg:mt-0 lg:pt-10 dark:bg-black dark:text-white">
            <div className="grid grid-cols-4 gap-6">
                {columns.map((column, index) => (
                    <BoardColumn
                        key={column.id}
                        column={column}
                        index={index}
                        language={language}
                        tasks={getColumnTasks(column.id)}
                        canDelete={columns.length > 1}
                        canMoveLeft={index > 0}
                        canMoveRight={index < columns.length - 1}
                        onRenameColumn={renameColumn}
                        onMoveLeft={() => reorderColumn(column.id, -1)}
                        onMoveRight={() => reorderColumn(column.id, 1)}
                        onDeleteColumn={deleteColumn}
                        onAddColumn={addColumnAfter}
                        onCreateTask={createTaskInColumn}
                        onAssignTask={assignTaskToColumn}
                        onToggleTaskDone={toggleTaskDone}
                    />
                ))}
            </div>
        </div>
    );
}
