import { Link } from "react-router-dom";
import { getAppLanguage, t } from "../scripts/i18n.js";

export default function NotFound() {
    const language = getAppLanguage();

    return (
        <main className="min-h-screen bg-[rgb(250,250,252)] px-6 py-10 text-black dark:bg-black dark:text-white">
            <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl flex-col justify-center rounded-[32px] bg-white px-6 py-8 shadow-[0_24px_80px_rgba(17,24,39,0.08)] dark:bg-[#111111] sm:px-10 sm:py-10">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">404</p>
                <h1 className="mt-4 max-w-[14ch] text-[32px] font-bold leading-[1.05] tracking-[-0.06em] sm:text-[48px]">
                    {t(language, "notFoundTitle")}
                </h1>
                <p className="mt-4 max-w-2xl text-[16px] leading-7 text-black/65 dark:text-white/65">
                    {t(language, "notFoundDescription")}
                </p>
                <div className="mt-8">
                    <Link
                        to="/"
                        className="inline-flex h-12 items-center justify-center rounded-full bg-black px-6 text-sm font-bold text-white transition-opacity duration-150 hover:opacity-90 dark:bg-white dark:text-black"
                    >
                        {t(language, "goHome")}
                    </Link>
                </div>
            </div>
        </main>
    );
}
