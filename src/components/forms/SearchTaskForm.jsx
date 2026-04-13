import Blur from "../Blur.jsx";
import React from "react";
import { getSearchedTasks } from "../../scripts/api.js";
import SearchTask from "../tasks/SearchTask.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { XCircle } from "@untitledui/icons";
import { getAppLanguage, t } from "../../scripts/i18n.js";

export default function SearchTaskForm() {
    const { currentUser, appLanguage } = useAuth();
    const [tasks, setTasks] = React.useState([]);
    const language = appLanguage || getAppLanguage(currentUser?.language);
    const inputRef = React.useRef(null);
    const modalRef = React.useRef(null);

    React.useEffect(() => {
        const focusInput = () => {
            inputRef.current?.focus();
            inputRef.current?.select?.();
        };

        const blurEl = modalRef.current?.closest('.blur-bg[data-id="search-form"]');
        if (!blurEl) return undefined;

        let rafId = null;
        let timeoutId = null;

        const scheduleFocus = () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            if (timeoutId !== null) window.clearTimeout(timeoutId);

            rafId = requestAnimationFrame(focusInput);
            timeoutId = window.setTimeout(focusInput, 180);
        };

        if (blurEl.classList.contains("active")) {
            scheduleFocus();
        }

        const observer = new MutationObserver(() => {
            if (blurEl.classList.contains("active")) {
                scheduleFocus();
            }
        });

        observer.observe(blurEl, { attributes: true, attributeFilter: ["class"] });

        return () => {
            observer.disconnect();
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
                ref={modalRef}
                className="search-form relative bg-white rounded-xl p-4 lg:p-8 w-[28rem]
                z-20 text-gray-600 transition-all duration-[160ms] ease-linear"
                onClick={ev => ev.stopPropagation()}
            >
                <h3 className="font-bold text-xl tracking-tight">{t(language, "search")}</h3>

                <form className="relative" onSubmit={ev => ev.preventDefault()}>
                    <input
                        ref={inputRef}
                        className="my-6 w-full border-b bg-transparent py-1 focus:outline-none"
                        type="text"
                        name="search-task-name"
                        id="search-task-name"
                        onChange={handleSearchChange}
                        style={{ borderBottomColor: "rgba(0,0,0,0.15)" }}
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
