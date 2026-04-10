import React, {useEffect} from 'react'
import TaskMenu from "./TaskMenu.jsx";
import {Form, useSearchParams } from "react-router-dom";
import {createTask, toggleDoneTask, tryCatchDecorator} from "../../scripts/api.js";
import {useAuth} from "../../contexts/AuthContext.jsx";
import {useTaskMenu} from "../../contexts/TaskMenuContext.jsx";
import {openForm} from "../../scripts/utils.js";

function formDate(date) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

export default function Task({taskListInd, ind, data, date, tasksCol}) {

    const MAX_TASK_NAME_LENGTH = 20;

    const [searchParams, setSearchParams] = useSearchParams();

    async function handleToggleDone(ev) {
        ev.stopPropagation();
        await toggleDoneTask(data.id);
    }

    const { currentUser } = useAuth();

    const { setTaskData } = useTaskMenu();

    function openTaskMenu(ev) {
        if (document.querySelector('.blur-bg.active')) return;
        openForm("task-menu");
        console.log(data);
        setTaskData(data);
    }

    useEffect(() => {
        const openedTask = searchParams.get("openedTask");
        if (openedTask && openedTask === data.id) {
            openForm("task-menu");
            setTaskData(data);
        }
    }, [searchParams]);


    return (
        <div className={`w-full border-b
         border-gray-200 dark:border-gray-700 hover:border-gray-500 dark:hover:border-blue-700 hover:border-b-0 
         dark:hover:border-b group`} data-ind={ind}>
            <div className="task flex justify-between items-center py-2 px-3 cursor-grab" onClick={openTaskMenu}>
                <h5 className={`task-title px-2 py-0.5 rounded-full text-sm bg-${data.color} ` + (data.done && "opacity-40 line-through ") || ''}
                >{ data.description && <i className="fa-regular fa-note-sticky"></i> } {data.name.slice(0, MAX_TASK_NAME_LENGTH) +
                    (data.name.length > MAX_TASK_NAME_LENGTH ? "..." : "")}</h5>
                <button className="toggle-done hidden group-hover:block max-lg:block" onClick={handleToggleDone}>
                    <i className={`fa-${data.done ? "solid" : "regular"} ${data.done && "opacity-50"} fa-circle-check`}></i>
                </button>

            </div>
        </div>
    )
}