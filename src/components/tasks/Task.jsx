import React, {useEffect} from 'react'
import TaskMenu from "./TaskMenu.jsx";
import {Form, useSearchParams } from "react-router-dom";
import {createTask, toggleDoneTask, tryCatchDecorator} from "../../scripts/api.js";
import {useAuth} from "../../contexts/AuthContext.jsx";
import {useTaskMenu} from "../../contexts/TaskMenuContext.jsx";
import { matchesShortId, toShortId, openForm } from "../../scripts/utils.js";
import {ALLOWED_COLORS} from "./TaskMenuColorPicker.jsx";
import { StickerSquare, CheckCircle, Attachment02 } from "@untitledui/icons";
import useIsMobileViewport from "../../hooks/useIsMobileViewport.js";

function formDate(date) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

export default function Task({
    taskListInd,
    ind,
    data,
    date,
    tasksCol,
    relatedLinksEnabled = true,
    dragHandleProps = {},
    setNodeRef,
    style,
    disableNativeDrag = false,
    isDragging = false,
    isOverlay = false,
}) {
    const isMobile = useIsMobileViewport();
    const canDrag = !isMobile;
    const MAX_TASK_NAME_LENGTH = isMobile ? 40 : 34;
    const isDraggingRef = React.useRef(false);
    const isTaskNameTruncated = data.name.length > MAX_TASK_NAME_LENGTH;
    const visibleTaskName = data.name.slice(0, MAX_TASK_NAME_LENGTH) +
        (isTaskNameTruncated ? "..." : "");

    const [searchParams, setSearchParams] = useSearchParams();
    const openedTask = searchParams.get("task") || searchParams.get("openedTask");
    const taskType = data.task_type || "task";
    const isTaskDone = taskType === "meeting" ? false : data.done;

    async function handleToggleDone(ev) {
        ev.stopPropagation();
        if (taskType === "meeting") return;
        const nextDone = !data.done;

        window.dispatchEvent(new CustomEvent("task-updated-local", {
            detail: {
                taskId: data.id,
                updates: { done: nextDone },
            },
        }));

        const result = await tryCatchDecorator(toggleDoneTask)(data.id);
        if (!result.success) {
            window.dispatchEvent(new CustomEvent("task-updated-local", {
                detail: {
                    taskId: data.id,
                    updates: { done: data.done },
                },
            }));
        }
    }

    const { currentUser } = useAuth();

    const { setTaskData } = useTaskMenu();
    const relatedLinks = React.useMemo(
        () => normalizeRelatedLinks(data),
        [data?.relatedLinks, data?.related_links]
    );

    const taskMenuPayload = React.useMemo(() => ({
        ...data,
        relatedLinks,
    }), [
        data?.id,
        data?.name,
        data?.done,
        data?.color,
        data?.description,
        data?.note_format,
        data?.note_blocks,
        data?.note_plain_text,
        data?.note_migrated_at,
        data?.date,
        relatedLinks,
    ]);

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

    const syncTaskMenuData = React.useCallback(() => {
        setTaskData(prev => {
            const prevLinks = Array.isArray(prev?.relatedLinks) ? prev.relatedLinks : [];
            const nextLinks = taskMenuPayload.relatedLinks;
            const sameLinks = prevLinks.length === nextLinks.length
                && prevLinks.every((link, index) => (
                    link?.name === nextLinks[index]?.name && link?.url === nextLinks[index]?.url
                ));

            const sameTask = String(prev?.id) === String(taskMenuPayload.id)
                && prev?.name === taskMenuPayload.name
                && prev?.done === taskMenuPayload.done
                && prev?.task_type === taskMenuPayload.task_type
                && prev?.color === taskMenuPayload.color
                && prev?.description === taskMenuPayload.description
                && prev?.note_format === taskMenuPayload.note_format
                && JSON.stringify(prev?.note_blocks || null) === JSON.stringify(taskMenuPayload.note_blocks || null)
                && prev?.note_plain_text === taskMenuPayload.note_plain_text
                && prev?.note_migrated_at === taskMenuPayload.note_migrated_at
                && String(prev?.date) === String(taskMenuPayload.date);

            if (sameTask && sameLinks) {
                return prev;
            }

            return taskMenuPayload;
        });
    }, [setTaskData, taskMenuPayload]);

    function openTaskMenu(ev) {
        ev.stopPropagation();
        if (isDraggingRef.current || isDragging) return;

        if (openedTask && matchesShortId(data.id, openedTask)) {
            syncTaskMenuData();
            openForm("task-menu");
            return;
        }

        setSearchParams(prevParams => {
            const nextParams = new URLSearchParams(prevParams);
            nextParams.delete("openedTask");
            nextParams.set("task", toShortId(data.id));
            return nextParams;
        });

        syncTaskMenuData();
    }

    useEffect(() => {
        if (openedTask && matchesShortId(data.id, openedTask)) {
            syncTaskMenuData();
        }
    }, [openedTask, data?.id, syncTaskMenuData]);


    const nativeDragProps = disableNativeDrag ? {} : {
        draggable: canDrag,
        onDragStart: ev => {
            if (!canDrag) return;
            isDraggingRef.current = true;
            ev.dataTransfer.setData("text/plain", String(data.id));
            ev.dataTransfer.effectAllowed = "move";
        },
        onDragEnd: () => {
            setTimeout(() => {
                isDraggingRef.current = false;
            }, 0);
        },
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group agenda-accent-hover-border task-row-border task-item-row planner-task-shell w-full border-b transition-colors duration-150 dark:border-gray-700 ${isDragging ? "planner-task-shell--dragging" : ""} ${isOverlay ? "planner-task-shell--overlay" : ""}`}
            data-ind={ind}
            data-task-id={data.id}
            {...dragHandleProps}
            {...nativeDragProps}
        >
            <div className={`task flex justify-between items-center h-[41px] px-0 ${canDrag ? "cursor-grab" : "cursor-default"}`}>
                <button
                    type="button"
                    className={`relative min-w-0 flex-1 text-left ${isTaskNameTruncated ? "group/task-title" : ""}`}
                    onClick={openTaskMenu}
                >
                    <h5 className={`task-title min-w-0 flex items-center gap-1 px-0 py-0 text-[16px] font-normal leading-[22px] lg:text-[14px] lg:leading-[41px] bg-${ALLOWED_COLORS.has(data.color) ? data.color : "ds-background-surface text-ds-text-default"} ` + (isTaskDone && "opacity-40 line-through ") || ''}>
                        { data.description && <StickerSquare className="h-4 w-4 shrink-0" /> }
                        { relatedLinksEnabled && relatedLinks.length > 0 && <Attachment02 className="h-4 w-4 shrink-0" /> }
                        <span className="block min-w-0 truncate">{visibleTaskName}</span>
                    </h5>
                    {isTaskNameTruncated && (
                        <p className="pointer-events-none absolute bottom-[120%] left-1/2 z-20 w-max max-w-[16rem] -translate-x-[50%] rounded-ds-sm tooltip-surface p-2 text-left ds-type-caption opacity-0 transition-opacity delay-0 duration-150 ease-linear whitespace-normal break-words group-hover/task-title:opacity-100 group-hover/task-title:delay-[700ms]">
                            {data.name}
                        </p>
                    )}
                </button>
                {taskType !== "meeting" && (
                    <button
                        type="button"
                        className="toggle-done ml-2 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 max-lg:opacity-100"
                        onClick={handleToggleDone}
                        aria-label={isTaskDone ? "Marcar tarefa como pendente" : "Marcar tarefa como concluída"}
                    >
                        <CheckCircle className={`h-5 w-5 ${isTaskDone ? "opacity-50" : ""}`} />
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
    )
}
