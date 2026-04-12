import {ExtrasMenuBtn} from "./ExtrasMenuBtn.jsx";
import {useEffect} from "react";
import { openForm } from "../../scripts/utils.js";
import { SearchMd, Send01 } from "@untitledui/icons";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getAppLanguage, t } from "../../scripts/i18n.js";

export default function ExtrasMenu() {
    const { currentUser } = useAuth();
    const language = getAppLanguage(currentUser?.language);

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
    ];

    useEffect(() => {
        window.addEventListener("click", () => {
            const extrasMenu = document.querySelector(".extras-menu");
            extrasMenu.classList.remove("active");
        })

        window.addEventListener("scroll", () => {
            const extrasMenu = document.querySelector(".extras-menu");
            extrasMenu.classList.remove("active");
        })
    }, []);

    return (
        <div
            className="extras-menu text-black bg-white dark:bg-stone-800 dark:text-white
             border border-black rounded-md w-40 py-2 text-center"
            onClick={ev => ev.stopPropagation()}>
            <ul>
                {
                    extrasBtns.map((btn, index) => (
                        <ExtrasMenuBtn {...btn} key={index}/>
                    ))
                }
            </ul>
        </div>
    )
}