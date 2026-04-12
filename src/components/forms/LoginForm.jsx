import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Blur from "../Blur.jsx";
import { formTransition } from "../../scripts/utils.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getAppLanguage, t } from "../../scripts/i18n.js";

export default function LoginForm() {
    const { login, currentUser } = useAuth();
    const language = getAppLanguage(currentUser?.language);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const errorMessageFromUrl = searchParams.get("errorMessage");

    const [errorMessage, setErrorMessage] = React.useState(errorMessageFromUrl || "");
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    async function handleSubmit(ev) {
        ev.preventDefault();

        const formData = new FormData(ev.currentTarget);
        const email = formData.get("email");
        const password = formData.get("password");

        console.log("[LOGIN FORM] submit start", { email });

        try {
            setIsSubmitting(true);
            setErrorMessage("");

            const res = await login(email, password);

            console.log("[LOGIN FORM] submit result", res);

            if (res?.type === "error") {
                setErrorMessage(res.errorMessage || t(language, "login"));
                return;
            }

            window.location.href = "/";
        } catch (err) {
            console.error("[LOGIN FORM] submit error", err);
            setErrorMessage(err.message || t(language, "login"));
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Blur type="login-form">
            <div
                className="login-form relative top-4 task-menu w-[28rem] z-20 bg-stone-50 dark:bg-gray-800 rounded-xl p-6 shadow-lg"
                onClick={ev => ev.stopPropagation()}
            >
                <div className="w-full flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{t(language, "welcomeBack")}</h3>
                    <button
                        type="button"
                        className="btn btn-secondary text-sm"
                        onClick={() => formTransition("login-form", "signup-form")}
                    >
                        {t(language, "signUp")}
                    </button>
                </div>

                {errorMessage && (
                    <div className="rounded-lg px-4 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 py-4 mb-4 border border-red-300 dark:border-red-700">
                        {errorMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="relative space-y-4">
                    <input type="text" defaultValue="login-form" name="form-id" id="form-id" className="hidden" />

                    <div className="form-group">
                        <input
                            type="email"
                            id="email"
                            name="email"
                            required
                            placeholder={t(language, "emailAddress")}
                            className="input-base"
                        />
                    </div>

                    <div className="form-group">
                        <input
                            type="password"
                            id="password"
                            name="password"
                            required
                            placeholder={t(language, "password")}
                            className="input-base"
                        />
                    </div>

                    <button
                        type="button"
                        className="text-blue-600 dark:text-blue-400 w-full text-right text-sm hover:underline"
                        onClick={() => formTransition("login-form", "reset-password-form")}
                    >
                        {t(language, "forgotPassword")}
                    </button>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn btn-primary w-full mt-4"
                    >
                        {isSubmitting ? t(language, "loggingIn") : t(language, "letMeIn")}
                    </button>
                </form>
            </div>
        </Blur>
    );
}
