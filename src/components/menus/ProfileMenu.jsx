import {useAuth} from "../../contexts/AuthContext.jsx";
import {closeForm, openForm} from "../../scripts/utils.js";
import { Settings01, LogOut01 } from "@untitledui/icons";
import { getAppLanguage, t } from "../../scripts/i18n.js";

export default function ProfileMenu({ isOpen = false, style = {}, onClose = () => {} }) {

    const { currentUser, logout, agendas, switchAgenda } = useAuth();
    const language = getAppLanguage(currentUser?.language);
    const currentAgenda = agendas.find(agenda => String(agenda.id) === String(currentUser?.currentAgendaId));
    const canManageCurrentAgenda = currentAgenda?.role === "owner";
    const orderedAgendas = [
        ...(currentAgenda ? [currentAgenda] : []),
        ...agendas.filter(agenda => String(agenda.id) !== String(currentUser?.currentAgendaId)),
    ];

    function openUpdateUserForm() {
        openForm("update-user-form");
        onClose();
    }

    function isImageAvatar(value) {
        return typeof value === "string" && (value.startsWith("data:image/") || value.startsWith("http://") || value.startsWith("https://"));
    }

    function openAgendaSettingsForm() {
        openForm("share-settings-form");
        onClose();
    }

    async function openAgendaSettingsFor(agendaId) {
        await switchAgenda(agendaId);
        openForm("share-settings-form");
        onClose();
    }

    function openCreateAgendaForm() {
        closeForm("update-user-form");
        closeForm("share-settings-form");
        openForm("create-agenda-form");
        onClose();
    }

    async function handleSwitchAgenda(agendaId) {
        await switchAgenda(agendaId);
        onClose();
    }

    return (
        <div className={`profile-menu ${isOpen ? "active" : ""} option-menu-surface rounded-ds-xl text-ds-text-default w-64 p-4 -translate-x-[50%] text-center`}
             style={{ ...style, borderRadius: "var(--radius-xl)" }}
             onClick={ev => ev.stopPropagation()}>
            <div className="text-left pb-3">
                <h4 className="ds-type-body truncate font-semibold text-ds-text-default">
                    {currentUser?.name}
                </h4>
                <p className="ds-type-caption truncate text-ds-text-subtle">
                    {currentUser?.email}
                </p>
            </div>

            <div className="border-t border-ds-border-default" />

            <div className="mt-3 space-y-2 text-left">
                {orderedAgendas.map(agenda => (
                    (() => {
                        const isActive = String(agenda.id) === String(currentUser?.currentAgendaId);

                        return (
                    <div
                        key={agenda.id}
                        className={`rounded-ds-lg px-3 py-2 transition-colors duration-150 ${isActive ? "agenda-accent-soft-bg" : "bg-ds-background-surface hover:agenda-accent-soft-bg"}`}
                        style={{ borderRadius: "var(--radius-lg)" }}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div
                                className={`flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-ds-full bg-ds-background-surface text-center ds-type-caption text-ds-text-default ${isImageAvatar((agenda.avatar || "").trim()) ? "" : "border border-ds-border-strong"}`}
                                style={{ borderRadius: "var(--radius-full)" }}
                            >
                                {isImageAvatar((agenda.avatar || "").trim()) ? (
                                    <img
                                        src={agenda.avatar}
                                        alt={agenda.name}
                                        className="h-full w-full rounded-ds-full object-cover"
                                        style={{ borderRadius: "var(--radius-full)" }}
                                    />
                                ) : (
                                    (agenda.name || "A").trim().slice(0, 1).toUpperCase()
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={async () => await handleSwitchAgenda(agenda.id)}
                                className={`ds-type-body-sm flex-1 truncate text-left text-ds-text-default ${isActive ? "font-bold" : "font-normal"}`}
                            >
                                {agenda.name}
                            </button>
                            {isActive && canManageCurrentAgenda && (
                                <button
                                    type="button"
                                    onClick={async () => await openAgendaSettingsFor(agenda.id)}
                                    className="ds-type-caption inline-flex min-h-[28px] items-center justify-center rounded-ds-full px-3 py-1 text-ds-text-default"
                                    style={{
                                        backgroundColor: "var(--agenda-accent-soft)",
                                        borderRadius: "var(--radius-full)",
                                        lineHeight: "1",
                                    }}
                                >
                                    {t(language, "settings")}
                                </button>
                            )}
                        </div>
                    </div>
                        );
                    })()
                ))}
            </div>

            <button
                type="button"
                onClick={openCreateAgendaForm}
                className="ds-button-primary ds-type-button app-button-hover mt-3 w-full px-3 py-1.5"
                style={{
                    backgroundColor: "var(--color-text-default)",
                    color: "var(--color-text-inverse)",
                    borderRadius: "var(--radius-full)",
                }}
            >
                {t(language, "newAgenda")}
            </button>

            <div className="ds-type-body-sm mt-3 flex w-full justify-between border-t border-ds-border-default pt-4 pb-1">
                <button
                    type="button"
                    onClick={openUpdateUserForm}
                    className="inline-flex items-center gap-1.5 leading-none"
                >
                    <Settings01 className="h-4 w-4 shrink-0" />
                    <span>{t(language, "account")}</span>
                </button>
                <button
                    type="button"
                    onClick={async () => await logout()}
                    className="inline-flex items-center gap-1.5 leading-none"
                >
                    <LogOut01 className="h-4 w-4 shrink-0" />
                    <span>{t(language, "logout")}</span>
                </button>
            </div>
        </div>
    )
}
