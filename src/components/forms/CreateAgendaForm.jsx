import React from "react";
import Blur from "../Blur.jsx";
import { closeForm } from "../../scripts/utils.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getAppLanguage, t } from "../../scripts/i18n.js";
import { Camera01, MagicWand01, Check } from "@untitledui/icons";

const MAX_AVATAR_SIZE_BYTES = 100 * 1024;
const AGENDA_COLORS = [
    { nameKey: "blue", value: "#3b82f6" },
    { nameKey: "green", value: "#22c55e" },
    { nameKey: "yellow", value: "#eab308" },
    { nameKey: "pink", value: "#ec4899" },
    { nameKey: "orange", value: "#f97316" },
];

export default function CreateAgendaForm() {
    const { currentUser, createAgenda } = useAuth();
    const language = getAppLanguage(currentUser?.language);

    const [name, setName] = React.useState("");
    const [avatar, setAvatar] = React.useState("");
    const [color, setColor] = React.useState("#3b82f6");
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

        const result = await createAgenda(name.trim(), avatar.trim(), color.trim() || "#3b82f6", { sortCompletedTasks });
        if (result?.type === "error") {
            setErrorMessage(result.errorMessage || t(language, "agendaCreateError"));
            setLoading(false);
            return;
        }

        setName("");
        setAvatar("");
        setColor("#3b82f6");
        setSortCompletedTasks(true);
        setLoading(false);
        closeForm("create-agenda-form");
    }

    return (
        <Blur type="create-agenda-form">
            <div
                className="create-agenda-form relative mb-6 w-[32rem] max-w-full z-20 bg-[rgb(250,250,252)] rounded-[28px] px-6 py-7 shadow-lg text-black transition-all duration-500 ease-linear"
                onClick={ev => ev.stopPropagation()}
            >
                <h3 className="text-[21px] font-bold leading-7 tracking-[-0.5px] text-black">{t(language, "newAgenda")}</h3>
                <p className="mt-3 text-[16px] leading-[1.333333] text-black">{t(language, "newAgendaQuestion")}</p>

                <form className="mt-6" onSubmit={handleCreateAgenda}>
                    <div className="mt-6">
                        <h4 className="mb-4 text-[16px] font-bold leading-[1.333333] text-black">Editar agenda</h4>

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
                                    className="relative block h-14 w-14 overflow-hidden rounded-full"
                                >
                                    {avatar ? (
                                        <img src={avatar} alt="Agenda avatar" className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-white text-sm font-bold text-black/30">
                                            {(name || "A")[0].toUpperCase()}
                                        </div>
                                    )}
                                </button>
                                <div className="pointer-events-none absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-black">
                                    {avatarLoading ? (
                                        <svg className="h-[10px] w-[10px] animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                    ) : (
                                        <Camera01 className="h-[10px] w-[10px] text-white" />
                                    )}
                                </div>
                            </div>

                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={ev => setName(ev.target.value)}
                                    placeholder="Nome da agenda"
                                    className="w-full bg-transparent text-base text-black placeholder:text-black/45 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 border-t border-[rgba(0,0,0,0.1)]" />

                    <div className="mt-6">
                        <h4 className="mb-4 text-[16px] font-bold leading-[1.333333] text-black">Funções</h4>
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <MagicWand01 className="h-4 w-4 text-black" />
                                <span className="text-[16px] leading-[1.333333] text-black">Ordenar as tarefas concluídas</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSortCompletedTasks(!sortCompletedTasks)}
                                className={`h-6 w-11 appearance-none rounded-full relative box-border border-2 shadow-none focus:outline-none transition-colors ${
                                    sortCompletedTasks
                                        ? "bg-black border-black"
                                        : "bg-[rgb(250,250,252)] border-black"
                                }`}
                            >
                                <div className={`h-4 w-4 absolute left-0.5 top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center transition-all transform ${
                                    sortCompletedTasks
                                    ? "translate-x-[20px] bg-[rgb(250,250,252)]"
                                        : "translate-x-0 bg-black"
                                }`}>
                                    {sortCompletedTasks && (
                                        <Check className="h-3 w-3 text-black" strokeWidth={3} />
                                    )}
                                </div>
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 border-t border-[rgba(0,0,0,0.1)]" />

                    <div className="mt-6">
                        <p className="mb-4 text-[16px] font-bold leading-[1.333333] text-black">{t(language, "agendaColor")}</p>
                        <div className="mt-3 flex items-center gap-2">
                            {AGENDA_COLORS.map(item => (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => setColor(item.value)}
                                    className={`h-7 w-7 flex-shrink-0 rounded-full transition-transform hover:scale-110 ${color === item.value ? "ring-2 ring-offset-2 ring-black/30" : ""}`}
                                    style={{ backgroundColor: item.value }}
                                />
                            ))}
                            <div className="flex flex-1 items-center gap-3">
                                <span
                                    className={`h-7 w-7 flex-shrink-0 rounded-full ${!AGENDA_COLORS.some(c => c.value === color) ? "ring-2 ring-offset-2 ring-black/30" : ""}`}
                                    style={{ backgroundColor: color }}
                                />
                                <input
                                    type="text"
                                    value={color}
                                    onChange={ev => setColor(ev.target.value)}
                                    placeholder="#3b82f6"
                                    className="min-w-0 flex-1 bg-transparent text-sm text-black placeholder:text-black/45 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {errorMessage && (
                        <p className="mt-3 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
                    )}

                    <div className="mt-6 flex items-center gap-4">
                        <button
                            type="submit"
                            disabled={loading || !name.trim()}
                            className="app-button-hover py-1.5 px-5 border border-black bg-black text-white rounded-full font-bold disabled:opacity-20"
                        >
                            {t(language, "create")}
                        </button>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={() => closeForm("create-agenda-form")}
                            className="app-button-hover rounded-full border border-black px-5 py-1.5 font-bold text-black disabled:opacity-20"
                        >
                            {t(language, "cancel")}
                        </button>
                    </div>
                </form>
            </div>
        </Blur>
    );
}
