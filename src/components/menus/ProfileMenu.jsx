import {useAuth} from "../../contexts/AuthContext.jsx";
import {useEffect} from "react";
import {closeForm, openForm} from "../../scripts/utils.js";
import { Settings01, LogOut01 } from "@untitledui/icons";
import { getAppLanguage, t } from "../../scripts/i18n.js";

export default function ProfileMenu() {

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
        document.querySelector(".profile-menu ").classList.remove("active");
    }

    function isImageAvatar(value) {
        return typeof value === "string" && (value.startsWith("data:image/") || value.startsWith("http://") || value.startsWith("https://"));
    }

    function openAgendaSettingsForm() {
        openForm("share-settings-form");
        document.querySelector(".profile-menu ").classList.remove("active");
    }

    async function openAgendaSettingsFor(agendaId) {
        await switchAgenda(agendaId);
        openForm("share-settings-form");
        document.querySelector(".profile-menu ").classList.remove("active");
    }

    function openCreateAgendaForm() {
        closeForm("update-user-form");
        closeForm("share-settings-form");
        openForm("create-agenda-form");
        document.querySelector(".profile-menu ").classList.remove("active");
    }

    async function handleSwitchAgenda(agendaId) {
        await switchAgenda(agendaId);
        document.querySelector(".profile-menu ").classList.remove("active");
    }

    useEffect(() => {
        window.addEventListener("click", () => {
            const profileMenu = document.querySelector(".profile-menu");
            profileMenu.classList.remove("active");
        })

        window.addEventListener("scroll", () => {
            const profileMenu = document.querySelector(".profile-menu");
            profileMenu.classList.remove("active");
        })
    }, []);

    return (
        <div className="profile-menu text-black bg-white dark:bg-stone-800 dark:text-white
         border border-black rounded-md w-64 p-4 -translate-x-[50%] text-center"
             onClick={ev => ev.stopPropagation()}>
            <div className="text-left pb-3">
                <h4 className="truncate text-[16px] font-semibold leading-5 text-black dark:text-white">
                    {currentUser?.name}
                </h4>
                <p className="truncate text-[13px] leading-5 text-[#858585]">
                    {currentUser?.email}
                </p>
            </div>

            <div className="border-t border-[rgba(0,0,0,0.12)]" />

            <div className="mt-3 space-y-2 text-left">
                {orderedAgendas.map(agenda => (
                    (() => {
                        const isActive = String(agenda.id) === String(currentUser?.currentAgendaId);

                        return (
                    <div
                        key={agenda.id}
                        className={`rounded-md px-3 py-2 transition-colors duration-150 ${isActive ? "agenda-accent-soft-bg" : "bg-white hover:agenda-accent-soft-bg"}`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className={`h-6 w-6 shrink-0 rounded-full bg-white text-center text-[12px] leading-6 text-black ${isImageAvatar((agenda.avatar || "").trim()) ? "" : "border border-black/30"}`}>
                                {isImageAvatar((agenda.avatar || "").trim()) ? (
                                    <img src={agenda.avatar} alt={agenda.name} className="h-full w-full rounded-full object-cover" />
                                ) : (
                                    (agenda.name || "A").trim().slice(0, 1).toUpperCase()
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={async () => await handleSwitchAgenda(agenda.id)}
                                className={`flex-1 truncate text-left text-[14px] leading-5 text-black ${isActive ? "font-bold" : "font-normal"}`}
                            >
                                {agenda.name}
                            </button>
                            {isActive && canManageCurrentAgenda && (
                                <button
                                    type="button"
                                    onClick={async () => await openAgendaSettingsFor(agenda.id)}
                                    className="rounded-full px-3 py-1 text-[12px] text-black"
                                    style={{ backgroundColor: 'var(--agenda-accent-soft)' }}
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
                className="app-button-hover mt-3 w-full rounded-full bg-black px-3 py-1.5 text-[14px] font-[700] text-white"
            >
                {t(language, "newAgenda")}
            </button>

            <div className="mt-3 flex w-full justify-between border-t border-[#e5e5e5] pt-4 pb-1 text-sm dark:border-gray-700">
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
