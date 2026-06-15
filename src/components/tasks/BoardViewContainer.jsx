import React, { useEffect } from "react";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { DotsVertical, Plus, ChevronRight, ChevronLeft, Trash03, StickerSquare, CheckCircle, Attachment02 } from "@untitledui/icons";
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
    normalizeTaskRecord,
    toggleDoneTask,
    tryCatchDecorator,
    updateBoardColumn,
    updateTask,
} from "../../scripts/api.js";
import { formDate, getDefaultBoardColumns, matchesShortId, openForm, parseDateOnly, toShortId } from "../../scripts/utils.js";
import { supabase } from "../../scripts/supabase.js";
import useAnimatedPresence from "../../hooks/useAnimatedPresence.js";
import useIsMobileViewport from "../../hooks/useIsMobileViewport.js";
import CompletedTaskCheckIcon from "./CompletedTaskCheckIcon.jsx";

function sortBoardTasks(list) {
    return [...list].sort((taskA, taskB) => {
        const aCompleted = taskA.task_type === "meeting" ? 0 : (taskA.done ? 1 : 0);
        const bCompleted = taskB.task_type === "meeting" ? 0 : (taskB.done ? 1 : 0);
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
        ...normalizeTaskRecord(task),
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

function toTranslate3d(transform) {
    if (!transform) return undefined;

    const x = transform.x ?? 0;
    const y = transform.y ?? 0;
    const scaleX = transform.scaleX ?? 1;
    const scaleY = transform.scaleY ?? 1;

    return `translate3d(${x}px, ${y}px, 0) scaleX(${scaleX}) scaleY(${scaleY})`;
}

function BoardTaskItem({
    task,
    index,
    onToggleDone,
    onDragStart,
    dragHandleProps = {},
    setNodeRef,
    style,
    disableNativeDrag = false,
    isDragging = false,
    isOverlay = false,
}) {
    const isDraggingRef = React.useRef(false);
    const { setTaskData } = useTaskMenu();
    const [searchParams, setSearchParams] = useSearchParams();
    const openedTask = searchParams.get("task") || searchParams.get("openedTask");
    const isMobile = useIsMobileViewport();
    const canDrag = !isMobile;
    const MAX_TASK_NAME_LENGTH = isMobile ? 54 : 58;
    const isTaskNameTruncated = task.name.length > MAX_TASK_NAME_LENGTH;
    const visibleTaskName = task.name.slice(0, MAX_TASK_NAME_LENGTH) + (isTaskNameTruncated ? "..." : "");
    const relatedLinks = Array.isArray(task.related_links) ? task.related_links : Array.isArray(task.relatedLinks) ? task.relatedLinks : [];
    const taskType = task.task_type || "task";
    const isTaskDone = taskType === "meeting" ? false : task.done;

    const taskMenuPayload = React.useMemo(() => ({
        ...task,
        color: task.color || "ds-background-surface text-ds-text-default",
        description: task.description || "",
        note_format: task.note_format || "markdown",
        note_blocks: task.note_blocks || null,
        note_plain_text: task.note_plain_text || "",
        note_migrated_at: task.note_migrated_at || null,
        relatedLinks,
        is_board_task: true,
    }), [task, relatedLinks]);

    const syncTaskMenuData = React.useCallback(() => {
        setTaskData(prev => {
            const sameTask = String(prev?.id) === String(taskMenuPayload.id)
                && prev?.name === taskMenuPayload.name
                && prev?.done === taskMenuPayload.done
                && prev?.task_type === taskMenuPayload.task_type
                && prev?.color === taskMenuPayload.color
                && prev?.description === taskMenuPayload.description
                && prev?.note_format === taskMenuPayload.note_format
                && JSON.stringify(prev?.note_blocks || null) === JSON.stringify(taskMenuPayload.note_blocks || null)
                && prev?.note_plain_text === taskMenuPayload.note_plain_text
                && prev?.note_migrated_at === taskMenuPayload.note_migrated_at;

            if (sameTask) return prev;
            return taskMenuPayload;
        });
    }, [setTaskData, taskMenuPayload]);

    function openTaskMenu(ev) {
        ev.stopPropagation();
        if (isDraggingRef.current || isDragging) return;

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
            ref={setNodeRef}
            style={style}
            className={`group agenda-accent-hover-border task-row-border task-item-row planner-task-shell w-full border-b transition-colors duration-150 dark:border-gray-700 ${isDragging ? "planner-task-shell--dragging" : ""} ${isOverlay ? "planner-task-shell--overlay" : ""}`}
            data-ind={index}
            data-task-id={task.id}
            {...dragHandleProps}
            {...(disableNativeDrag ? {} : {
                draggable: canDrag,
                onDragStart: ev => {
                    if (!canDrag) return;
                    isDraggingRef.current = true;
                    onDragStart?.(ev, task.id);
                },
                onDragEnd: () => {
                    setTimeout(() => {
                        isDraggingRef.current = false;
                    }, 0);
                },
            })}
        >
            <div className={`task flex items-center justify-between h-[41px] px-0 ${canDrag ? "cursor-grab" : "cursor-default"}`}>
                <button
                    type="button"
                    className={`relative min-w-0 flex-1 text-left ${isTaskNameTruncated ? "group/task-title" : ""}`}
                    onClick={openTaskMenu}
                >
                    <h5 className={`task-title min-w-0 flex items-center gap-1 px-0 py-0 text-[16px] font-normal leading-[22px] lg:text-[14px] lg:leading-[41px] ${isTaskDone ? "opacity-40 line-through" : ""}`}>
                        {task.description && <StickerSquare className="h-4 w-4 shrink-0" />}
                        {relatedLinks.length > 0 && <Attachment02 className="h-4 w-4 shrink-0" />}
                        <span className="block min-w-0 truncate">{visibleTaskName}</span>
                    </h5>
                    {isTaskNameTruncated && (
                        <p className="pointer-events-none absolute bottom-[120%] left-1/2 z-20 w-max max-w-[16rem] -translate-x-[50%] rounded-ds-sm tooltip-surface p-2 text-left ds-type-caption opacity-0 transition-opacity delay-0 duration-150 ease-linear whitespace-normal break-words group-hover/task-title:opacity-100 group-hover/task-title:delay-[700ms]">
                            {task.name}
                        </p>
                    )}
                </button>
                {taskType !== "meeting" && (
                    <button
                        type="button"
                        className="toggle-done ml-2 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 max-lg:opacity-100"
                        onClick={ev => {
                            ev.stopPropagation();
                            onToggleDone(task.id);
                        }}
                        aria-label={isTaskDone ? "Marcar tarefa como pendente" : "Marcar tarefa como concluída"}
                    >
                        {isTaskDone ? (
                            <CompletedTaskCheckIcon className="h-5 w-5 opacity-50" />
                        ) : (
                            <CheckCircle className="h-5 w-5" />
                        )}
                    </button>
                )}
                {taskType === "meeting" && (
                    <span
                        aria-hidden="true"
                        className="toggle-done ml-2 shrink-0 inline-block h-5 w-5 opacity-0"
                    />
                )}
            </div>
        </div>
    );
}

function SortableBoardTaskItem({ task, index, columnId, onToggleDone }) {
    const containerId = `board:${columnId}`;
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: String(task.id),
        data: {
            zone: "board",
            type: "task",
            taskId: String(task.id),
            containerId,
            columnId: String(columnId),
            index,
            task,
        },
    });

    return (
        <BoardTaskItem
            task={task}
            index={index}
            onToggleDone={onToggleDone}
            setNodeRef={setNodeRef}
            style={{
                transform: toTranslate3d(transform),
                transition,
            }}
            dragHandleProps={{ ...attributes, ...listeners }}
            disableNativeDrag
            isDragging={isDragging}
        />
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
    dndEnabled = false,
    activeTaskId = null,
}) {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const { isMounted: isMenuMounted, isVisible: isMenuVisible } = useAnimatedPresence(isMenuOpen);
    const [draftTitle, setDraftTitle] = React.useState(typeof column.title === "string" ? column.title : "");
    const menuRef = React.useRef(null);
    const inputRef = React.useRef(null);
    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
        id: `board-column-${column.id}`,
        data: {
            zone: "board",
            type: "column",
            containerId: `board:${column.id}`,
            columnId: String(column.id),
            itemCount: tasks.length,
        },
        disabled: !dndEnabled,
    });
    const isDropActive = dndEnabled ? isOver && activeTaskId !== null && tasks.length === 0 : false;

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

    return (
        <div ref={setDroppableRef}
            className={`task-list flex w-full min-w-0 flex-col rounded-[20px] bg-transparent ${isDropActive ? "planner-task-list--drop-active" : ""}`}>
            <div className="relative" ref={menuRef}>
                <div className="group flex items-start justify-between gap-3 py-3 border-b-2 border-ds-text-default/30">
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
                        className="min-w-0 flex-1 bg-transparent text-[18px] font-bold leading-[28px] tracking-[-0.5px] text-ds-text-default/30 outline-none lg:text-[21px]"
                        aria-label="Título da coluna"
                    />
                    <div className="relative group/board-column-actions">
                        <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ds-text-default opacity-0 transition-opacity duration-150 hover:bg-ds-background-surface-muted group-hover:opacity-100"
                            onClick={() => setIsMenuOpen(prev => !prev)}
                            aria-label={t(language, "boardColumnActions")}
                        >
                            <DotsVertical className="h-5 w-5" />
                        </button>
                        <p className="pointer-events-none absolute left-1/2 top-[120%] -translate-x-[50%] whitespace-nowrap opacity-0 transition ease-linear duration-200 text-ds-text-inverse tooltip-surface ds-type-caption p-1 z-50 group-hover/board-column-actions:opacity-100">
                            {t(language, "boardColumnActions")}
                        </p>
                    </div>

                    {isMenuMounted && (
                        <div className="board-column-menu animated-option-menu option-menu-surface" data-state={isMenuVisible ? "open" : "closed"}>
                            {canMoveLeft && (
                                <button
                                    type="button"
                                    className="board-column-menu-item"
                                    onClick={() => {
                                        onMoveLeft(column.id);
                                        setIsMenuOpen(false);
                                    }}
                                >
                                    <ChevronLeft className="h-4 w-4 shrink-0" />
                                    <span>{t(language, "boardColumnMoveLeft")}</span>
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
                                    <ChevronRight className="h-4 w-4 shrink-0" />
                                    <span>{t(language, "boardColumnMoveRight")}</span>
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
                                <Plus className="h-4 w-4 shrink-0" />
                                <span>{t(language, "boardColumnAdd")}</span>
                            </button>
                            {canDelete && (
                                <button
                                    type="button"
                                    className="board-column-menu-item is-danger"
                                    onClick={() => {
                                        onDeleteColumn(column.id);
                                        setIsMenuOpen(false);
                                    }}
                                >
                                    <Trash03 className="h-4 w-4 shrink-0" />
                                    <span>{t(language, "boardColumnDelete")}</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
                {dndEnabled ? (
                    <SortableContext
                        items={tasks.map(task => String(task.id))}
                        strategy={verticalListSortingStrategy}
                    >
                        {tasks.map((task, taskIndex) => (
                            <SortableBoardTaskItem
                                key={task.id}
                                task={task}
                                index={taskIndex}
                                columnId={column.id}
                                onToggleDone={onToggleTaskDone}
                            />
                        ))}
                    </SortableContext>
                ) : (
                    tasks.map((task, taskIndex) => (
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
                    ))
                )}

                <form className="add-task" onSubmit={ev => ev.preventDefault()}>
                    <input
                        ref={inputRef}
                        type="text"
                        name="add-task-name"
                        onBlur={handleFocusOut}
                        onKeyDown={handleKeyDown}
                        placeholder=""
                        className="task-field-border-bottom task-row-border relative z-10 h-[41px] w-full bg-transparent p-0 text-[16px] leading-[22px] text-ds-text-default outline-none transition-colors duration-150 lg:text-[14px] lg:leading-[41px]"
                        aria-label="Adicionar tarefa na coluna"
                    />
                </form>

                {Array.from({ length: Math.max(0, 6 - tasks.length) }, (_, emptyIndex) => (
                    <div
                        className="task-row-border h-[41px] w-full border-b bg-transparent"
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

export default function BoardViewContainer({
    dndEnabled = false,
    activeTaskId = null,
    onRegisterDndApi,
}) {
    const { currentUser } = useAuth();
    const language = getAppLanguage(currentUser?.language);
    const agendaId = currentUser?.currentAgendaId || null;

    const [columns, setColumns] = React.useState([]);
    const [tasks, setTasks] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [minLoadingDone, setMinLoadingDone] = React.useState(false);
    const [pendingDeleteColumn, setPendingDeleteColumn] = React.useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
    const [isDeletingColumn, setIsDeletingColumn] = React.useState(false);
    const [deleteColumnError, setDeleteColumnError] = React.useState("");
    const columnsRef = React.useRef([]);
    const tasksRef = React.useRef([]);
    const columnsFetchTimeoutRef = React.useRef(null);
    const tasksFetchTimeoutRef = React.useRef(null);
    const deleteModalRef = React.useRef(null);
    const deleteConfirmButtonRef = React.useRef(null);
    const deleteCancelButtonRef = React.useRef(null);
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

    useEffect(() => {
        function handleKeyDown(ev) {
            if (!isDeleteModalOpen) return;

            if (ev.key === "Escape") {
                if (isDeletingColumn) return;
                ev.preventDefault();
                closeDeleteColumnModal();
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
    }, [isDeleteModalOpen, isDeletingColumn]);

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
                        ...normalizeTaskRecord({
                            ...task,
                            ...updates,
                            date: updates.date ? parseDateOnly(updates.date) : task.date,
                        }),
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

    function openDeleteColumnModal(columnId) {
        const column = columnsRef.current.find(item => String(item.id) === String(columnId));
        if (!column || columnsRef.current.length <= 1) return;

        setPendingDeleteColumn(column);
        setDeleteColumnError("");
        setIsDeleteModalOpen(true);
    }

    function closeDeleteColumnModal() {
        if (isDeletingColumn) return;
        setIsDeleteModalOpen(false);
        setPendingDeleteColumn(null);
        setDeleteColumnError("");
    }

    async function deleteColumn(columnId) {
        const current = [...columnsRef.current];
        if (current.length <= 1) return;

        const index = current.findIndex(column => String(column.id) === String(columnId));
        if (index < 0) return;

        const nextColumns = current
            .filter(column => String(column.id) !== String(columnId))
            .map((column, nextIndex) => ({
                ...column,
                sort_order: nextIndex,
            }));

        const remainingTasks = tasksRef.current.filter(
            task => String(task.board_column_id || "") !== String(columnId)
        );

        applyColumns(nextColumns);
        applyTasks(remainingTasks);

        try {
            let deleteTasksQuery = supabase
                .from("tasks")
                .delete()
                .eq("agenda_id", agendaId)
                .eq("is_board_task", true)
                .eq("board_column_id", columnId);

            if (currentUser?.uid) {
                deleteTasksQuery = deleteTasksQuery.eq("uid", currentUser.uid);
            }

            const { error: deleteTasksError } = await deleteTasksQuery;
            if (deleteTasksError) throw deleteTasksError;

            await deleteBoardColumn(columnId);
            await Promise.all(
                nextColumns.map((column, nextIndex) =>
                    updateBoardColumn(column.id, { sort_order: nextIndex })
                )
            );
        } catch {
            await reloadColumns(false);
            await reloadTasks();
            throw new Error(t(language, "boardColumnDeleteError"));
        }
    }

    async function handleConfirmDeleteColumn() {
        if (!pendingDeleteColumn?.id) return;

        setIsDeletingColumn(true);
        setDeleteColumnError("");

        try {
            await deleteColumn(pendingDeleteColumn.id);
            setIsDeleteModalOpen(false);
            setPendingDeleteColumn(null);
        } catch (error) {
            setDeleteColumnError(error?.message || t(language, "boardColumnDeleteError"));
        } finally {
            setIsDeletingColumn(false);
        }
    }

    async function createTaskInColumn(columnId, taskName) {
        const nextName = String(taskName || "").trim();
        if (!nextName || !currentUser?.uid || !agendaId) return;

        const boardOrder = getColumnTasks(columnId).length;
        const result = await tryCatchDecorator(createTask)({
            name: nextName,
            color: "ds-background-surface text-ds-text-default",
            date: formDate(new Date()),
            uid: currentUser.uid,
            agenda_id: agendaId,
            done: false,
            task_type: "task",
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

    async function toggleTaskDone(taskId) {
        const task = tasksRef.current.find(item => String(item.id) === String(taskId));
        if (task?.task_type === "meeting") return;

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

    function getRenderedTaskContainers(taskId, sourceTasks = tasksRef.current) {
        const normalizedTaskId = String(taskId);
        return columnsRef.current
            .filter(column => sourceTasks.some(task => (
                String(task.id) === normalizedTaskId
                && String(task.board_column_id) === String(column.id)
                && task.is_board_task !== false
            )))
            .map(column => `board:${String(column.id)}`);
    }

    async function persistBoardTaskOrdering(columnIds) {
        const uniqueColumnIds = [...new Set(columnIds.filter(Boolean).map(columnId => String(columnId)))];
        if (uniqueColumnIds.length === 0) return;

        const affectedTasks = uniqueColumnIds.flatMap(columnId =>
            getColumnTasks(columnId).map((task, index) => ({
                ...task,
                is_board_task: true,
                board_column_id: columnId,
                board_order: index,
            }))
        );

        const unaffectedTasks = tasksRef.current.filter(task => (
            !uniqueColumnIds.includes(String(task.board_column_id || ""))
        ));

        applyTasks([...unaffectedTasks, ...affectedTasks]);

        await Promise.all(
            affectedTasks.map(task =>
                updateTask(task.id, {
                    is_board_task: true,
                    board_column_id: task.board_column_id,
                    board_order: task.board_order,
                })
            )
        );

        return affectedTasks;
    }

    function normalizeBoardDropTask(task, columnId, boardOrder) {
        return {
            ...task,
            is_board_task: true,
            board_column_id: columnId,
            board_order: boardOrder,
        };
    }

    function getSafeBoardInsertIndex(tasksInColumn, targetIndex) {
        if (!Number.isInteger(targetIndex)) return tasksInColumn.length;
        return Math.max(0, Math.min(targetIndex, tasksInColumn.length));
    }

    async function assignTaskToColumn(taskId, columnId, targetIndex = null) {
        if (!taskId || !columnId) return null;

        const taskToMove = tasksRef.current.find(task => String(task.id) === String(taskId))
            || await getTaskById(taskId).catch(() => null);
        if (!taskToMove) return null;

        const taskIsBoardTask = taskToMove.is_board_task !== false;
        const sourceColumnId = String(taskToMove.board_column_id || "");
        const destinationColumnId = String(columnId);
        const destinationBaseTasks = sortBoardTasks(
            tasksRef.current.filter(task => (
                String(task.board_column_id) === destinationColumnId && String(task.id) !== String(taskId)
            ))
        );
        const destinationTasks = taskIsBoardTask && sourceColumnId === destinationColumnId
            ? sortBoardTasks(
                tasksRef.current.filter(task => (
                    String(task.board_column_id) === destinationColumnId && String(task.id) !== String(taskId)
                ))
            )
            : destinationBaseTasks;
        const safeInsertIndex = getSafeBoardInsertIndex(destinationTasks, targetIndex);
        const movedTask = normalizeBoardDropTask(taskToMove, destinationColumnId, safeInsertIndex);
        const reorderedDestinationTasks = [...destinationTasks];
        reorderedDestinationTasks.splice(safeInsertIndex, 0, movedTask);

        const normalizedDestinationTasks = reorderedDestinationTasks.map((task, nextIndex) => (
            normalizeBoardDropTask(task, destinationColumnId, nextIndex)
        ));

        const sourceTasks = taskIsBoardTask
            ? sortBoardTasks(
                tasksRef.current.filter(task => (
                    String(task.board_column_id) === sourceColumnId && String(task.id) !== String(taskId)
                ))
            ).map((task, nextIndex) => normalizeBoardDropTask(task, sourceColumnId, nextIndex))
            : [];

        const unaffectedTasks = tasksRef.current.filter(task => {
            const taskColumnId = String(task.board_column_id || "");
            if (!taskIsBoardTask) return taskColumnId !== destinationColumnId;
            if (sourceColumnId === destinationColumnId) return taskColumnId !== destinationColumnId;
            return taskColumnId !== sourceColumnId && taskColumnId !== destinationColumnId;
        });

        const nextTasks = sortBoardTasks([
            ...unaffectedTasks,
            ...(sourceColumnId === destinationColumnId ? [] : sourceTasks),
            ...normalizedDestinationTasks,
        ]);

        applyTasks(nextTasks);

        try {
            const affectedColumnIds = sourceColumnId === destinationColumnId
                ? [destinationColumnId]
                : [sourceColumnId, destinationColumnId];
            const affectedTasks = await persistBoardTaskOrdering(affectedColumnIds);
            const persistedMovedTask = (affectedTasks || []).find(task => String(task.id) === String(taskId));

            if (persistedMovedTask) {
                dispatchTaskUpdatedLocal(taskId, {
                    is_board_task: true,
                    board_column_id: persistedMovedTask.board_column_id,
                    board_order: persistedMovedTask.board_order,
                });
            }

            return {
                operation: taskIsBoardTask
                    ? (sourceColumnId === destinationColumnId ? "reorder same container" : "move board → board")
                    : "move week → board",
                payload: {
                    taskId: String(taskId),
                    sourceContainerId: taskIsBoardTask ? `board:${sourceColumnId}` : "week:external",
                    targetContainerId: `board:${destinationColumnId}`,
                    targetIndex: safeInsertIndex,
                    persistedTask: persistedMovedTask || movedTask,
                },
            };
        } catch {
            await reloadTasks();
            return null;
        }
    }

    async function commitTaskDrop({ activeId, target }) {
        const destinationColumnId = String(target?.columnId || "");
        if (!destinationColumnId) return null;

        const targetIndex = getSafeBoardInsertIndex(
            getColumnTasks(destinationColumnId).filter(task => String(task.id) !== String(activeId)),
            target?.index
        );

        return assignTaskToColumn(activeId, destinationColumnId, targetIndex);
    }

    useEffect(() => {
        if (!onRegisterDndApi) return;

        onRegisterDndApi({
            commitDrop: args => commitTaskDrop(args),
            getRenderedTaskContainers: taskId => getRenderedTaskContainers(taskId),
        });

        return () => {
            onRegisterDndApi(null);
        };
    }, [onRegisterDndApi, columns.length, tasks.length, agendaId]);

    if (loading || !minLoadingDone) {
        return null;
    }

    return (
        <>
            <div className="w-full padding-x py-4 text-ds-text-default lg:mt-0 lg:pt-10">
                <div className="flex flex-col gap-6 lg:grid lg:grid-cols-4">
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
                            onDeleteColumn={openDeleteColumnModal}
                            onAddColumn={addColumnAfter}
                            onCreateTask={createTaskInColumn}
                            onAssignTask={assignTaskToColumn}
                            onToggleTaskDone={toggleTaskDone}
                            dndEnabled={dndEnabled}
                            activeTaskId={activeTaskId}
                        />
                    ))}
                </div>
            </div>

            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto overscroll-contain px-4 pb-10 pt-16 ds-overlay" onClick={closeDeleteColumnModal}>
                    <div
                        ref={deleteModalRef}
                        className="ds-modal-shell relative mb-6 w-[32rem] max-w-full px-6 py-7"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-board-column-modal-title"
                        aria-describedby="delete-board-column-modal-description"
                        onClick={ev => ev.stopPropagation()}
                    >
                        <h4 id="delete-board-column-modal-title" className="ds-type-h4 text-ds-text-default">
                            {t(language, "boardColumnDeleteConfirmTitle")}
                        </h4>
                        <p id="delete-board-column-modal-description" className="ds-type-body mt-3 text-ds-text-default">
                            {t(language, "boardColumnDeleteConfirmMessage")}
                        </p>

                        {deleteColumnError && (
                            <p className="ds-alert ds-alert-danger mt-3">
                                {deleteColumnError}
                            </p>
                        )}

                        <div className="mt-5 flex items-center gap-3">
                            <button
                                ref={deleteConfirmButtonRef}
                                type="button"
                                disabled={isDeletingColumn}
                                onClick={handleConfirmDeleteColumn}
                                className="app-button-hover ds-button-danger bg-ds-danger-solid text-ds-text-inverse ds-type-body rounded-full px-6 py-2 font-bold disabled:opacity-20"
                            >
                                {t(language, "confirmDeleteBoardColumn")}
                            </button>
                            <button
                                ref={deleteCancelButtonRef}
                                type="button"
                                disabled={isDeletingColumn}
                                onClick={closeDeleteColumnModal}
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
