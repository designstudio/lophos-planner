import { openForm } from "../scripts/utils.js";
import {useAuth} from "../contexts/AuthContext.jsx";
import { getAppLanguage, t } from "../scripts/i18n.js";


export default function InvitePage() {

    function openLoginForm() {
        closeInvitePage();
        openForm("login-form");
    }

    function openSignupForm() {
        closeInvitePage();
        openForm("signup-form");
    }

    function closeInvitePage() {
        const invitePage = document.querySelector(".invite");
        invitePage.classList.remove("active");
    }

    const { currentUser, appLanguage, pendingAgendaInviteToken } = useAuth();
    const language = appLanguage || getAppLanguage(currentUser?.language);

    return (
        <div className="invite fixed inset-0 z-[80] h-full w-full pointer-events-none">

            <div className="invite-blur fixed top-0 left-0 h-full w-full z-[80]"
                 style={{ backgroundColor: "rgba(5, 5, 5, 0.2)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
                 onClick={closeInvitePage}></div>
            <div className="invite-page fixed h-screen bg-[rgb(250,250,252)] w-[98%] mx-auto lg:w-[35rem] px-10 py-10 lg:top-0 top-2
             lg:right-0 right-[1%] transition-all z-[90]">
                <h1 className="text-3xl lg:text-5xl font-bold tracking-[-0.15rem] leading-[3.5rem]">
                    {t(language, "aboutHeadline")}
                </h1>
                <div className="w-full border-b-2 border-black py-4 my-6 relative">
                    <p className="text-[0.9rem]">
                        {t(language, "aboutSubline1")} <br/>
                        {t(language, "aboutSubline2")}
                    </p>
                    <div className="w-20 h-25 absolute right-0 bottom-1/2">
                        <svg className="h-auto w-[7rem]" width="668" height="668" viewBox="0 0 668 668" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <mask id="mask0_1107_61" style={{ maskType: "alpha" }} maskUnits="userSpaceOnUse" x="0" y="0" width="668" height="668">
                                <path d="M0 334C0 217.09 0 158.633 22.7465 113.979C42.7548 74.7007 74.6812 42.766 113.95 22.7524C158.592 0 217.033 0 333.913 0C450.793 0 509.234 0 553.876 22.7524C593.144 42.766 625.071 74.7007 645.08 113.979C667.826 158.633 667.826 217.09 667.826 334C667.826 450.91 667.826 509.367 645.08 554.02C625.071 593.299 593.144 625.234 553.876 645.248C509.234 668 450.793 668 333.913 668C217.033 668 158.592 668 113.95 645.248C74.6812 625.234 42.7548 593.299 22.7465 554.02C0 509.367 0 450.91 0 334Z" fill="#050505"/>
                            </mask>
                            <g mask="url(#mask0_1107_61)">
                                <path d="M472.048 298.093V312.984L470.561 317.38L419.255 316.571C397.215 316.226 364.319 330.061 337.411 326.053C319.25 323.349 302.338 318.619 284.629 314.255C248.736 303.815 217.121 311.658 182.91 323.381C194.695 325.644 205.466 325.213 216.821 323.737C237.567 321.032 257.495 321.614 277.918 326.485L318.711 336.224C348.01 343.218 377.514 342.183 406.49 333.93C423.876 328.973 441.262 327.573 458.713 333.38C450.795 358.151 436.145 371.49 410.572 374.496C395.051 376.317 380.1 376.619 364.286 376.931C328.276 377.653 294.097 383.288 259.907 393.89C244.32 398.728 228.691 400.614 212.5 400.366C173.776 399.773 145.673 379.948 122.567 351.201C120.649 365.09 131.227 376.544 139.576 386.154C160.117 414.201 191.657 419.685 225.567 419.221C206.167 430.427 190.321 444.758 178.613 463.624C157.919 496.971 156.175 518.693 151.371 556.921L145.941 600.106C142.452 627.872 133.479 653.591 121.941 678.438H-140.869V542.677C-92.6115 550.479 -45.6894 530.189 -25.7723 483.374C-18.0271 465.164 -13.2981 446.589 -9.85199 426.925L1.39431 362.838C5.15307 341.429 10.4426 321.409 18.3063 301.228C37.9433 251.6 71.1205 219.988 119.152 197.07C109.942 183.71 101.67 171.114 96.4016 156.127C103.64 155.491 110.772 156.536 117.504 159.197L142.322 169.034C148.989 171.674 155.787 173.129 163.435 173.625L155.712 143.714C153.062 133.446 153.395 122.693 156.154 112.694C163.209 87.0827 191.193 78.8724 214.774 82.3957C235.8 85.5311 255.265 91.4034 274.632 100.228C328.287 125.085 372.882 167.149 398.907 220.881C398.529 162.677 334.846 107.048 284.984 87.2335C302.542 73.7329 329.094 74.4333 348.602 84.249C401.88 112.252 433.15 170.673 423.887 230.741C451.419 244.004 467.912 269.013 472.048 298.093ZM253.509 241.192C245.118 232.185 237.933 225.569 229.347 218.695C220.536 214.083 210.368 213.641 201.309 217.865C196.235 220.796 193.273 225.461 193.186 230.838C193.1 236.214 195.438 240.621 199.574 244.231C208.041 250.372 218.737 251.902 228.745 248.821L253.509 241.192ZM431.804 279.777C433.711 268.732 427.732 261.46 419.901 256.589C413.955 252.538 406.328 252.625 402.02 259.595C405.607 263.366 409.733 267.192 414.278 269.777L431.804 279.766V279.777Z" fill="black"/>
                            </g>
                        </svg>
                    </div>
                </div>
                <p className="md:text-[1.4rem] font-[600] leading-8 tracking-tight py-4">
                    {t(language, "aboutDescription")}
                </p>

                <div className="flex gap-6 justify-center my-2">
                    {pendingAgendaInviteToken && !currentUser ? (
                        <button
                            className="py-2 px-8 border border-black bg-black text-gray-100 rounded-full font-bold"
                            onClick={openSignupForm}
                        >
                            {t(language, "acceptInvite")}
                        </button>
                    ) : (
                        <button
                            className="py-2 px-8 border border-black bg-black text-gray-100 rounded-full font-bold"
                            onClick={closeInvitePage}
                        >
                            {t(language, "startNow")}
                        </button>
                    )}
                    {!currentUser && !pendingAgendaInviteToken &&
                        <button
                            className="py-2 px-8 border border-black text-gray-700 rounded-full font-bold"
                            onClick={openLoginForm}
                        >{t(language, "logIn")}
                        </button>
                    }
                    {pendingAgendaInviteToken && !currentUser &&
                        <button
                            className="py-2 px-8 border border-black text-gray-700 rounded-full font-bold"
                            onClick={openLoginForm}
                        >
                            {t(language, "logIn")}
                        </button>
                    }

                </div>
                <footer className="absolute bottom-4 text-gray-400">{t(language, "aboutCopyright")}</footer>

            </div>
        </div>

    )
}
