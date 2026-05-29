import React from "react";
import Blur from "../Blur.jsx";
import { closeForm } from "../../scripts/utils.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getAppLanguage, t } from "../../scripts/i18n.js";
import { Camera01, MagicWand01, Check } from "@untitledui/icons";

const MAX_AVATAR_SIZE_BYTES = 100 * 1024;
const DEFAULT_AGENDA_COLOR = "var(--color-brand-accent)";
const AGENDA_COLORS = [
    { nameKey: "primary", value: "var(--color-brand-primary)" },
    { nameKey: "accent", value: "var(--color-brand-accent)" },
    { nameKey: "success", value: "var(--color-success-solid)" },
    { nameKey: "warning", value: "var(--color-warning-solid)" },
    { nameKey: "danger", value: "var(--color-danger-solid)" },
];

export default function CreateAgendaForm() {
    const { currentUser, createAgenda } = useAuth();
    const language = getAppLanguage(currentUser?.language);

    const [name, setName] = React.useState("");
    const [avatar, setAvatar] = React.useState("");
    const [color, setColor] = React.useState(DEFAULT_AGENDA_COLOR);
    const [sortCompletedTasks, setSortCompletedTasks] = React.useState(true);
    const [loading, setLoading] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState("");
    const [avatarLoading, setAvatarLoading] = React.useState(false);
    const avatarInputRef = React.useRef(null);

    async function handleAvatarChange(ev) {
        const file = ev.target.files?.[0];
        if (!file) return;

        if (file.size > MAX_AVATAR_SIZE_BYTES) {
            setErrorMessage(t(language, "agendaAvatarMaxSizeError"));
            ev.target.value = "";
            return;
        }

        setAvatarLoading(true);
        try {
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result || "");
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            setAvatar(typeof dataUrl === "string" ? dataUrl : "");
            setErrorMessage("");
        } finally {
            setAvatarLoading(false);
        }
    }

    async function handleCreateAgenda(ev) {
        ev.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        setErrorMessage("");

        const result = await createAgenda(name.trim(), avatar.trim(), color.trim() || DEFAULT_AGENDA_COLOR, { sortCompletedTasks });
        if (result?.type === "error") {
            setErrorMessage(result.errorMessage || t(language, "agendaCreateError"));
            setLoading(false);
            return;
        }

        setName("");
        setAvatar("");
        setColor(DEFAULT_AGENDA_COLOR);
        setSortCompletedTasks(true);
        setLoading(false);
        closeForm("create-agenda-form");
    }

    return (
        <Blur type="create-agenda-form">
            <div
                className="create-agenda-form ds-modal-shell relative z-20 mb-6 w-[32rem] max-w-full px-6 py-7 transition-all duration-500 ease-linear"
                onClick={ev => ev.stopPropagation()}
            >
                <h3 className="ds-type-h4 text-ds-text-default">{t(language, "newAgenda")}</h3>
                <p className="ds-type-body mt-3 text-ds-text-default">{t(language, "newAgendaQuestion")}</p>

                <form className="mt-6" onSubmit={handleCreateAgenda}>
                    <div className="mt-6">
                        <h4 className="ds-type-label mb-4 text-ds-text-default">{t(language, "editAgendaSectionTitle")}</h4>

                        <div className="flex items-center gap-4">
                            <div className="relative flex-shrink-0">
                                <input
                                    ref={avatarInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                                    onChange={handleAvatarChange}
                                    className="hidden"
                                    id="agenda-avatar-upload"
                                />
                                <button
                                    type="button"
                                    onClick={() => avatarInputRef.current?.click()}
                                    className="relative block h-14 w-14 overflow-hidden rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-border-default focus-visible:ring-offset-2"
                                >
                                    {avatar ? (
                                        <img src={avatar} alt={t(language, "agendaAvatarAlt")} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="ds-type-button flex h-full w-full items-center justify-center bg-ds-background-surface text-ds-text-subtle">
                                            {(name || "A")[0].toUpperCase()}
                                        </div>
                                    )}
                                </button>
                                <div className="pointer-events-none absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-ds-text-default">
                                    {avatarLoading ? (
                                        <svg className="h-[10px] w-[10px] animate-spin text-ds-text-inverse" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                    ) : (
                                        <Camera01 className="h-[10px] w-[10px] text-ds-text-inverse" />
                                    )}
                                </div>
                            </div>

                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={ev => setName(ev.target.value)}
                                    placeholder={t(language, "agendaNamePlaceholder")}
                                    className="ds-type-body w-full bg-transparent text-ds-text-default placeholder:text-ds-text-subtle focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 border-t border-ds-border-muted" />

                    <div className="mt-6">
                        <h4 className="ds-type-label mb-4 text-ds-text-default">{t(language, "featuresSectionTitle")}</h4>
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <MagicWand01 className="h-4 w-4 text-ds-text-default" />
                                <span className="ds-type-body text-ds-text-default">{t(language, "sortCompletedTasksLabel")}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSortCompletedTasks(!sortCompletedTasks)}
                                className={`relative box-border h-6 w-11 appearance-none rounded-full border-2 shadow-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-border-default focus-visible:ring-offset-2 ${
                                    sortCompletedTasks
                                        ? "border-ds-text-default bg-ds-text-default"
                                        : "border-ds-text-default bg-ds-background-surface"
                                }`}
                            >
                                <div className={`h-4 w-4 absolute left-0.5 top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center transition-all transform ${
                                    sortCompletedTasks
                                        ? "translate-x-[20px] bg-ds-background-surface"
                                        : "translate-x-0 bg-ds-text-default"
                                }`}>
                                    {sortCompletedTasks && (
                                        <Check className="h-3 w-3 text-ds-text-default" strokeWidth={3} />
                                    )}
                                </div>
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 border-t border-ds-border-muted" />

                    <div className="mt-6">
                        <p className="ds-type-label mb-4 text-ds-text-default">{t(language, "agendaColor")}</p>
                        <div className="mt-3 flex items-center gap-2">
                            {AGENDA_COLORS.map(item => (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => setColor(item.value)}
                                    className={`h-7 w-7 flex-shrink-0 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-border-default focus-visible:ring-offset-2 ${color === item.value ? "ring-2 ring-ds-border-strong ring-offset-2" : ""}`}
                                    style={{ backgroundColor: item.value }}
                                />
                            ))}
                            <div className="flex flex-1 items-center gap-3">
                                <span
                                    className={`h-7 w-7 flex-shrink-0 rounded-full ${!AGENDA_COLORS.some(c => c.value === color) ? "ring-2 ring-ds-border-strong ring-offset-2" : ""}`}
                                    style={{ backgroundColor: color }}
                                />
                                <input
                                    type="text"
                                    value={color}
                                    onChange={ev => setColor(ev.target.value)}
                                    placeholder={DEFAULT_AGENDA_COLOR}
                                    className="ds-type-body-sm min-w-0 flex-1 bg-transparent text-ds-text-default placeholder:text-ds-text-subtle focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {errorMessage && (
                        <p className="ds-alert ds-alert-danger mt-3">{errorMessage}</p>
                    )}

                    <div className="mt-6 flex items-center gap-4">
                        <button
                            type="submit"
                            disabled={loading || !name.trim()}
                            className="app-button-hover ds-button-primary ds-type-body rounded-full border border-transparent px-5 py-1.5 font-bold disabled:opacity-20"
                        >
                            {t(language, "create")}
                        </button>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={() => closeForm("create-agenda-form")}
                            className="app-button-hover ds-button-secondary ds-type-body rounded-full px-5 py-1.5 font-bold disabled:opacity-20"
                        >
                            {t(language, "cancel")}
                        </button>
                    </div>
                </form>
            </div>
        </Blur>
    );
}
