import React from 'react'
import Task from './Task.jsx';
import {useAuth} from "../../contexts/AuthContext.jsx";
import {createTask, tryCatchDecorator} from "../../scripts/api.js";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {Form} from "react-router-dom";
import {formDate, toInputDateValue} from "../../scripts/utils.js";
import { formatDayMonth, getAppLanguage, getLocale, t } from "../../scripts/i18n.js";
import { Umbrella03 } from "@untitledui/icons";
import useIsMobileViewport from "../../hooks/useIsMobileViewport.js";

function toTranslate3d(transform) {
    if (!transform) return undefined;

    const x = transform.x ?? 0;
    const y = transform.y ?? 0;
    const scaleX = transform.scaleX ?? 1;
    const scaleY = transform.scaleY ?? 1;

    return `translate3d(${x}px, ${y}px, 0) scaleX(${scaleX}) scaleY(${scaleY})`;
}

function SortableTaskItem({ task, ind, date, taskListInd, relatedLinksEnabled }) {
    const containerId = `week:${taskListInd}`;
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
            zone: "week",
            type: "task",
            taskId: String(task.id),
            containerId,
            columnIndex: taskListInd,
            containerIndex: taskListInd,
            dateKey: formDate(date),
            index: ind,
            task,
        },
    });

    const style = {
        transform: toTranslate3d(transform),
        transition,
    };

    return (
        <Task
            key={task.id}
            data={task}
            taskListInd={taskListInd}
            date={date}
            tasksCol={0}
            ind={ind}
            relatedLinksEnabled={relatedLinksEnabled}
            setNodeRef={setNodeRef}
            style={style}
            dragHandleProps={{ ...attributes, ...listeners }}
            disableNativeDrag
            isDragging={isDragging}
        />
    );
}

const TaskList = ({
    date,
    active,
    last,
    maxTasks,
    tasksData,
    ind,
    moveTaskToColumn,
    holidayName = "",
    activeTaskId = null,
    dndEnabled = false,
}) => {

    const {currentUser, agendas} = useAuth();
    const isMobile = useIsMobileViewport();
    const language = getAppLanguage(currentUser?.language);
    const dateFormat = currentUser?.dateFormat || "DD-MM";
    const currentAgenda = agendas?.find(agenda => String(agenda.id) === String(currentUser?.currentAgendaId));
    const relatedLinksEnabled = currentAgenda?.related_links_enabled ?? true;
    const columnDropId = `planner-column-${ind}`;
    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
        id: columnDropId,
        data: {
            zone: "week",
            type: "column",
            containerId: `week:${ind}`,
            columnIndex: ind,
            containerIndex: ind,
            dateKey: formDate(date),
            itemCount: tasksData.length,
        },
        disabled: !dndEnabled,
    });
    const isDragOver = dndEnabled ? isOver && activeTaskId !== null && tasksData.length === 0 : false;

    const getDate = date => formatDayMonth(date, language, dateFormat);

    const rawDay = new Intl.DateTimeFormat(getLocale(language), {
        weekday: "long",
    }).format(date);
    const day = language === "ptBR"
        ? rawDay.replace("-feira", "").replace(/^./, chr => chr.toUpperCase())
        : rawDay;
    const addTaskLabel = language === "ptBR" ? "Adicionar tarefa" : "Add task";

    function handleClick(ev) {
        const thisTaskList = document.querySelector(`.task-list[data-date="${date.getDate()}"]`);
        const firstInput = thisTaskList.querySelector('.add-task #add-task-name');
        firstInput.focus();
    }

    async function handleFocusOut(ev) {
        if (!ev.target.value) return;
        if (currentUser) {
            const formData = new FormData(ev.target.parentElement);
            ev.target.value = "";
            const result = await tryCatchDecorator(createTask)({
                name: formData.get("add-task-name"),
                color: "ds-background-surface text-ds-text-default",
                date: formDate(date),
                uid: currentUser.uid,
                agenda_id: currentUser.currentAgendaId,
                done: false,
                task_type: "task",
                related_links: [],
                order: tasksData.length,
            });

            if (result.success && result.data) {
                window.dispatchEvent(new CustomEvent("task-created", {
                    detail: { task: result.data },
                }));
            }
        }
    }

    async function handleKeyDown(ev) {
        if (ev.key === 'Enter') {
            const curInput = document.querySelector('input:focus');

            if (curInput.value) {
                if (currentUser) {
                    const formData = new FormData(curInput.parentElement);
                    curInput.value = "";
                    const result = await tryCatchDecorator(createTask)({
                        name: formData.get("add-task-name"),
                        color: "ds-background-surface text-ds-text-default",
                        date: formDate(date),
                        uid: currentUser.uid,
                        agenda_id: currentUser.currentAgendaId,
                        done: false,
                        task_type: "task",
                        related_links: [],
                        order: tasksData.length,
                    });

                    if (result.success && result.data) {
                        window.dispatchEvent(new CustomEvent("task-created", {
                            detail: { task: result.data },
                        }));
                    }
                } else {
                    const thisTaskList = curInput.parentElement.parentElement.parentElement;
                    if (thisTaskList.dataset.date == date.getDate()) {
                        const newTask = curInput.value
                    }
                    curInput.value = '';
                }

            }
        }
    }

    const tasksComponents = [], emptyComponents = [];
    for (let i = 0; i < tasksData.length; ++i) {
        if (dndEnabled) {
            tasksComponents.push(
                <SortableTaskItem
                    key={tasksData[i].id}
                    task={tasksData[i]}
                    taskListInd={ind}
                    date={date}
                    ind={i}
                    relatedLinksEnabled={relatedLinksEnabled}
                />
            );
            continue;
        }

        tasksComponents.push(<Task key={tasksData[i].id} data={tasksData[i]}
                                   taskListInd={ind} date={date}
                                   tasksCol={tasksData.length}
                                   ind={i}
                                   relatedLinksEnabled={relatedLinksEnabled}/>);
    }
    // Exibe apenas 1 linha vazia por dia no mobile, 10/4 no desktop
    const fixedRows = 1 + (holidayName ? 1 : 0);
    let emptyRows = 0;
    if (isMobile) {
        emptyRows = Math.max(0, 1 - fixedRows - tasksData.length);
    } else {
        emptyRows = Math.max(0, (last ? (maxTasks / 2) - 1 : maxTasks) - fixedRows - tasksData.length);
    }
    for (let i = 0; i < emptyRows; ++i) {
        emptyComponents.push(
            <div className="empty-task task-row-border h-[41px] w-full border-b bg-white dark:bg-transparent"
                 key={i}
                 onClick={handleClick}>
                <p className="opacity-0 cursor-default" onClick={handleClick}>sdasdfsdlk</p>
            </div>
        )
    }

    return (
        <div ref={setDroppableRef}
             className={`task-list flex flex-1 flex-col ${isDragOver ? "planner-task-list--drop-active" : ""}`} data-date={date.getDate()} data-list-index={ind} data-date-key={formDate(date)}
             onKeyDown={handleKeyDown}>
            <div
                className={`flex justify-between items-center py-3 border-b-2
                ${active ? "agenda-accent-border" : "border-black dark:border-ds-text-default"}`}
                style={active ? { borderColor: 'var(--agenda-accent)' } : undefined}
            >
                <h2
                    className={`ds-type-planner-column-title ${active ? "agenda-accent-text" : "text-black dark:text-ds-text-default"}`}
                    style={active ? { color: 'var(--agenda-accent)' } : undefined}
                >
                    {getDate(date)}
                </h2>
                <h3
                    className={`ds-type-planner-column-day ${active ? "agenda-accent-text opacity-50" : "text-black dark:text-ds-text-default opacity-20"}`}
                    style={active ? { color: 'var(--agenda-accent)' } : undefined}
                >
                    {day}
                </h3>
            </div>

            {holidayName && (
                <div className="task-row-border h-[41px] w-full border-b bg-white dark:bg-transparent">
                    <p className="task-holiday-item">
                        <span className="task-holiday-badge gap-1">
                            <Umbrella03 className="h-4 w-4 shrink-0" />
                            <span>{t(language, "holidayLabel")} - {holidayName}</span>
                        </span>
                    </p>
                </div>
            )}

            {isMobile ? (
                <>{tasksComponents}</>
            ) : dndEnabled ? (
                <SortableContext
                    items={tasksData.map(task => String(task.id))}
                    strategy={verticalListSortingStrategy}
                >
                    {tasksComponents}
                </SortableContext>
            ) : (
                <>{tasksComponents}</>
            )}
            <Form method="POST" className="add-task"> { /* For adding new tasks */}
                <input type="text"
                       name="add-task-name"
                       id="add-task-name"
                     className="ds-type-body-sm task-field-border-bottom task-row-border relative z-10 h-[41px] w-full bg-transparent p-0 text-black dark:text-ds-text-default outline-none transition-colors duration-150"
                       aria-label={`${addTaskLabel} ${getDate(date)}`}
                       onBlur={handleFocusOut}
                />
                <input type="text" defaultValue="add-task-form" name="form-id" id="form-id" className="hidden"/>


                <input type="date" defaultValue={toInputDateValue(date)} className="hidden" name="task-date"
                       id="task-date"/>
            </Form>
            {emptyComponents}
        </div>
    )
}

export default TaskList
