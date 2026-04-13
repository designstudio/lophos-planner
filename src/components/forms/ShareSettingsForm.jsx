import React from "react";
import Blur from "../Blur.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getShareSettings, setShareEnabled } from "../../scripts/api.js";
import { getAppLanguage, t } from "../../scripts/i18n.js";
import { Camera01, MagicWand01, Check, Trash03 } from "@untitledui/icons";
import { closeForm, openForm } from "../../scripts/utils.js";

const MAX_AVATAR_SIZE_BYTES = 100 * 1024;
const AGENDA_COLORS = [
    { nameKey: "blue", value: "#3b82f6" },
    { nameKey: "green", value: "#22c55e" },
    { nameKey: "yellow", value: "#eab308" },
    { nameKey: "pink", value: "#ec4899" },
    { nameKey: "orange", value: "#f97316" },
];

export default function ShareSettingsForm() {
    const { currentUser, agendas, renameAgenda, deleteAgenda } = useAuth();
    const language = getAppLanguage(currentUser?.language);
    const currentAgenda = agendas.find(agenda => String(agenda.id) === String(currentUser?.currentAgendaId));

    const [loading, setLoading] = React.useState(false);
    const [shareEnabled, setLocalShareEnabled] = React.useState(false);
    const [initialShareEnabled, setInitialShareEnabled] = React.useState(false);
    const [shareToken, setShareToken] = React.useState("");
    const [copied, setCopied] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState("");
    const [agendaName, setAgendaName] = React.useState("");
    const [agendaAvatar, setAgendaAvatar] = React.useState("");
    const [agendaColor, setAgendaColor] = React.useState("#3b82f6");
    const [sortCompletedTasks, setSortCompletedTasks] = React.useState(true);
    const [isRenamingAgenda, setIsRenamingAgenda] = React.useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
    const [isDeletingAgenda, setIsDeletingAgenda] = React.useState(false);
    const [deleteAgendaError, setDeleteAgendaError] = React.useState("");
    const [avatarLoading, setAvatarLoading] = React.useState(false);
    const deleteModalRef = React.useRef(null);
    const avatarInputRef = React.useRef(null);

    React.useEffect(() => {
        let mounted = true;

        async function loadShareSettings() {
            if (!currentAgenda?.id) return;
            try {
                setLoading(true);
                const data = await getShareSettings(currentAgenda.id);
                if (!mounted) return;
                setShareToken(data.shareToken || "");
                setLocalShareEnabled(!!data.shareEnabled);
                setInitialShareEnabled(!!data.shareEnabled);
            } catch (err) {
                if (!mounted) return;
                setErrorMessage(err.message || t(language, "shareError"));
            } finally {
                if (mounted) setLoading(false);
            }
        }

        loadShareSettings();
        return () => {
            mounted = false;
        };
    }, [currentAgenda?.id, language]);

    React.useEffect(() => {
        setAgendaName(currentAgenda?.name || "");
        setAgendaAvatar(currentAgenda?.avatar || "");
        setAgendaColor(currentAgenda?.color || "#3b82f6");
        setSortCompletedTasks(currentAgenda?.sort_completed_tasks ?? true);
    }, [currentAgenda?.id, currentAgenda?.name]);

    React.useEffect(() => {
        const blurEl = document.querySelector("[data-id='share-settings-form']");
        if (!blurEl) return;

        const observer = new MutationObserver(() => {
            if (!blurEl.classList.contains("active")) return;
            setAgendaName(currentAgenda?.name || "");
            setAgendaAvatar(currentAgenda?.avatar || "");
            setAgendaColor(currentAgenda?.color || "#3b82f6");
            setSortCompletedTasks(currentAgenda?.sort_completed_tasks ?? true);
            setLocalShareEnabled(initialShareEnabled);
            setErrorMessage("");
        });

        observer.observe(blurEl, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, [currentAgenda, initialShareEnabled]);

    React.useEffect(() => {
        if (!isDeleteModalOpen || !deleteModalRef.current) return;

        const modalEl = deleteModalRef.current;
        modalEl.style.transition = "none";
        modalEl.style.transform = "translateY(24px)";
        modalEl.style.opacity = "0";

        requestAnimationFrame(() => {
            modalEl.style.transition = "transform 160ms ease, opacity 160ms ease";
            modalEl.style.transform = "translateY(0)";
            modalEl.style.opacity = "1";
        });
    }, [isDeleteModalOpen]);

    React.useEffect(() => {
        function handleKeyDown(ev) {
            if (ev.key !== "Escape") return;
            if (!isDeleteModalOpen || isDeletingAgenda) return;

            ev.preventDefault();
            closeDeleteAgendaModal();
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isDeleteModalOpen, isDeletingAgenda]);

    function handleToggleShare() {
        setLocalShareEnabled(prev => !prev);
        setErrorMessage("");
    }

    async function copyShareUrl() {
        if (!shareToken) return;
        const shareUrl = `${window.location.origin}/share/${shareToken}`;
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }

    async function handleDeleteAgenda() {
        if (!currentAgenda?.id) return;

        setIsDeletingAgenda(true);
        setDeleteAgendaError("");

        const result = await deleteAgenda(currentAgenda.id);
        if (result?.type === "error") {
            setDeleteAgendaError(result.errorMessage || t(language, "deleteAgendaError"));
            setIsDeletingAgenda(false);
            return;
        }

        setIsDeletingAgenda(false);
        setIsDeleteModalOpen(false);
    }

    function openDeleteAgendaModal() {
        setDeleteAgendaError("");
        closeForm("share-settings-form");
        setIsDeleteModalOpen(true);
    }

    function closeDeleteAgendaModal() {
        if (isDeletingAgenda) return;
        setIsDeleteModalOpen(false);
        setDeleteAgendaError("");
        requestAnimationFrame(() => openForm("share-settings-form"));
    }

    const hasAgendaChanges = React.useMemo(() => {
        const prevName = (currentAgenda?.name || "").trim();
        const prevAvatar = (currentAgenda?.avatar || "").trim();
        const prevColor = (currentAgenda?.color || "#3b82f6").trim();
        const prevSortCompletedTasks = currentAgenda?.sort_completed_tasks ?? true;

        return (
            agendaName.trim() !== prevName ||
            agendaAvatar.trim() !== prevAvatar ||
            (agendaColor.trim() || "#3b82f6") !== prevColor ||
            sortCompletedTasks !== prevSortCompletedTasks
        );
    }, [agendaName, agendaAvatar, agendaColor, sortCompletedTasks, currentAgenda]);

    const hasShareChanges = shareEnabled !== initialShareEnabled;
    const hasPendingChanges = hasAgendaChanges || hasShareChanges;

    async function handleSaveAgendaName() {
        if (!currentAgenda?.id) return;
        const nextName = agendaName.trim();
        const nextAvatar = agendaAvatar.trim();
        const nextColor = agendaColor.trim() || "#3b82f6";
        const prevName = (currentAgenda?.name || "").trim();
        const prevAvatar = (currentAgenda?.avatar || "").trim();
        const prevColor = (currentAgenda?.color || "#3b82f6").trim();
        const prevSortCompletedTasks = currentAgenda?.sort_completed_tasks ?? true;
        if (!nextName || !hasPendingChanges) return;

        setIsRenamingAgenda(true);
        setErrorMessage("");

        if (hasShareChanges) {
            try {
                const shareData = await setShareEnabled(currentAgenda.id, shareEnabled);
                setShareToken(shareData.shareToken || "");
                setLocalShareEnabled(!!shareData.shareEnabled);
                setInitialShareEnabled(!!shareData.shareEnabled);
            } catch (err) {
                setErrorMessage(err.message || t(language, "shareError"));
                setIsRenamingAgenda(false);
                return;
            }
        }

        if (hasAgendaChanges) {
            const result = await renameAgenda(currentAgenda.id, nextName, nextAvatar, nextColor, sortCompletedTasks);
            if (result?.type === "error") {
                setErrorMessage(result.errorMessage || t(language, "agendaRenameError"));
                setIsRenamingAgenda(false);
                return;
            }
        }

        setIsRenamingAgenda(false);
        closeForm("share-settings-form");
    }

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

            setAgendaAvatar(typeof dataUrl === "string" ? dataUrl : "");
            setErrorMessage("");
        } finally {
            setAvatarLoading(false);
        }
    }

    const publicShareUrl = shareToken ? `${window.location.origin}/share/${shareToken}` : "";

    return (
        <>
        {!isDeleteModalOpen && (
        <Blur type="share-settings-form">
            <div
                className="share-settings-form relative mb-20 w-[32rem] max-w-full z-20 bg-[rgb(250,250,252)] rounded-[28px] px-6 py-7 shadow-lg text-black transition-all duration-500 ease-linear"
                onClick={ev => ev.stopPropagation()}
            >
                <h3 className="text-[21px] font-bold leading-7 tracking-[-0.5px] text-black">{t(language, "agendaSettingsTitle")}</h3>

                <div className="mt-6 rounded-[13px] bg-black p-4 text-white">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[12px] font-bold">{t(language, "sharePublishWeb")}</p>
                            <p className="text-[16px] leading-5">{t(language, "sharePublishDescription")}</p>
                        </div>

                        <button
                            type="button"
                            className={`h-6 w-11 appearance-none rounded-full relative box-border border-2 shadow-none focus:outline-none transition-colors ${
                                shareEnabled
                                    ? "bg-[rgb(250,250,252)] border-[rgb(250,250,252)]"
                                    : "bg-black border-[rgb(250,250,252)]"
                            }`}
                            onClick={handleToggleShare}
                            disabled={loading}
                        >
                            <div className={`h-4 w-4 absolute left-0.5 top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center transition-all transform ${
                                shareEnabled
                                    ? "translate-x-[20px] bg-black"
                                    : "translate-x-0 bg-[rgb(250,250,252)]"
                            }`}>
                                {shareEnabled && <Check className="h-3 w-3 text-[rgb(250,250,252)]" strokeWidth={3} />}
                            </div>
                        </button>
                    </div>

                    {shareEnabled && (
                        <div className="mt-4 flex items-center gap-2 rounded-md bg-[rgb(250,250,252)] p-2">
                            <input
                                type="text"
                                value={publicShareUrl}
                                readOnly
                                className="w-full bg-transparent px-2 text-base text-black focus:outline-none"
                            />
                            <button
                                type="button"
                                onClick={copyShareUrl}
                                disabled={!shareToken}
                                className="app-button-hover rounded-full bg-black px-4 py-1.5 text-[14px] font-bold text-white disabled:opacity-40"
                            >
                                {copied ? t(language, "copied") : t(language, "copy")}
                            </button>
                        </div>
                    )}
                </div>

                <div className="mt-6">
                    <h4 className="mb-4 text-[16px] font-bold leading-[1.333333] text-black">Editar agenda</h4>

                    <div className="mt-3">
                        <div className="flex items-center gap-4">
                            {/* Clickable avatar with camera overlay */}
                            <div className="relative flex-shrink-0">
                                <input
                                    ref={avatarInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                                    onChange={handleAvatarChange}
                                    className="hidden"
                                    id="agenda-avatar-upload-settings"
                                />
                                <button
                                    type="button"
                                    onClick={() => avatarInputRef.current?.click()}
                                    className="relative block h-14 w-14 overflow-hidden rounded-full"
                                >
                                    {agendaAvatar ? (
                                        <img src={agendaAvatar} alt="Agenda avatar" className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-white text-sm font-bold text-black/30">
                                            {(agendaName || "A")[0].toUpperCase()}
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

                            {/* Agenda name */}
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={agendaName}
                                    onChange={ev => setAgendaName(ev.target.value)}
                                    className="w-full bg-transparent text-base text-black focus:outline-none"
                                />
                            </div>
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
                                    onClick={() => setAgendaColor(item.value)}
                                    className={`h-7 w-7 flex-shrink-0 rounded-full transition-transform hover:scale-110 ${agendaColor === item.value ? "ring-2 ring-offset-2 ring-black/30" : ""}`}
                                    style={{ backgroundColor: item.value }}
                                />
                            ))}
                            <div className="flex flex-1 items-center gap-3">
                                <span
                                    className={`h-7 w-7 flex-shrink-0 rounded-full ${!AGENDA_COLORS.some(c => c.value === agendaColor) ? "ring-2 ring-offset-2 ring-black/30" : ""}`}
                                    style={{ backgroundColor: agendaColor }}
                                />
                                <input
                                    type="text"
                                    value={agendaColor}
                                    onChange={ev => setAgendaColor(ev.target.value)}
                                    placeholder="#3b82f6"
                                    className="min-w-0 flex-1 bg-transparent text-sm text-black placeholder:text-black/45 focus:outline-none"
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
                </div>

                {errorMessage && (
                    <p className="mt-3 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
                )}

                <div className="mt-6 w-full flex justify-between items-center">
                        <button
                            type="button"
                            onClick={handleSaveAgendaName}
                            disabled={
                                isRenamingAgenda ||
                            !agendaName.trim() ||
                            !hasPendingChanges
                        }
                        className="app-button-hover py-1.5 px-5 border border-black bg-black text-white rounded-full font-bold disabled:opacity-20"
                    >
                        {t(language, "save")}
                    </button>
                    <button
                        type="button"
                        className="app-button-hover rounded-full text-[14px] font-normal text-[#df535f]"
                        onClick={openDeleteAgendaModal}
                    >
                        <Trash03 className="mr-1 inline h-4 w-4" /> {t(language, "deleteAgenda")}
                    </button>
                </div>
            </div>
        </Blur>
        )}

        {isDeleteModalOpen && (
            <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto overscroll-contain bg-black/20 px-4 pt-16 pb-10" onClick={closeDeleteAgendaModal}>
                <div
                    ref={deleteModalRef}
                    className="relative mb-20 w-[32rem] max-w-full rounded-[28px] bg-[#efe5de] px-6 py-7 shadow-lg text-black"
                    onClick={ev => ev.stopPropagation()}
                >
                    <h4 className="text-[21px] font-bold leading-7 tracking-[-0.5px] text-black">
                        {t(language, "deleteAgendaConfirmTitle")}
                    </h4>
                    <p className="mt-3 text-base leading-7 text-black">
                        {t(language, "deleteAgendaConfirmMessage")}
                    </p>

                    {deleteAgendaError && (
                        <p className="mt-3 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">
                            {deleteAgendaError}
                        </p>
                    )}

                    <div className="mt-5 flex items-center gap-3">
                        <button
                            type="button"
                            disabled={isDeletingAgenda}
                            onClick={handleDeleteAgenda}
                            className="app-button-hover rounded-full bg-[#df535f] px-6 py-2 text-base font-bold text-white disabled:opacity-60"
                        >
                            {t(language, "confirmDeleteAgenda")}
                        </button>
                        <button
                            type="button"
                            disabled={isDeletingAgenda}
                            onClick={closeDeleteAgendaModal}
                            className="app-button-hover rounded-full border border-black px-6 py-2 text-base font-bold text-black disabled:opacity-60"
                        >
                            {t(language, "cancelDeleteAgenda")}
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
