import Blur from "../Blur.jsx";
import React from "react";
import { getSearchedTasks } from "../../scripts/api.js";
import SearchTask from "../tasks/SearchTask.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { XCircle } from "@untitledui/icons";

export default function SearchTaskForm() {
    const { currentUser } = useAuth();
    const [tasks, setTasks] = React.useState([]);

    async function runSearch(query) {
        if (!query || !currentUser?.uid || !currentUser?.currentAgendaId) {
            setTasks([]);
            return;
        }

        const results = await getSearchedTasks(currentUser.uid, currentUser.currentAgendaId, query);
        setTasks(results || []);
    }

    function handleSearchChange(ev) {
        const value = ev.currentTarget.value;

        if (value) {
            const clearSearchBtn = document.querySelector(".clear-search");
            clearSearchBtn?.classList.remove("hidden");
        } else {
            document.querySelector(".clear-search")?.classList.add("hidden");
        }

        runSearch(value.trim());
    }

    function clearSearch() {
        const searchInput = document.getElementById("search-task-name");
        if (searchInput) searchInput.value = "";
        document.querySelector(".clear-search")?.classList.add("hidden");
        setTasks([]);
    }

    return (
        <Blur bgColor="bg-black" type="search-form">
            <div
                className="search-form relative top-16 bg-white rounded-xl p-4 lg:p-8 w-[28rem]
                z-20 text-gray-600 transition-all duration-500 ease-linear"
                onClick={ev => ev.stopPropagation()}
            >
                <h3 className="font-bold text-xl tracking-tight">Search</h3>

                <form className="relative" onSubmit={ev => ev.preventDefault()}>
                    <input
                        className="text-field-border-bottom my-6 w-full py-1 focus:outline-none"
                        type="text"
                        name="search-task-name"
                        id="search-task-name"
                        onChange={handleSearchChange}
                    />

                    <button
                        type="button"
                        className="clear-search absolute top-10 -translate-y-[50%] right-2 hidden"
                        onClick={clearSearch}
                    >
                        <XCircle className="h-5 w-5" />
                    </button>
                </form>

                <div className="search-results">
                    {Array.isArray(tasks) &&
                        tasks.map(task => (
                            <SearchTask key={task.id} data={task} date={new Date(task.date)} />
                        ))}
                </div>
            </div>
        </Blur>
    );
}
