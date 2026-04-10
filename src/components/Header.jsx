import React from "react"
import HeaderBtn from "./HeaderBtn"
import {useSearchParams} from "react-router-dom";
import {useAuth} from "../contexts/AuthContext.jsx";
import ProfileMenu from "./menus/ProfileMenu.jsx";
import ExtrasMenu from "./menus/ExtrasMenu.jsx";
import {clearUsersTasks} from "../scripts/api.js";
import {openForm} from "../scripts/utils.js";

const Header = () => {

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const [searchParams, setSearchParams] = useSearchParams();

    const newDate = new Date();
    if (searchParams.get("weekShift")) {
        newDate.setDate(newDate.getDate() + (+searchParams.get("weekShift") * 7));
    }

    function openLoginForm() {
        openForm("login-form");
    }

    function openProfileMenu(ev) {
        ev.stopPropagation();
        const profileMenu = document.querySelector(".profile-menu");
        profileMenu.classList.add("active");
        document.querySelector(".extras-menu").classList.remove("active");
        const buttonPos = ev.currentTarget.getBoundingClientRect();
        profileMenu.style.left = `${Math.round(buttonPos.left + buttonPos.width / 2)}px`;
        profileMenu.style.top = `${Math.round(buttonPos.bottom) + 8}px`;
    }

    function openExtrasMenu(ev) {
        ev.stopPropagation();
        const extrasMenu = document.querySelector(".extras-menu");
        extrasMenu.classList.add("active");
        document.querySelector(".profile-menu").classList.remove("active");
        const buttonPos = ev.currentTarget.getBoundingClientRect();
        extrasMenu.style.right = `${Math.round(window.innerWidth - buttonPos.right - 15)}px`;
        extrasMenu.style.top = `${Math.round(buttonPos.bottom) + 8}px`;
    }

    function toPrevWeek() {
        let curShift = +searchParams.get("weekShift") || 0;
        setSearchParams(prevSearchParams => {
            prevSearchParams.set("weekShift", `${--curShift}`);
            return prevSearchParams;
        })
    }

    function toNextWeek() {
        let curShift = +searchParams.get("weekShift") || 0;
        setSearchParams(prevSearchParams => {
            prevSearchParams.set("weekShift", `${++curShift}`);
            return prevSearchParams;
        })
    }

    const {currentUser} = useAuth();

    const headerBtns = [

        {
            textColor: "black dark:text-white",
            bgColor: "blue-200 dark:bg-blue-800",
            icon: "fa-solid fa-xmark",
            onClick: currentUser ? async () => {
                await clearUsersTasks(currentUser.uid);
            } : () => {},
            tooltip: "Delete all tasks",
        },
        {
            textColor: "black",
            bgColor: "purple-200",
            icon: "fa-solid fa-ellipsis-vertical",
            tooltip: "Extras",
            onClick: openExtrasMenu,
        },
        {
            textColor: "white",
            bgColor: "black dark:bg-stone-800",
            icon: "fa-solid fa-chevron-left",
            onClick: toPrevWeek,
        },
        {
            textColor: "white",
            bgColor: "black dark:bg-stone-800",
            icon: "fa-solid fa-chevron-right",
            onClick: toNextWeek,
        },
    ]

    const [isSmall, setIsSmall] = React.useState(window.innerWidth < 1024);

    const handleResize = () => {
        setIsSmall(window.innerWidth < 1024);

    }

    React.useEffect(() => {
        window.addEventListener("resize", handleResize)
        return () => {
            window.removeEventListener("resize", handleResize)
        }
    }, [])
    console.log(newDate);
    let monthName = months[newDate.getMonth()];
    if (isSmall) monthName = monthName.slice(0, 4) + '.';
    return (
        <header
            className="max-container flex justify-between max-lg:border-b max-lg:border-gray-200
            items-center w-full gap-12 padding-x py-3 lg:py-6 bg-white max-lg:fixed top-0 left-0
            dark:bg-black dark:text-white">
            <h1 className={"text-xl font-[700] lg:text-4xl tracking-tighter " + (+searchParams.get("weekShift") && 'text-blue-600')}>{monthName} {newDate.getFullYear()}</h1>

            <div className="flex gap-3">

                {currentUser ?
                    <button className="h-8 w-8 lg:w-10 lg:h-10 lg:text-lg flex-1 hover:shadow-lg relative group
                    dark:border dark:border-gray-200 dark:bg-black dark:bg-stone-800
                    bg-blue-200 rounded-full mx-auto flex justify-center items-center" onClick={openProfileMenu}>
                        <h2>{" ".concat(...currentUser?.name.split(" ").slice(0, 2).map(w => w[0].toUpperCase()))}</h2>
                        <p className="absolute left-1/2 -translate-x-[50%] top-[120%]
        opacity-0 group-hover:opacity-100 transition ease-linear duration-200
         text-white bg-gray-800 rounded text-xs p-1">Profile</p>
                    </button>
                    : <HeaderBtn {...{
                        textColor: "black dark:text-white",
                        bgColor: "blue-200 dark:bg-black",
                        icon: "fa-regular fa-user",
                        onClick: openLoginForm,
                        tooltip: "Login",
                    }}/>}
                {
                    headerBtns.map((btn, index) => (
                        <HeaderBtn {...btn} key={index}/>
                    ))
                }
            </div>
            <ProfileMenu />
            <ExtrasMenu />
        </header>
    )
}

export default Header