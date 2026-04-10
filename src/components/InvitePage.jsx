import {formTransition, openForm} from "../scripts/utils.js";
import {useEffect} from "react";
import {useAuth} from "../contexts/AuthContext.jsx";


export default function InvitePage() {

    function openLoginForm() {
        closeInvitePage();
        openForm("login-form");
    }

    function closeInvitePage() {
        const invitePage = document.querySelector(".invite");
        invitePage.classList.remove("active");
    }

    useEffect(() => {
        if (localStorage.getItem("isLoggedIn") !== "true") {
            setTimeout(() => {
                const invitePage = document.querySelector(".invite");
                invitePage.classList.add("active");
            }, 500);
        }
    }, []);

    const {currentUser} = useAuth();

    return (
        <div className="invite fixed w-full h-full">

            <div className="invite-blur bg-white bg-opacity-70 dark:bg-opacity-0 fixed top-0 left-0 h-full w-full z-15"
                 onClick={closeInvitePage}></div>
            <div className="invite-page fixed h-screen bg-[#dce1fd] w-[98%] mx-auto lg:w-[35rem] px-10 py-10 lg:top-0 top-2
             lg:right-0 right-[1%] transition-all z-25">
                <h1 className="text-3xl lg:text-5xl font-bold tracking-[-0.15rem] leading-[3.5rem]">
                    Tweek Calendar is a Minimal Weekly Planner & To-Do List App.</h1>
                <div className="w-full border-b-2 border-black py-4 my-6 relative">
                    <p className="text-[0.9rem]">Plan for yourself, your family <br/>
                        and team.</p>
                    <div className="w-20 h-25 absolute right-0 bottom-1/2">

                        <svg viewBox="0 0 88 108">
                            <path fillRule="evenodd"
                                  d="M68.517 0c10.37 0 18.854 8.485 18.854 18.855v43.34c0 9.16-6.62 16.848-15.31 18.518v21.981a4.257 4.257 0 01-4.215 4.755H54.514c-2.335 0-4.246-1.91-4.246-4.245s1.911-4.246 4.246-4.246h8.897V81.049H39.932l.002 21.645a4.257 4.257 0 01-4.216 4.755H22.386c-2.335 0-4.246-1.91-4.246-4.245s1.911-4.246 4.246-4.246h8.897V81.035c-10.032-.39-18.118-8.717-18.118-18.84V23.338L.326 3.169C-.521 1.84.378.112 1.914.005L2.065 0h66.452zM43.63 12.707c-1.237 0-2.25.961-2.332 2.177l-.005.16-.006.195a3.546 3.546 0 01-7.083 0l-.005-.195-.006-.16a2.336 2.336 0 00-4.668.16 8.222 8.222 0 0016.442.001 2.337 2.337 0 00-2.337-2.338z"></path>
                        </svg>
                    </div>
                </div>
                <p className="md:text-[1.4rem] font-[600] leading-8 tracking-tight py-4">To enhance your productivity,
                    Tweek is built around a week calendar view without any hourly scheduling.
                    We’d say it’s the best view to organize your life and work without stress.
                </p>

                <div className="flex gap-6 justify-center my-2">
                    <button
                        className="py-2 px-8 border border-black bg-black text-gray-100 rounded-full font-bold"
                        onClick={closeInvitePage}

                    >Start now
                    </button>
                    {!currentUser &&
                        <button
                            className="py-2 px-8 border border-black text-gray-700 rounded-full font-bold"
                            onClick={openLoginForm}
                        >Log in
                        </button>
                    }

                </div>
                <footer className="absolute bottom-4 text-gray-400">© 2023 Tweek Copy by TecHeReTiC</footer>

            </div>
        </div>

    )
}