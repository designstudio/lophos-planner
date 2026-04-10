import {ExtrasMenuBtn} from "./ExtrasMenuBtn.jsx";
import {useEffect} from "react";
import { openForm } from "../../scripts/utils.js";

export default function ExtrasMenu() {

    function closeExtrasMenu() {
        const extrasMenu = document.querySelector(".extras-menu");
        extrasMenu.classList.remove("active");
    }

    function openInvitePage() {
        const invitePage = document.querySelector(".invite");
        invitePage.classList.add("active");
    }

    function openSearchForm() {
        openForm("search-form");
        closeExtrasMenu();
    }

    const extrasBtns = [
        {
            text: "About",
            onClick: openInvitePage,
        },
        {
            text: "Search",
            icon: "fa-solid fa-magnifying-glass",
            onClick: openSearchForm,
        },
        {
            text: "Print",
            icon: "fa-solid fa-print",
            onClick: () => {
            },
        },
        {
            text: "Share",
            icon: "fa-regular fa-paper-plane",
            onClick: () => {
            },
        },
        {
            text: "Support",
            onClick: () => {
            },
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
             border border-black rounded-md w-28 py-2 text-center"
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