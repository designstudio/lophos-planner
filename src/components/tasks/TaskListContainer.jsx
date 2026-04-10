import React, { useEffect, useState } from 'react';
import TaskList from './TaskList.jsx';
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../scripts/supabase.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { reOrderTasks } from "../../scripts/api.js";
import { formDate } from "../../scripts/utils.js";

const TaskListContainer = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [curDate, setCurDate] = useState(new Date());
    const [tasks, setTasks] = useState([]);
    const [maxTasks, setMaxTasks] = React.useState(10);
    const [loading, setLoading] = useState(true);

    const { currentUser } = useAuth();

    const changeMaxTasks = (newTasks) => {
        if (newTasks > maxTasks) setMaxTasks(newTasks);
    };

    function reorderTasks(listInd) {
        return async ev => {
            const oldIndex = ev.oldIndex, newIndex = ev.newIndex;

            const curListTasks = [...tasksData[formDate(dates[listInd])]];
            const temp = curListTasks[oldIndex];
            curListTasks.splice(curListTasks.indexOf(curListTasks[oldIndex]), 1);
            curListTasks.splice(newIndex, 0, temp);

            await reOrderTasks(curListTasks);
        };
    }

    useEffect(() => {
        if (!currentUser?.uid) {
            setTasks([]);
            setLoading(false);
            return;
        }

        const fetchTasks = async () => {
            console.log('[TASKS] fetchTasks start', { uid: currentUser.uid });

            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('uid', currentUser.uid)
                .order('order');

            console.log('[TASKS] fetchTasks result', { data, error });

            if (!error) {
                setTasks((data || []).map(task => ({ ...task, date: new Date(task.date) })));
            }

            setLoading(false);
        };

        setLoading(true);
        fetchTasks();

        const channel = supabase
            .channel(`tasks:${currentUser.uid}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tasks',
                    filter: `uid=eq.${currentUser.uid}`,
                },
                fetchTasks
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser?.uid]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            const openedBlur = document.querySelector(".blur-bg.active");
            document.body.style.overflowY = openedBlur ? "hidden" : "auto";
        }, 50);

        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        if (searchParams.has("weekShift")) {
            const shift = +searchParams.get("weekShift") * 7;
            setCurDate(() => {
                const newDate = new Date();
                newDate.setDate(newDate.getDate() + shift);
                return newDate;
            });
        }
    }, [searchParams.get("weekShift")]);

    const dayOfWeek = (curDate.getDay() - 1) % 7;
    const dates = [];
    const tasksData = {};

    for (let i = -dayOfWeek; i < -dayOfWeek + 7; ++i) {
        const newDate = new Date(+curDate);
        newDate.setDate(newDate.getDate() + i);
        dates.push(newDate);
        tasksData[formDate(newDate)] = tasks.filter(task => formDate(task.date) === formDate(newDate));
        changeMaxTasks(tasksData[formDate(newDate)].length + 1);
    }

    if (loading) {
        return (
            <div className="w-full py-20 text-center text-2xl font-bold dark:text-white">
                Loading Your tasks...
            </div>
        );
    }

    return (
        <div className="w-full padding-x flex flex-col lg:flex-row gap-6 py-4 max-lg:mt-10 dark:bg-black dark:text-white">
            {dates.slice(0, 5).map((date, index) => (
                <TaskList
                    date={date}
                    key={index}
                    ind={index}
                    active={formDate(new Date()) === formDate(date)}
                    last={false}
                    reorderTasks={reorderTasks(index)}
                    maxTasks={maxTasks}
                    changeMaxTasks={changeMaxTasks}
                    tasksData={tasksData[formDate(date)]}
                />
            ))}

            <div className="flex-1">
                {dates.slice(5).map((date, index) => (
                    <TaskList
                        date={date}
                        key={index}
                        ind={index + 5}
                        active={formDate(new Date()) === formDate(date)}
                        last={true}
                        reorderTasks={reorderTasks(index + 5)}
                        maxTasks={maxTasks}
                        changeMaxTasks={changeMaxTasks}
                        tasksData={tasksData[formDate(date)]}
                    />
                ))}
            </div>
        </div>
    );
};

export default TaskListContainer;
