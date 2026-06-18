import React from "react";
import Blur from "../Blur.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getAppLanguage, t } from "../../scripts/i18n.js";
import { createTask, getAgendaTasks, getBoardColumns, tryCatchDecorator } from "../../scripts/api.js";
import { getStoredWeekShift, parseDateOnly, subscribeToModalState } from "../../scripts/utils.js";
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
        return subscribeToModalState("status-generator-form", isOpen => {
            if (!isOpen) return;
            void generateStatus();
        });
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
        <Blur bgColor="bg-black" type="status-generator-form" mobileSheet>
            <div
                ref={modalRef}
                className="status-generator-form ds-modal-shell ds-mobile-sheet relative z-20 mb-6 w-[44rem] max-w-[calc(100vw-2rem)] px-6 py-7"
                style={{ backgroundColor: "var(--color-bg-page)" }}
                onClick={ev => ev.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h3 className="ds-type-h3 text-ds-text-default">
                            {t(language, "statusGeneratorTitle")}
                        </h3>
                        <p className="ds-type-body-sm mt-1 text-ds-text-muted">
                            {t(language, "statusGeneratorDescription")}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={generateStatus}
                        disabled={isLoading}
                        className="ds-button-secondary ds-type-button rounded-full px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isLoading ? t(language, "statusGeneratorGenerating") : t(language, "statusGeneratorGenerate")}
                    </button>
                </div>

                {error && (
                    <p className="ds-alert ds-alert-danger mt-4">
                        {error}
                    </p>
                )}

                {message && (
                    <p className="ds-alert mt-4 border-ds-border-muted bg-ds-background-surface-muted text-ds-text-default">
                        {message}
                    </p>
                )}

                <textarea
                    value={statusText}
                    onChange={ev => setStatusText(ev.target.value)}
                    placeholder={t(language, "statusGeneratorEmpty")}
                    className="ds-type-body-sm mt-5 min-h-[24rem] w-full resize-y rounded-ds-2xl border border-ds-border-default bg-ds-background-surface p-4 text-ds-text-default outline-none transition-colors duration-150 focus:border-ds-border-strong"
                    style={{
                        backgroundColor: "var(--color-bg-surface)",
                        borderRadius: "var(--radius-2xl)",
                    }}
                />

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={generateStatus}
                        disabled={isLoading}
                        className="ds-button-secondary ds-type-button rounded-full px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {t(language, "statusGeneratorGenerate")}
                    </button>
                    <button
                        type="button"
                        onClick={handleCopy}
                        disabled={!statusText.trim()}
                        className="ds-button-secondary ds-type-button rounded-full px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {copied ? t(language, "copied") : t(language, "statusGeneratorCopy")}
                    </button>
                    <button
                        type="button"
                        onClick={handleSaveHistory}
                        disabled={!statusText.trim() || isSaving}
                        className="ds-button-primary ds-type-button rounded-full px-4 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSaving ? t(language, "statusGeneratorSaving") : t(language, "statusGeneratorSaveHistory")}
                    </button>
                </div>
            </div>
        </Blur>
    );
}
