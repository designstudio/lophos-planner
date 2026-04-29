import {ExtrasMenuBtn} from "./ExtrasMenuBtn.jsx";
import {useEffect, useRef} from "react";
import { openForm } from "../../scripts/utils.js";
import { SearchMd, Send01, Globe02 } from "@untitledui/icons";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getAppLanguage, t } from "../../scripts/i18n.js";
import OptionMenuSelect from "../ui/OptionMenuSelect.jsx";

export default function ExtrasMenu() {
    const { currentUser, appLanguage, setLanguagePreference, agendas } = useAuth();
    const language = appLanguage || getAppLanguage(currentUser?.language);
    const currentAgenda = agendas.find(agenda => String(agenda.id) === String(currentUser?.currentAgendaId));
    const extrasMenuRef = useRef(null);

    function closeExtrasMenu() {
        const extrasMenu = document.querySelector(".extras-menu");
        extrasMenu.classList.remove("active");
    }

    function openInvitePage() {
        const invitePage = document.querySelector(".invite");
        invitePage.classList.add("active");
        closeExtrasMenu();
    }

    function openSearchForm() {
        openForm("search-form");
        closeExtrasMenu();
    }

    function openShareForm() {
        openForm("share-settings-form");
        closeExtrasMenu();
    }

    const extrasBtns = [
        {
            text: t(language, "about"),
            onClick: openInvitePage,
        },
        ...(currentUser ? [
            {
                text: t(language, "search"),
                icon: SearchMd,
                onClick: openSearchForm,
            },
            ...(currentAgenda?.role === "owner" ? [{
                text: t(language, "share"),
                icon: Send01,
                onClick: openShareForm,
            }] : []),
        ] : []),
    ];

    useEffect(() => {
        function handleClick() {
            const extrasMenu = document.querySelector(".extras-menu");
            extrasMenu?.classList.remove("active");
        }

        function handleScroll() {
            const extrasMenu = document.querySelector(".extras-menu");
            extrasMenu?.classList.remove("active");
        }

        window.addEventListener("click", handleClick);
        window.addEventListener("scroll", handleScroll, { passive: true });

        return () => {
            window.removeEventListener("click", handleClick);
            window.removeEventListener("scroll", handleScroll);
        };
    }, []);

    return (
        <div
            ref={extrasMenuRef}
            className="extras-menu option-menu-surface text-black dark:bg-stone-800 dark:text-white w-48 p-1.5 text-center"
            onClick={ev => ev.stopPropagation()}>
            <ul className="px-0.5">
                {
                    extrasBtns.map((btn, index) => (
                        <ExtrasMenuBtn {...btn} key={index}/>
                    ))
                }
            </ul>
            <div className="mx-1.5 mt-2 border-t border-[rgba(0,0,0,0.12)] py-2.5">
                <label className="flex items-center gap-2 px-1.5 text-sm text-black">
                    <Globe02 className="h-[18px] w-[18px] shrink-0" />
                    <OptionMenuSelect
                        value={language}
                        onChange={value => setLanguagePreference(value)}
                        portalAnchorRef={extrasMenuRef}
                        wrapperClassName="flex-1"
                        triggerClassName="bg-transparent pr-6 text-sm text-black outline-none"
                        portalGap={0}
                        options={[
                            { value: "ptBR", label: t(language, "portugueseBrazil") },
                            { value: "enUS", label: t(language, "english") },
                        ]}
                    />
                </label>
            </div>
        </div>
    )
}
