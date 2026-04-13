import React from 'react'
import Task from './Task.jsx';
import {useAuth} from "../../contexts/AuthContext.jsx";
import {createTask, tryCatchDecorator} from "../../scripts/api.js";
import {ReactSortable} from "react-sortablejs";
import {Form} from "react-router-dom";
import {formDate, toInputDateValue} from "../../scripts/utils.js";
import { formatDayMonth, getAppLanguage, getLocale, t } from "../../scripts/i18n.js";

const TaskList = ({date, active, last, maxTasks, tasksData, ind, updateColumnTasks, persistColumns, moveTaskToColumn, holidayName = ""}) => {

    const {currentUser} = useAuth();
    const language = getAppLanguage(currentUser?.language);
    const dateFormat = currentUser?.dateFormat || "DD-MM";
    const [isDragOver, setIsDragOver] = React.useState(false);

    const getDate = date => formatDayMonth(date, language, dateFormat);

    const rawDay = new Intl.DateTimeFormat(getLocale(language), {
        weekday: "long",
    }).format(date);
    const day = language === "ptBR"
        ? rawDay.replace("-feira", "").replace(/^./, chr => chr.toUpperCase())
        : rawDay;

    function handleClick(ev) {
        const thisTaskList = document.querySelector(`.task-list[data-date="${date.getDate()}"]`);
        const firstInput = thisTaskList.querySelector('.add-task #add-task-name');
        firstInput.focus();
    }

    function handleDragOver(ev) {
        const taskId = ev.dataTransfer?.getData("text/plain");
        if (!taskId) return;
        ev.preventDefault();
        setIsDragOver(true);
    }

    function handleDragLeave(ev) {
        if (!ev.currentTarget.contains(ev.relatedTarget)) {
            setIsDragOver(false);
        }
    }

    async function handleDrop(ev) {
        const taskId = ev.dataTransfer?.getData("text/plain");
        setIsDragOver(false);
        if (!taskId) return;

        ev.preventDefault();
        await moveTaskToColumn(taskId, ind)();
    }

    async function handleFocusOut(ev) {
        if (!ev.target.value) return;
        if (currentUser) {
            const formData = new FormData(ev.target.parentElement);
            ev.target.value = "";
            const result = await tryCatchDecorator(createTask)({
                name: formData.get("add-task-name"),
                color: "white text-black dark:text-white dark:bg-black",
                date: formDate(date),
                uid: currentUser.uid,
                agenda_id: currentUser.currentAgendaId,
                done: false,
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
                        color: "white text-black dark:text-white dark:bg-black",
                        date: formDate(date),
                        uid: currentUser.uid,
                        agenda_id: currentUser.currentAgendaId,
                        done: false,
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
        tasksComponents.push(<Task key={tasksData[i].id} data={tasksData[i]}
                                   taskListInd={ind} date={date}
                                   tasksCol={tasksData.length}
                                   ind={i}/>);
    }
    // Exibe apenas 1 linha vazia por dia no mobile, 10/4 no desktop
    const isMobile = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 1023px)").matches;
    const fixedRows = 1 + (holidayName ? 1 : 0);
    let emptyRows = 0;
    if (isMobile) {
        emptyRows = Math.max(0, 1 - fixedRows - tasksData.length);
    } else {
        emptyRows = Math.max(0, (last ? (maxTasks / 2) - 1 : maxTasks) - fixedRows - tasksData.length);
    }
    for (let i = 0; i < emptyRows; ++i) {
        emptyComponents.push(
            <div className="empty-task task-row-border h-[41px] w-full border-b bg-white dark:border-gray-700 dark:bg-black"
                 key={i}
                 onClick={handleClick}>
                <p className="opacity-0 cursor-default" onClick={handleClick}>sdasdfsdlk</p>
            </div>
        )
    }

    return (
        <div className={`task-list flex flex-1 flex-col ${isDragOver ? "agenda-accent-soft-bg" : ""}`} data-date={date.getDate()} data-list-index={ind} data-date-key={formDate(date)}
             onDragOver={handleDragOver}
             onDragEnter={handleDragOver}
             onDragLeave={handleDragLeave}
             onDrop={handleDrop}
             onKeyDown={handleKeyDown}>
            <div
                className={`flex justify-between items-center py-3 border-b-2
                ${active ? "agenda-accent-border" : "border-black dark:border-white"}`}
                style={active ? { borderColor: 'var(--agenda-accent)' } : undefined}
            >
                <h2
                    className={`text-[21px] font-bold leading-[28px] tracking-[-0.5px] ${active ? "agenda-accent-text" : "text-black dark:text-white"}`}
                    style={active ? { color: 'var(--agenda-accent)' } : undefined}
                >
                    {getDate(date)}
                </h2>
                <h3
                    className={`text-[21px] font-normal leading-[28px] tracking-[-0.5px] ${active ? "agenda-accent-text opacity-50" : "text-black dark:text-white opacity-20"}`}
                    style={active ? { color: 'var(--agenda-accent)' } : undefined}
                >
                    {day}
                </h3>
            </div>

            {holidayName && (
                <div className="task-row-border h-[41px] w-full border-b bg-white dark:border-gray-700 dark:bg-black">
                    <p className="task-holiday-item">
                        <span className="task-holiday-badge">{t(language, "holidayLabel")} - {holidayName}</span>
                    </p>
                </div>
            )}

            <ReactSortable list={tasksData} setList={nextList => updateColumnTasks(ind, nextList)}
                           group={{ name: "tasks", pull: true, put: true }}
                           onEnd={ev => {
                               const fromListInd = Number(ev.from.closest(".task-list")?.dataset.listIndex);
                               const toListInd = Number(ev.to.closest(".task-list")?.dataset.listIndex);
                               persistColumns([fromListInd, toListInd])();
                           }}
                           ghostClass="sortable-ghost"
                           chosenClass="sortable-chosen"
                           dragClass="sortable-drag"

            >
                {tasksComponents}
            </ReactSortable>
            <Form method="POST" className="add-task"> { /* For adding new tasks */}
                <input type="text"
                       name="add-task-name"
                       id="add-task-name"
                     className="task-field-border-bottom task-row-border relative z-10 h-[41px] w-full bg-transparent p-0 text-[14px] text-black outline-none transition-colors duration-150 dark:bg-transparent dark:text-white"
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
