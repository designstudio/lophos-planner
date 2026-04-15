import React from "react";
import Blur from "../Blur.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getAppLanguage, t } from "../../scripts/i18n.js";
import { createTask, getAgendaTasks, getBoardColumns, tryCatchDecorator } from "../../scripts/api.js";
import { getStoredWeekShift, parseDateOnly } from "../../scripts/utils.js";
import {
    buildStatusHistoryTaskPayload,
    buildStatusText,
    isStatusHistoryTask,
} from "../../scripts/status.js";

function getWeekStartIndex(currentUser) {
    return currentUser?.weekStartsOn === "Sunday" ? 0 : 1;
}

function getVisibleWeekRange(currentUser) {
    const weekShift = getStoredWeekShift();
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + (weekShift * 7));

    const weekStartIndex = getWeekStartIndex(currentUser);
    const start = parseDateOnly(baseDate);
    const offset = (start.getDay() - weekStartIndex + 7) % 7;
    start.setDate(start.getDate() - offset);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    return { start, end };
}

export default function StatusGeneratorForm() {
    const { currentUser, appLanguage } = useAuth();
    const language = appLanguage || getAppLanguage(currentUser?.language);
    const modalRef = React.useRef(null);
    const generationTokenRef = React.useRef(0);
    const copyTimeoutRef = React.useRef(null);
    const [statusText, setStatusText] = React.useState("");
    const [isLoading, setIsLoading] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [copied, setCopied] = React.useState(false);
    const [message, setMessage] = React.useState("");
    const [error, setError] = React.useState("");

    const generateStatus = React.useCallback(async () => {
        if (!currentUser?.uid || !currentUser?.currentAgendaId) {
            setStatusText("");
            setMessage("");
            setError("");
            return;
        }

        const token = ++generationTokenRef.current;
        setIsLoading(true);
        setError("");
        setMessage("");
        setCopied(false);

        try {
            const [allTasks, boardColumns] = await Promise.all([
                getAgendaTasks(currentUser.currentAgendaId),
                getBoardColumns(currentUser.currentAgendaId),
            ]);

            if (generationTokenRef.current !== token) return;

            const { start, end } = getVisibleWeekRange(currentUser);
            const weeklyTasks = allTasks.filter(task => {
                if (!task || task.is_board_task || isStatusHistoryTask(task)) return false;
                if (!(task.date instanceof Date)) return false;
                return task.date >= start && task.date <= end;
            });

            const boardTasks = allTasks.filter(task => task?.is_board_task && !isStatusHistoryTask(task));
            const nextText = buildStatusText({
                language,
                weeklyOpenTasks: weeklyTasks.filter(task => !task.done),
                weeklyDoneTasks: weeklyTasks.filter(task => task.done),
                boardColumns,
                boardTasks,
            });

            if (generationTokenRef.current !== token) return;

            setStatusText(nextText);
            setMessage(nextText ? "" : t(language, "statusGeneratorEmpty"));
        } catch (err) {
            if (generationTokenRef.current !== token) return;
            setError(err?.message || t(language, "statusGeneratorEmpty"));
            setStatusText("");
        } finally {
            if (generationTokenRef.current === token) {
                setIsLoading(false);
            }
        }
    }, [currentUser?.uid, currentUser?.currentAgendaId, currentUser?.weekStartsOn, language]);

    React.useEffect(() => {
        const blurEl = modalRef.current?.closest('.blur-bg[data-id="status-generator-form"]');
        if (!blurEl) return undefined;

        const runGeneration = () => {
            if (!blurEl.classList.contains("active")) return;
            void generateStatus();
        };

        if (blurEl.classList.contains("active")) {
            runGeneration();
        }

        const observer = new MutationObserver(runGeneration);
        observer.observe(blurEl, { attributes: true, attributeFilter: ["class"] });

        return () => observer.disconnect();
    }, [generateStatus]);

    React.useEffect(() => {
        return () => {
            if (copyTimeoutRef.current) {
                clearTimeout(copyTimeoutRef.current);
            }
        };
    }, []);

    async function handleCopy() {
        if (!statusText.trim()) return;

        try {
            await navigator.clipboard.writeText(statusText.trim());
            setCopied(true);

            if (copyTimeoutRef.current) {
                clearTimeout(copyTimeoutRef.current);
            }

            copyTimeoutRef.current = window.setTimeout(() => {
                setCopied(false);
                copyTimeoutRef.current = null;
            }, 1500);
        } catch (err) {
            setError(err?.message || t(language, "statusGeneratorEmpty"));
        }
    }

    async function handleSaveHistory() {
        if (!statusText.trim() || !currentUser?.uid || !currentUser?.currentAgendaId) return;

        setIsSaving(true);
        setError("");
        setMessage("");

        try {
            const payload = buildStatusHistoryTaskPayload({
                text: statusText,
                language,
                uid: currentUser.uid,
                agenda_id: currentUser.currentAgendaId,
                date: new Date(),
            });

            const result = await tryCatchDecorator(createTask)(payload);
            if (!result.success || !result.data) {
                throw new Error(result.message || t(language, "statusGeneratorEmpty"));
            }

            window.dispatchEvent(new CustomEvent("task-created", {
                detail: { task: result.data },
            }));

            setMessage(t(language, "statusGeneratorSaved"));
        } catch (err) {
            setError(err?.message || t(language, "statusGeneratorEmpty"));
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <Blur bgColor="bg-black" type="status-generator-form">
            <div
                ref={modalRef}
                className="status-generator-form relative mb-6 w-[44rem] max-w-[calc(100vw-2rem)] z-20 rounded-[28px] bg-[rgb(250,250,252)] px-6 py-7 text-gray-700 shadow-lg"
                onClick={ev => ev.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h3 className="text-[24px] font-bold tracking-tight text-black">
                            {t(language, "statusGeneratorTitle")}
                        </h3>
                        <p className="mt-1 text-sm leading-5 text-[#6b7280]">
                            {t(language, "statusGeneratorDescription")}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={generateStatus}
                        disabled={isLoading}
                        className="rounded-full border border-black px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isLoading ? t(language, "statusGeneratorGenerating") : t(language, "statusGeneratorGenerate")}
                    </button>
                </div>

                {error && (
                    <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </p>
                )}

                {message && (
                    <p className="mt-4 rounded-2xl bg-black/5 px-4 py-3 text-sm text-black">
                        {message}
                    </p>
                )}

                <textarea
                    value={statusText}
                    onChange={ev => setStatusText(ev.target.value)}
                    placeholder={t(language, "statusGeneratorEmpty")}
                    className="mt-5 min-h-[24rem] w-full resize-y rounded-[24px] border border-black/10 bg-white p-4 text-[14px] leading-6 text-black outline-none transition-colors duration-150 focus:border-black/20"
                />

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={generateStatus}
                        disabled={isLoading}
                        className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {t(language, "statusGeneratorGenerate")}
                    </button>
                    <button
                        type="button"
                        onClick={handleCopy}
                        disabled={!statusText.trim()}
                        className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {copied ? t(language, "copied") : t(language, "statusGeneratorCopy")}
                    </button>
                    <button
                        type="button"
                        onClick={handleSaveHistory}
                        disabled={!statusText.trim() || isSaving}
                        className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSaving ? t(language, "statusGeneratorSaving") : t(language, "statusGeneratorSaveHistory")}
                    </button>
                </div>
            </div>
        </Blur>
    );
}
