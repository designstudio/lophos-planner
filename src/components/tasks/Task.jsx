import React, {useEffect} from 'react'
import TaskMenu from "./TaskMenu.jsx";
import {Form, useSearchParams } from "react-router-dom";
import {createTask, toggleDoneTask, tryCatchDecorator} from "../../scripts/api.js";
import {useAuth} from "../../contexts/AuthContext.jsx";
import {useTaskMenu} from "../../contexts/TaskMenuContext.jsx";
import { matchesShortId, toShortId, openForm } from "../../scripts/utils.js";
import {ALLOWED_COLORS} from "./TaskMenuColorPicker.jsx";
import { StickerSquare, CheckCircle, Attachment02 } from "@untitledui/icons";

function formDate(date) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

export default function Task({taskListInd, ind, data, date, tasksCol, relatedLinksEnabled = true}) {
    const isMobile = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 1023px)").matches;
    const MAX_TASK_NAME_LENGTH = isMobile ? 40 : 34;
    const isDraggingRef = React.useRef(false);
    const isTaskNameTruncated = data.name.length > MAX_TASK_NAME_LENGTH;
    const visibleTaskName = data.name.slice(0, MAX_TASK_NAME_LENGTH) +
        (isTaskNameTruncated ? "..." : "");

    const [searchParams, setSearchParams] = useSearchParams();
    const openedTask = searchParams.get("task") || searchParams.get("openedTask");

    async function handleToggleDone(ev) {
        ev.stopPropagation();
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
                && prev?.color === taskMenuPayload.color
                && prev?.description === taskMenuPayload.description
                && String(prev?.date) === String(taskMenuPayload.date);

            if (sameTask && sameLinks) {
                return prev;
            }

            return taskMenuPayload;
        });
    }, [setTaskData, taskMenuPayload]);

    function openTaskMenu(ev) {
        ev.stopPropagation();
        if (isDraggingRef.current) return;

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


    return (
        <div className="group agenda-accent-hover-border task-row-border task-item-row w-full border-b transition-colors duration-150 dark:border-gray-700" data-ind={ind} data-task-id={data.id} draggable
             onDragStart={ev => {
                 isDraggingRef.current = true;
                 ev.dataTransfer.setData("text/plain", String(data.id));
                 ev.dataTransfer.effectAllowed = "move";
             }}
             onDragEnd={() => {
                 setTimeout(() => {
                     isDraggingRef.current = false;
                 }, 0);
             }}>
            <div className="task flex justify-between items-center h-[41px] px-0 cursor-grab" onClick={openTaskMenu}>
                <div className={`relative min-w-0 flex-1 ${isTaskNameTruncated ? "group/task-title" : ""}`}>
                    <h5 className={`task-title min-w-0 flex items-center gap-1 px-0 py-0 text-[14px] font-normal leading-[41px] bg-${ALLOWED_COLORS.has(data.color) ? data.color : "white text-black dark:text-white dark:bg-black"} ` + (data.done && "opacity-40 line-through ") || ''}>
                        { data.description && <StickerSquare className="h-4 w-4 shrink-0" /> }
                        { relatedLinksEnabled && relatedLinks.length > 0 && <Attachment02 className="h-4 w-4 shrink-0" /> }
                        <span className="block min-w-0 truncate">{visibleTaskName}</span>
                    </h5>
                    {isTaskNameTruncated && (
                        <p className="pointer-events-none absolute bottom-[120%] left-1/2 z-20 w-max max-w-[16rem] -translate-x-[50%] rounded bg-gray-800 p-2 text-left text-xs leading-4 text-white opacity-0 transition-opacity delay-0 duration-150 ease-linear whitespace-normal break-words group-hover/task-title:opacity-100 group-hover/task-title:delay-[700ms]">
                            {data.name}
                        </p>
                    )}
                </div>
                <button className="toggle-done ml-2 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 max-lg:opacity-100" onClick={handleToggleDone}>
                    <CheckCircle className={`h-5 w-5 ${data.done ? "opacity-50" : ""}`} />
                </button>

            </div>
        </div>
    )
}
