import React from "react";
import Blur from "../Blur.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getAgendaMembers, getShareSettings, setShareEnabled } from "../../scripts/api.js";
import { getAppLanguage, t } from "../../scripts/i18n.js";
import { Camera01, MagicWand01, Check, Trash03, Link01, ImageUserPlus, Plus } from "@untitledui/icons";
import { closeForm, openForm, subscribeToModalState } from "../../scripts/utils.js";

const MAX_AVATAR_SIZE_BYTES = 100 * 1024;
const DEFAULT_AGENDA_COLOR = "var(--color-brand-accent)";
const AGENDA_COLORS = [
    { nameKey: "primary", value: "var(--color-brand-primary)" },
    { nameKey: "accent", value: "var(--color-brand-accent)" },
    { nameKey: "success", value: "var(--color-success-solid)" },
    { nameKey: "warning", value: "var(--color-warning-solid)" },
    { nameKey: "danger", value: "var(--color-danger-solid)" },
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
    const [agendaColor, setAgendaColor] = React.useState(DEFAULT_AGENDA_COLOR);
    const [sortCompletedTasks, setSortCompletedTasks] = React.useState(true);
    const [relatedLinksEnabled, setRelatedLinksEnabled] = React.useState(true);
    const [agendaMembers, setAgendaMembers] = React.useState([]);
    const [membersLoading, setMembersLoading] = React.useState(false);
    const [isRenamingAgenda, setIsRenamingAgenda] = React.useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
    const [isDeletingAgenda, setIsDeletingAgenda] = React.useState(false);
    const [deleteAgendaError, setDeleteAgendaError] = React.useState("");
    const [avatarLoading, setAvatarLoading] = React.useState(false);
    const deleteModalRef = React.useRef(null);
    const deleteConfirmButtonRef = React.useRef(null);
    const deleteCancelButtonRef = React.useRef(null);
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
        setAgendaColor(currentAgenda?.color || DEFAULT_AGENDA_COLOR);
        setSortCompletedTasks(currentAgenda?.sort_completed_tasks ?? true);
        setRelatedLinksEnabled(currentAgenda?.related_links_enabled ?? true);
    }, [
        currentAgenda?.id,
        currentAgenda?.name,
        currentAgenda?.avatar,
        currentAgenda?.color,
        currentAgenda?.sort_completed_tasks,
        currentAgenda?.related_links_enabled,
    ]);

    React.useEffect(() => {
        let mounted = true;

        async function loadAgendaMembers() {
            if (!currentAgenda?.id) {
                setAgendaMembers([]);
                setMembersLoading(false);
                return;
            }

            try {
                setMembersLoading(true);
                const members = await getAgendaMembers(currentAgenda.id);
                if (!mounted) return;
                setAgendaMembers(Array.isArray(members) ? members : []);
            } catch (err) {
                if (!mounted) return;
                console.error("[SHARE SETTINGS] load agenda members error", err);
                setAgendaMembers([]);
            } finally {
                if (mounted) setMembersLoading(false);
            }
        }

        loadAgendaMembers();
        return () => {
            mounted = false;
        };
    }, [currentAgenda?.id]);

    React.useEffect(() => {
        return subscribeToModalState("share-settings-form", isOpen => {
            if (!isOpen) return;
            setAgendaName(currentAgenda?.name || "");
            setAgendaAvatar(currentAgenda?.avatar || "");
            setAgendaColor(currentAgenda?.color || DEFAULT_AGENDA_COLOR);
            setSortCompletedTasks(currentAgenda?.sort_completed_tasks ?? true);
            setRelatedLinksEnabled(currentAgenda?.related_links_enabled ?? true);
            setLocalShareEnabled(initialShareEnabled);
            setErrorMessage("");
        });
    }, [
        currentAgenda?.id,
        currentAgenda?.name,
        currentAgenda?.avatar,
        currentAgenda?.color,
        currentAgenda?.sort_completed_tasks,
        currentAgenda?.related_links_enabled,
        initialShareEnabled,
    ]);

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
            deleteCancelButtonRef.current?.focus?.();
        });
    }, [isDeleteModalOpen]);

    React.useEffect(() => {
        function handleKeyDown(ev) {
            if (!isDeleteModalOpen) return;

            if (ev.key === "Escape") {
                if (isDeletingAgenda) return;
                ev.preventDefault();
                closeDeleteAgendaModal();
                return;
            }

            if (ev.key !== "Tab") return;

            const focusableElements = [
                deleteConfirmButtonRef.current,
                deleteCancelButtonRef.current,
            ].filter(Boolean);

            if (focusableElements.length === 0) return;

            const currentIndex = focusableElements.indexOf(document.activeElement);
            const nextIndex = ev.shiftKey
                ? (currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1)
                : (currentIndex === -1 || currentIndex === focusableElements.length - 1 ? 0 : currentIndex + 1);

            ev.preventDefault();
            focusableElements[nextIndex]?.focus?.();
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
        const prevColor = (currentAgenda?.color || DEFAULT_AGENDA_COLOR).trim();
        const prevSortCompletedTasks = currentAgenda?.sort_completed_tasks ?? true;
        const prevRelatedLinksEnabled = currentAgenda?.related_links_enabled ?? true;

        return (
            agendaName.trim() !== prevName ||
            agendaAvatar.trim() !== prevAvatar ||
            (agendaColor.trim() || DEFAULT_AGENDA_COLOR) !== prevColor ||
            sortCompletedTasks !== prevSortCompletedTasks ||
            relatedLinksEnabled !== prevRelatedLinksEnabled
        );
    }, [agendaName, agendaAvatar, agendaColor, sortCompletedTasks, relatedLinksEnabled, currentAgenda]);

    const hasShareChanges = shareEnabled !== initialShareEnabled;
    const hasPendingChanges = hasAgendaChanges || hasShareChanges;

    async function handleSaveAgendaName() {
        if (!currentAgenda?.id) return;
        const nextName = agendaName.trim();
        const nextAvatar = agendaAvatar.trim();
        const nextColor = agendaColor.trim() || DEFAULT_AGENDA_COLOR;
        const prevName = (currentAgenda?.name || "").trim();
        const prevAvatar = (currentAgenda?.avatar || "").trim();
        const prevColor = (currentAgenda?.color || DEFAULT_AGENDA_COLOR).trim();
        const prevSortCompletedTasks = currentAgenda?.sort_completed_tasks ?? true;
        const prevRelatedLinksEnabled = currentAgenda?.related_links_enabled ?? true;
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
            const result = await renameAgenda(currentAgenda.id, nextName, nextAvatar, nextColor, sortCompletedTasks, relatedLinksEnabled);
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
    const canManageAgenda = (currentAgenda?.role || "owner") === "owner";
    const membersCopy = {
        title: t(language, "membersTitle"),
        invite: t(language, "inviteMember"),
        creator: t(language, "creator"),
        member: t(language, "memberFallback"),
        empty: t(language, "noMembersYet"),
    };
    const orderedAgendaMembers = React.useMemo(() => {
        return [...agendaMembers].sort((left, right) => {
            if (left?.role === right?.role) return 0;
            if (left?.role === "owner") return -1;
            if (right?.role === "owner") return 1;
            return 0;
        });
    }, [agendaMembers]);
    const displayAgendaMembers = React.useMemo(() => {
        const members = Array.isArray(orderedAgendaMembers) ? [...orderedAgendaMembers] : [];
        const ownerUid = currentAgenda?.uid || currentUser?.uid || null;
        const hasOwner = members.some(member => member?.role === "owner" || String(member?.uid) === String(ownerUid));

        if (!hasOwner && ownerUid) {
            members.unshift({
                uid: ownerUid,
                name: currentUser?.name || currentAgenda?.name || t(language, "creator"),
                email: currentUser?.email || "",
                avatar: currentUser?.avatar || "",
                role: "owner",
                created_at: currentAgenda?.created_at || null,
            });
        }

        return members;
    }, [orderedAgendaMembers, currentAgenda?.uid, currentAgenda?.created_at, currentAgenda?.name, currentUser?.uid, currentUser?.name, currentUser?.email, currentUser?.avatar, language]);
    const hasDisplayAgendaMembers = displayAgendaMembers.length > 0;

    function getMemberInitials(member) {
        const source = (member?.name || member?.email || "M").trim();
        const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
        const initials = parts.map(part => part[0]?.toUpperCase()).join("");
        return initials || "M";
    }

    return (
        <>
        {!isDeleteModalOpen && (
        <Blur type="share-settings-form">
            <div
                className="share-settings-form ds-modal-shell relative z-20 mb-6 w-[32rem] max-w-full px-6 py-7 transition-all duration-500 ease-linear"
                onClick={ev => ev.stopPropagation()}
            >
                <h3 className="ds-type-h4 text-ds-text-default">{t(language, "agendaSettingsTitle")}</h3>

                <div
                    className="mt-6 rounded-lg bg-ds-text-default p-4 text-ds-text-inverse"
                    style={{
                        backgroundColor: "var(--color-text-default)",
                        color: "var(--color-text-inverse)",
                        borderRadius: "var(--radius-lg)",
                    }}
                >
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="ds-type-caption font-bold">{t(language, "sharePublishWeb")}</p>
                            <p className="ds-type-body">{t(language, "sharePublishDescription")}</p>
                        </div>

                        <button
                            type="button"
                            className={`relative box-border h-6 w-11 appearance-none rounded-full border-2 shadow-none transition-colors focus:outline-none ${
                                shareEnabled
                                    ? "border-ds-background-surface bg-ds-background-surface"
                                    : "border-ds-background-surface bg-ds-text-default"
                            }`}
                            onClick={handleToggleShare}
                            disabled={loading}
                            style={{
                                backgroundColor: shareEnabled ? "var(--color-bg-surface)" : "var(--color-text-default)",
                                borderRadius: "var(--radius-full)",
                            }}
                        >
                            <div className={`h-4 w-4 absolute left-0.5 top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center transition-all transform ${
                                shareEnabled
                                    ? "translate-x-[20px] bg-ds-text-default"
                                    : "translate-x-0 bg-ds-background-surface"
                            }`}
                                style={{
                                    backgroundColor: shareEnabled ? "var(--color-text-default)" : "var(--color-bg-surface)",
                                    borderRadius: "var(--radius-full)",
                                }}>
                                {shareEnabled && <Check className="h-3 w-3 text-ds-text-inverse" strokeWidth={3} />}
                            </div>
                        </button>
                    </div>

                    {shareEnabled && (
                        <div
                            className="mt-4 flex items-center gap-2 rounded-md bg-ds-background-surface p-2"
                            style={{
                                backgroundColor: "var(--color-bg-page)",
                                borderRadius: "var(--radius-md)",
                            }}
                        >
                            <label htmlFor="public-share-url" className="sr-only">{t(language, "shareTitle")}</label>
                            <input
                                id="public-share-url"
                                type="text"
                                value={publicShareUrl}
                                readOnly
                                className="ds-type-body w-full bg-transparent px-2 text-ds-text-default focus:outline-none"
                                style={{ color: "var(--color-text-default)" }}
                            />
                            <button
                                type="button"
                                onClick={copyShareUrl}
                                disabled={!shareToken}
                                className="app-button-hover ds-button-primary ds-type-button rounded-full px-4 py-1.5 disabled:opacity-20"
                                style={{
                                    backgroundColor: "var(--color-text-default)",
                                    color: "var(--color-text-inverse)",
                                    borderRadius: "var(--radius-full)",
                                }}
                            >
                                {copied ? t(language, "copied") : t(language, "copy")}
                            </button>
                        </div>
                    )}
                </div>

                <div className="mt-6">
                    <h4 className="ds-type-label mb-4 text-ds-text-default">{t(language, "editAgendaSectionTitle")}</h4>

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
                                    className="relative block h-14 w-14 overflow-hidden rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-border-default focus-visible:ring-offset-2"
                                    style={{
                                        backgroundColor: "var(--color-text-default)",
                                        borderRadius: "var(--radius-full)",
                                    }}
                                >
                                    {agendaAvatar ? (
                                        <img src={agendaAvatar} alt={t(language, "agendaAvatarAlt")} className="h-full w-full object-cover" />
                                    ) : (
                                        <div
                                            className="ds-type-button flex h-full w-full items-center justify-center text-ds-text-inverse"
                                            style={{ backgroundColor: "var(--color-text-default)" }}
                                        >
                                            {(agendaName || "A")[0].toUpperCase()}
                                        </div>
                                    )}
                                </button>
                                <div
                                    className="pointer-events-none absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-ds-text-default"
                                    style={{
                                        backgroundColor: "var(--color-text-default)",
                                        borderRadius: "var(--radius-full)",
                                    }}
                                >
                                    {avatarLoading ? (
                                        <svg className="h-[10px] w-[10px] animate-spin text-ds-text-inverse" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                    ) : (
                                        <Camera01
                                            className="h-[10px] w-[10px] text-ds-text-inverse"
                                            style={{ color: "var(--color-text-inverse)" }}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Agenda name */}
                            <div className="flex-1">
                                <label htmlFor="agenda-name-settings" className="sr-only">{t(language, "agendaName")}</label>
                                <input
                                    id="agenda-name-settings"
                                    type="text"
                                    value={agendaName}
                                    onChange={ev => setAgendaName(ev.target.value)}
                                    className="ds-type-body w-full bg-transparent text-ds-text-default focus:outline-none"
                                    aria-label={t(language, "agendaName")}
                                />
                            </div>
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
                                    onClick={() => setAgendaColor(item.value)}
                                    className={`h-7 w-7 flex-shrink-0 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-border-default focus-visible:ring-offset-2 ${agendaColor === item.value ? "ring-2 ring-ds-border-strong ring-offset-2" : ""}`}
                                    style={{ backgroundColor: item.value }}
                                />
                            ))}
                            <div className="flex flex-1 items-center gap-3">
                                <span
                                    className={`h-7 w-7 flex-shrink-0 rounded-full ${!AGENDA_COLORS.some(c => c.value === agendaColor) ? "ring-2 ring-ds-border-strong ring-offset-2" : ""}`}
                                    style={{ backgroundColor: agendaColor }}
                                />
                                <input
                                    type="text"
                                    value={agendaColor}
                                    onChange={ev => setAgendaColor(ev.target.value)}
                                    placeholder={DEFAULT_AGENDA_COLOR}
                                    className="ds-type-body-sm min-w-0 flex-1 bg-transparent text-ds-text-default placeholder:text-ds-text-subtle focus:outline-none"
                                    aria-label={t(language, "agendaColor")}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 border-t border-ds-border-muted" />

                    <div className="mt-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h4 className="ds-type-label text-ds-text-default">{membersCopy.title}</h4>
                            </div>
                        </div>

                        <div className="mt-4">
                            {membersLoading ? (
                                <p className="ds-type-body-sm text-ds-text-muted">
                                    {t(language, "loadingShort")}
                                </p>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => canManageAgenda && openForm("invite-collaborator-form")}
                                    disabled={!canManageAgenda}
                                    className="inline-flex w-auto items-center bg-transparent p-0 text-left shadow-none disabled:cursor-default disabled:opacity-20"
                                >
                                    <div className="flex items-center gap-0 pr-1">
                                        {displayAgendaMembers.slice(0, 4).map((member, index) => {
                                            const isOwner = member.role === "owner";
                                            const displayName = (member.name || member.email || t(language, "memberFallback")).trim();

                                            return (
                                                <div
                                                    key={member.uid || member.email || displayName}
                                                    className={`group/member-avatar relative ${index === 0 ? "" : "-ml-2.5"}`}
                                                >
                                                    <div
                                                        className="relative h-9 w-9 overflow-hidden rounded-full border-2 border-ds-background-surface"
                                                    >
                                                        {member.avatar ? (
                                                            <img
                                                                src={member.avatar}
                                                                alt={displayName}
                                                                className="h-full w-full object-cover"
                                                            />
                                                        ) : (
                                                            <div
                                                                className={`ds-type-caption flex h-full w-full items-center justify-center font-bold ${isOwner ? "bg-ds-text-default text-ds-text-inverse" : "bg-ds-background-surface text-ds-text-default"}`}
                                                                style={!isOwner ? { backgroundColor: "var(--color-bg-page)" } : undefined}
                                                            >
                                                                {getMemberInitials(member)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p className="pointer-events-none absolute bottom-[120%] left-1/2 z-20 w-max max-w-[16rem] -translate-x-1/2 rounded-ds-sm tooltip-surface p-1 text-left ds-type-caption opacity-0 transition-opacity delay-0 duration-150 ease-linear whitespace-normal break-words group-hover/member-avatar:opacity-100 group-hover/member-avatar:delay-[700ms]">
                                                        {displayName}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div
                                        className="ds-type-button ml-[3px] flex min-h-10 flex-1 items-center justify-center gap-1 rounded-full border-0 bg-ds-background-surface-muted px-4 py-[0.4rem] text-ds-text-default transition-opacity hover:opacity-70"
                                        style={{ backgroundColor: "var(--color-bg-surface-muted)" }}
                                    >
                                        <Plus className="h-4 w-4 shrink-0" />
                                        <span>{membersCopy.invite}</span>
                                    </div>
                                </button>
                            )}
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
                                style={{
                                    backgroundColor: sortCompletedTasks ? "var(--color-text-default)" : "var(--color-bg-surface)",
                                    borderColor: "var(--color-text-default)",
                                    borderRadius: "var(--radius-full)",
                                }}
                            >
                                <div className={`h-4 w-4 absolute left-0.5 top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center transition-all transform ${
                                    sortCompletedTasks
                                        ? "translate-x-[20px] bg-ds-background-surface"
                                        : "translate-x-0 bg-ds-text-default"
                                }`}
                                    style={{
                                        backgroundColor: sortCompletedTasks ? "var(--color-bg-surface)" : "var(--color-text-default)",
                                        borderRadius: "var(--radius-full)",
                                    }}>
                                    {sortCompletedTasks && (
                                        <Check className="h-3 w-3 text-ds-text-default" strokeWidth={3} />
                                    )}
                                </div>
                            </button>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <Link01 className="h-4 w-4 text-ds-text-default" />
                                <span className="ds-type-body text-ds-text-default">{t(language, "relatedLinksFeatureLabel")}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setRelatedLinksEnabled(!relatedLinksEnabled)}
                                className={`relative box-border h-6 w-11 appearance-none rounded-full border-2 shadow-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-border-default focus-visible:ring-offset-2 ${
                                    relatedLinksEnabled
                                        ? "border-ds-text-default bg-ds-text-default"
                                        : "border-ds-text-default bg-ds-background-surface"
                                }`}
                                aria-pressed={relatedLinksEnabled}
                                aria-label={t(language, "relatedLinksFeatureLabel")}
                                style={{
                                    backgroundColor: relatedLinksEnabled ? "var(--color-text-default)" : "var(--color-bg-surface)",
                                    borderColor: "var(--color-text-default)",
                                    borderRadius: "var(--radius-full)",
                                }}
                            >
                                <div className={`h-4 w-4 absolute left-0.5 top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center transition-all transform ${
                                    relatedLinksEnabled
                                        ? "translate-x-[20px] bg-ds-background-surface"
                                        : "translate-x-0 bg-ds-text-default"
                                }`}
                                    style={{
                                        backgroundColor: relatedLinksEnabled ? "var(--color-bg-surface)" : "var(--color-text-default)",
                                        borderRadius: "var(--radius-full)",
                                    }}>
                                    {relatedLinksEnabled && (
                                        <Check className="h-3 w-3 text-ds-text-default" strokeWidth={3} />
                                    )}
                                </div>
                            </button>
                        </div>
                    </div>

                    </div>
                {errorMessage && (
                    <p className="ds-alert ds-alert-danger mt-3">{errorMessage}</p>
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
                        className="app-button-hover ds-button-primary ds-type-body rounded-full border border-transparent px-5 py-1.5 font-bold disabled:opacity-20"
                        style={{
                            backgroundColor: "var(--color-text-default)",
                            color: "var(--color-text-inverse)",
                            borderRadius: "var(--radius-full)",
                        }}
                    >
                        {t(language, "save")}
                    </button>
                    <button
                        type="button"
                        className="app-button-hover ds-danger-trigger-hover ds-type-button rounded-full px-3 py-2 font-normal text-ds-danger-solid"
                        onClick={openDeleteAgendaModal}
                    >
                        <Trash03 className="mr-1 inline h-4 w-4" /> {t(language, "deleteAgenda")}
                    </button>
                </div>
            </div>
        </Blur>
        )}

        {isDeleteModalOpen && (
            <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto overscroll-contain px-4 pb-10 pt-16 ds-overlay" onClick={closeDeleteAgendaModal}>
                <div
                    ref={deleteModalRef}
                    className="ds-modal-shell relative mb-6 w-[32rem] max-w-full px-6 py-7"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="delete-agenda-modal-title"
                    aria-describedby="delete-agenda-modal-description"
                    onClick={ev => ev.stopPropagation()}
                >
                    <h4 id="delete-agenda-modal-title" className="ds-type-h4 text-ds-text-default">
                        {t(language, "deleteAgendaConfirmTitle")}
                    </h4>
                    <p id="delete-agenda-modal-description" className="ds-type-body mt-3 text-ds-text-default">
                        {t(language, "deleteAgendaConfirmMessage")}
                    </p>

                    {deleteAgendaError && (
                        <p className="ds-alert ds-alert-danger mt-3">
                            {deleteAgendaError}
                        </p>
                    )}

                    <div className="mt-5 flex items-center gap-3">
                        <button
                            ref={deleteConfirmButtonRef}
                            type="button"
                            disabled={isDeletingAgenda}
                            onClick={handleDeleteAgenda}
                            className="app-button-hover ds-button-danger ds-type-body rounded-full px-6 py-2 font-bold disabled:opacity-20"
                        >
                            {t(language, "confirmDeleteAgenda")}
                        </button>
                        <button
                            ref={deleteCancelButtonRef}
                            type="button"
                            disabled={isDeletingAgenda}
                            onClick={closeDeleteAgendaModal}
                            className="app-button-hover ds-button-secondary ds-type-body rounded-full px-6 py-2 font-bold disabled:opacity-20"
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



