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
        color: "",
        description: "",
        date: new Date(),
    });

    console.log("In task provider", taskData);

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