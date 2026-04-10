import {useAuth} from "../../contexts/AuthContext.jsx";
import {useEffect} from "react";
import {openForm} from "../../scripts/utils.js";

export default function ProfileMenu() {

    const { currentUser, logout } = useAuth();

    function openUpdateUserForm() {
        openForm("update-user-form");
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
         border border-black rounded-md w-28 lg:w-40 p-4 -translate-x-[50%] text-center"
             onClick={ev => ev.stopPropagation()}>
            <div className="h-8 w-8 border border-gray-800 dark:border-white rounded-full mx-auto flex justify-center items-center">
                {currentUser && <h2>{" ".concat(...currentUser?.name.split(" ").slice(0, 2).map(w => w[0].toUpperCase()))}</h2>}
            </div>

            <h4>{currentUser?.name}</h4>

            <div className="w-full flex justify-between text-xs border-t border-gray-400 mt-2 py-1">
                <button onClick={openUpdateUserForm}><i className="fa-solid fa-user-gear text-xs"></i> Account</button>
                <button onClick={async () => await logout()}>
                    <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i> Log out</button>
            </div>
        </div>
    )
}