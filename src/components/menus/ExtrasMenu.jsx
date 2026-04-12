import {ExtrasMenuBtn} from "./ExtrasMenuBtn.jsx";
import {useEffect} from "react";
import { openForm } from "../../scripts/utils.js";
import { SearchMd, Send01, Globe02, ChevronDown } from "@untitledui/icons";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getAppLanguage, t } from "../../scripts/i18n.js";

export default function ExtrasMenu() {
    const { currentUser, appLanguage, setLanguagePreference } = useAuth();
    const language = appLanguage || getAppLanguage(currentUser?.language);

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
            {
                text: t(language, "share"),
                icon: Send01,
                onClick: openShareForm,
            },
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
            className="extras-menu text-black bg-white dark:bg-stone-800 dark:text-white
             border border-black rounded-md w-48 py-2 text-center"
            onClick={ev => ev.stopPropagation()}>
            <ul>
                {
                    extrasBtns.map((btn, index) => (
                        <ExtrasMenuBtn {...btn} key={index}/>
                    ))
                }
            </ul>
            <div className="mx-3 mt-2 border-t border-[rgba(0,0,0,0.12)] py-3">
                <label className="flex items-center gap-2 px-1 text-sm text-black">
                    <Globe02 className="h-[18px] w-[18px] shrink-0" />
                    <div className="relative flex-1">
                        <select
                            value={language}
                            onChange={ev => setLanguagePreference(ev.target.value)}
                            className="w-full appearance-none bg-transparent pr-6 text-sm text-black outline-none"
                        >
                            <option value="ptBR">{t(language, "portugueseBrazil")}</option>
                            <option value="enUS">{t(language, "english")}</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
                    </div>
                </label>
            </div>
        </div>
    )
}
