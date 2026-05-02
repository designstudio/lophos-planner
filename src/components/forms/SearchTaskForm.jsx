import Blur from "../Blur.jsx";
import React from "react";
import { getSearchedTasks } from "../../scripts/api.js";
import SearchTask from "../tasks/SearchTask.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { XCircle } from "@untitledui/icons";
import { getAppLanguage, t } from "../../scripts/i18n.js";
import { subscribeToModalState } from "../../scripts/utils.js";

export default function SearchTaskForm() {
    const { currentUser, appLanguage } = useAuth();
    const [tasks, setTasks] = React.useState([]);
    const [query, setQuery] = React.useState("");
    const language = appLanguage || getAppLanguage(currentUser?.language);
    const clearSearchLabel = language === "ptBR" ? "Limpar busca" : "Clear search";
    const inputRef = React.useRef(null);
    const modalRef = React.useRef(null);

    React.useEffect(() => {
        const focusInput = () => {
            inputRef.current?.focus();
            inputRef.current?.select?.();
        };

        let rafId = null;
        let timeoutId = null;

        const scheduleFocus = () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            if (timeoutId !== null) window.clearTimeout(timeoutId);

            rafId = requestAnimationFrame(focusInput);
            timeoutId = window.setTimeout(focusInput, 180);
        };

        const unsubscribe = subscribeToModalState("search-form", isOpen => {
            if (isOpen) {
                scheduleFocus();
            }
        });

        return () => {
            unsubscribe();
            if (rafId !== null) cancelAnimationFrame(rafId);
            if (timeoutId !== null) window.clearTimeout(timeoutId);
        };
    }, []);

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
        setQuery(value);

        runSearch(value.trim());
    }

    function clearSearch() {
        setQuery("");
        setTasks([]);
        inputRef.current?.focus();
    }

    return (
        <Blur bgColor="bg-black" type="search-form">
            <div
                ref={modalRef}
                className="search-form relative bg-white rounded-xl p-4 lg:p-8 w-[28rem]
                z-20 text-gray-600 transition-all duration-[160ms] ease-linear"
                onClick={ev => ev.stopPropagation()}
            >
                <h3 className="font-bold text-xl tracking-tight">{t(language, "search")}</h3>

                <form className="relative" onSubmit={ev => ev.preventDefault()}>
                    <label htmlFor="search-task-name" className="sr-only">
                        {t(language, "search")}
                    </label>
                    <input
                        ref={inputRef}
                        className="my-6 w-full border-b bg-transparent py-1 focus:outline-none"
                        type="text"
                        name="search-task-name"
                        id="search-task-name"
                        aria-label={t(language, "search")}
                        value={query}
                        onChange={handleSearchChange}
                        style={{ borderBottomColor: "rgba(0,0,0,0.15)" }}
                    />

                    <button
                        type="button"
                        className={`clear-search absolute top-10 right-2 -translate-y-[50%] ${query ? "" : "hidden"}`}
                        onClick={clearSearch}
                        aria-label={clearSearchLabel}
                    >
                        <XCircle className="h-5 w-5" />
                    </button>
                </form>

                <div className="search-results">
                    {Array.isArray(tasks) &&
                        tasks.map(task => (
                            <SearchTask
                                key={task.id}
                                data={task}
                                date={new Date(task.date)}
                                onSelect={clearSearch}
                            />
                        ))}
                </div>
            </div>
        </Blur>
    );
}
