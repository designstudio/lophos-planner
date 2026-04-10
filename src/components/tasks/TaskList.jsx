import React from 'react'
import Task from './Task.jsx';
import {useAuth} from "../../contexts/AuthContext.jsx";
import {createTask, tryCatchDecorator} from "../../scripts/api.js";
import {ReactSortable} from "react-sortablejs";
import {Form} from "react-router-dom";
import {formDate} from "../../scripts/utils.js";

const TaskList = ({date, active, last, maxTasks, tasksData, ind, reorderTasks}) => {

    // TODO: implement sorting tasks between task lists by dragging them

    const getDate = date => {
        let day = date.getDate().toString(), month = (date.getMonth() + 1).toString();
        if (day.length < 2) day = "0" + day;
        if (month.length < 2) month = "0" + month;
        return `${day}.${month}`;
    }

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const day = days[date.getDay()];


    const {currentUser} = useAuth();

    function handleClick(ev) {
        const thisTaskList = document.querySelector(`.task-list[data-date="${date.getDate()}"]`);
        console.log(thisTaskList, thisTaskList.querySelector('.add-task'));

        const firstInput = thisTaskList.querySelector('.add-task #add-task-name');
        firstInput.focus();
    }

    async function handleFocusOut(ev) {
        if (!ev.target.value) return;
        if (currentUser) {
            const formData = new FormData(ev.target.parentElement);
            console.log("creating new task on blur", formData.get("add-task-name"));
            ev.target.value = "";
            await tryCatchDecorator(createTask)({
                name: formData.get("add-task-name"),
                color: "white text-black dark:text-white dark:bg-black",
                date: formDate(date),
                uid: currentUser.uid,
                done: false,
                order: tasksData.length,
            });
        }
    }

    async function handleKeyDown(ev) {
        if (ev.key === 'Enter') {
            const curInput = document.querySelector('input:focus');

            if (curInput.value) {
                if (currentUser) {
                    const formData = new FormData(curInput.parentElement);
                    console.log("creating new task on keydown", formData.get("add-task-name"), formDate(date));
                    curInput.value = "";
                    await tryCatchDecorator(createTask)({
                        name: formData.get("add-task-name"),
                        color: "white text-black dark:text-white dark:bg-black",
                        date: formDate(date),
                        uid: currentUser.uid,
                        done: false,
                        order: tasksData.length,
                    });
                } else {
                    const thisTaskList = curInput.parentElement.parentElement.parentElement;
                    if (thisTaskList.dataset.date == date.getDate()) {
                        console.log(curInput.value)
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
    for (let i = 0; i < Math.max(0, (last ? maxTasks / 2 : maxTasks) - 1 - tasksData.length); ++i) {
        emptyComponents.push(
            <div className="empty-task w-full py-2 border-b-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-black"
                 key={i}
                 onClick={handleClick}>
                <p className="opacity-0 cursor-default" onClick={handleClick}>sdasdfsdlk</p>
            </div>
        )
    }

    return (
        <div className="task-list flex flex-1 flex-col" data-date={date.getDate()}
             onKeyDown={handleKeyDown}>
            <div
                className={`flex justify-between items-center py-3 border-b-2 
                ${active ? "border-blue-600" : "border-black dark:border-white"}`}>
                <h2 className={`text-lg lg:text-xl font-bold  ${active ? "text-blue-600" : "text-gray-600"}`}>{getDate(date)}</h2>
                <h3 className={`text-lg lg:text-xl ${active ? "text-blue-300" : "text-gray-300"}`}>{day.slice(0, 3)}</h3>
            </div>

            <ReactSortable list={tasksData} setList={() => null}
                           onUpdate={reorderTasks}
                           onChoose={ev => console.log(ev.oldIndex < tasksData.length)}
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
                       className="w-full border-b dark:bg-black
                       focus:outline-none focus:px-1.5 focus:shadow-lg focus:border dark:focus:border-none dark:focus:bg-stone-800
                       py-2 indent-1.5 focus:rounded-md border-gray-300 dark:border-gray-700 focus:z-5"
                       onBlur={handleFocusOut}
                />
                <input type="text" defaultValue="add-task-form" name="form-id" id="form-id" className="hidden"/>


                <input type="date" defaultValue={date.toISOString().split("T")[0]} className="hidden" name="task-date"
                       id="task-date"/>
            </Form>
            {emptyComponents}
        </div>
    )
}

export default TaskList