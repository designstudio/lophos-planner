import React from "react";
import { useSearchParams } from "react-router-dom";
import Blur from "../Blur.jsx";
import { formTransition } from "../../scripts/utils.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getAppLanguage, t } from "../../scripts/i18n.js";

export default function LoginForm() {
    const { login, loginWithGoogle, currentUser } = useAuth();
    const language = getAppLanguage(currentUser?.language);
    const [searchParams] = useSearchParams();
    const errorMessageFromUrl = searchParams.get("errorMessage");

    const [errorMessage, setErrorMessage] = React.useState(errorMessageFromUrl || "");
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isGoogleSubmitting, setIsGoogleSubmitting] = React.useState(false);
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");

    async function handleSubmit(ev) {
        ev.preventDefault();

        const formData = new FormData(ev.currentTarget);
        const email = formData.get("email");
        const password = formData.get("password");

        try {
            setIsSubmitting(true);
            setErrorMessage("");

            const res = await login(email, password);

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

    const canSubmit = email.trim() && password.trim();

    async function handleGoogleLogin() {
        try {
            setIsGoogleSubmitting(true);
            setErrorMessage("");

            const res = await loginWithGoogle();
            if (res?.type === "error") {
                setErrorMessage(res.errorMessage || t(language, "googleLogin"));
            }
        } catch (err) {
            setErrorMessage(err.message || t(language, "googleLogin"));
        } finally {
            setIsGoogleSubmitting(false);
        }
    }

    return (
        <Blur type="login-form">
            <div
                className="login-form ds-modal-shell relative top-4 z-20 mx-auto w-full max-w-[512px] p-6 outline-none"
                onClick={ev => ev.stopPropagation()}
            >
                <div className="w-full flex justify-between items-center mb-6">
                    <h3 className="ds-type-h4 text-ds-text-default">Oi! {t(language, "welcomeBack")}</h3>
                    <button
                        type="button"
                        className="ds-type-button inline-flex h-10 items-center justify-center rounded-full bg-ds-background-surface-muted px-5 text-ds-text-default transition-opacity duration-150 hover:opacity-80"
                        onClick={() => formTransition("login-form", "signup-form")}
                    >
                        {t(language, "signUp")}
                    </button>
                </div>

                {errorMessage && (
                    <div className="ds-alert ds-alert-danger mb-4">
                        {errorMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="relative space-y-4">
                    <input type="text" defaultValue="login-form" name="form-id" id="form-id" className="hidden" />

                    <div className="form-group">
                        <label htmlFor="email" className="sr-only">
                            {t(language, "emailField")}
                        </label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            required
                            value={email}
                            onChange={ev => setEmail(ev.target.value)}
                            placeholder={t(language, "emailField")}
                            className="input-base pb-3 pt-2"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password" className="sr-only">
                            {t(language, "password")}
                        </label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            required
                            value={password}
                            onChange={ev => setPassword(ev.target.value)}
                            placeholder={t(language, "password")}
                            className="input-base pb-3 pt-2"
                        />
                    </div>

                    <button
                        type="button"
                        className="ds-type-body w-full text-right text-ds-text-subtle hover:underline"
                        onClick={() => formTransition("login-form", "reset-password-form")}
                    >
                        {t(language, "forgotPassword")}
                    </button>

                    <button
                        type="submit"
                        disabled={!canSubmit || isSubmitting || isGoogleSubmitting}
                        className="ds-button-primary ds-type-body mt-5 inline-flex h-12 w-full items-center justify-center px-6 font-bold transition-opacity duration-150 hover:opacity-90 disabled:cursor-default disabled:opacity-20"
                    >
                        {isSubmitting ? t(language, "loggingIn") : t(language, "login")}
                    </button>

                    <div className="mt-4 grid grid-cols-1 gap-3">
                        <button
                            type="button"
                            disabled={isSubmitting || isGoogleSubmitting}
                            onClick={handleGoogleLogin}
                            className="ds-type-button inline-flex h-12 w-full items-center justify-center gap-3 rounded-full border border-ds-border-strong bg-ds-background-surface px-4 text-ds-text-default transition-colors duration-150 hover:bg-ds-background-surface-muted disabled:cursor-default disabled:opacity-20"
                        >
                            <span className="ds-type-body-lg inline-flex h-[18px] w-[18px] items-center justify-center font-bold leading-none">G</span>
                            <span>{isGoogleSubmitting ? t(language, "googleLoginLoading") : t(language, "googleLogin")}</span>
                        </button>
                    </div>
                </form>
            </div>
        </Blur>
    );
}
