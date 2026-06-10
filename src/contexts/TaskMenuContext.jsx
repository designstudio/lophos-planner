import React, {useContext, useState} from "react";

const taskMenuContext = React.createContext();

export function useTaskMenu() {
    return useContext(taskMenuContext);
}
export default function TaskMenuProvider({ children }) {

    const [taskData, setTaskData] = useState({
        id: null,
        name: "",
        done: false,
        task_type: "task",
        color: "",
        description: "",
        note_format: "markdown",
        note_blocks: null,
        note_plain_text: "",
        note_migrated_at: null,
        relatedLinks: [],
        date: new Date(),
    });

    const value = {
        taskData,
        setTaskData
    };

    return (
        <taskMenuContext.Provider value={value}>
            { children }
        </taskMenuContext.Provider>
    )
}
