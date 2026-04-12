import React from "react";
import { useSearchParams } from "react-router-dom";
import Blur from "../Blur.jsx";
import { formTransition } from "../../scripts/utils.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getAppLanguage, t } from "../../scripts/i18n.js";

function AppleLogo(props) {
    return (
        <svg
            role="img"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            {...props}
        >
            <path d="M12.152 6.896c-0.948 0 -2.415 -1.078 -3.96 -1.04 -2.04 0.027 -3.91 1.183 -4.961 3.014 -2.117 3.675 -0.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52 -0.065 2.09 -0.987 3.935 -0.987 1.831 0 2.35 0.987 3.96 0.948 1.637 -0.026 2.676 -1.48 3.676 -2.948 1.156 -1.688 1.636 -3.325 1.662 -3.415 -0.039 -0.013 -3.182 -1.221 -3.22 -4.857 -0.026 -3.04 2.48 -4.494 2.597 -4.559 -1.429 -2.09 -3.623 -2.324 -4.39 -2.376 -2 -0.156 -3.675 1.09 -4.61 1.09zM15.53 3.83c0.843 -1.012 1.4 -2.427 1.245 -3.83 -1.207 0.052 -2.662 0.805 -3.532 1.818 -0.78 0.896 -1.454 2.338 -1.273 3.714 1.338 0.104 2.715 -0.688 3.559 -1.701" fill="currentColor"></path>
        </svg>
    );
}

export default function LoginForm() {
    const { login, loginWithGoogle, loginWithApple, currentUser } = useAuth();
    const language = getAppLanguage(currentUser?.language);
    const [searchParams] = useSearchParams();
    const errorMessageFromUrl = searchParams.get("errorMessage");

    const [errorMessage, setErrorMessage] = React.useState(errorMessageFromUrl || "");
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isGoogleSubmitting, setIsGoogleSubmitting] = React.useState(false);
    const [isAppleSubmitting, setIsAppleSubmitting] = React.useState(false);
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");

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

    async function handleAppleLogin() {
        try {
            setIsAppleSubmitting(true);
            setErrorMessage("");

            const res = await loginWithApple();
            if (res?.type === "error") {
                setErrorMessage(res.errorMessage || t(language, "appleLogin"));
            }
        } catch (err) {
            setErrorMessage(err.message || t(language, "appleLogin"));
        } finally {
            setIsAppleSubmitting(false);
        }
    }

    return (
        <Blur type="login-form">
            <div
                className="login-form relative top-4 z-20 mx-auto w-full max-w-[512px] rounded-[24px] bg-[#f8e8e2] p-6 text-black shadow-lg outline-none"
                onClick={ev => ev.stopPropagation()}
            >
                <div className="w-full flex justify-between items-center mb-6">
                    <h3 className="text-[21px] font-bold leading-[1.333333] tracking-[-0.5px] text-black">Oi! {t(language, "welcomeBack")}</h3>
                    <button
                        type="button"
                        className="inline-flex h-10 items-center justify-center rounded-full bg-[rgba(17,24,39,0.06)] px-5 text-sm font-bold leading-none text-black transition-opacity duration-150 hover:opacity-80"
                        onClick={() => formTransition("login-form", "signup-form")}
                    >
                        {t(language, "signUp")}
                    </button>
                </div>

                {errorMessage && (
                    <div className="mb-4 rounded-[18px] border border-red-300 bg-red-100 px-4 py-4 text-sm text-red-700">
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
                            value={email}
                            onChange={ev => setEmail(ev.target.value)}
                            placeholder={t(language, "emailField")}
                            className="input-base border-b border-[rgba(0,0,0,0.15)] pb-3 pt-2 text-[16px] text-black placeholder:text-[#0000008d] focus:border-black"
                        />
                    </div>

                    <div className="form-group">
                        <input
                            type="password"
                            id="password"
                            name="password"
                            required
                            value={password}
                            onChange={ev => setPassword(ev.target.value)}
                            placeholder={t(language, "password")}
                            className="input-base border-b border-[rgba(0,0,0,0.15)] pb-3 pt-2 text-[16px] text-black placeholder:text-[#0000008d] focus:border-black"
                        />
                    </div>

                    <button
                        type="button"
                        className="w-full text-right text-[16px] font-normal text-[#0000004d] hover:underline"
                        onClick={() => formTransition("login-form", "reset-password-form")}
                    >
                        {t(language, "forgotPassword")}
                    </button>

                    <button
                        type="submit"
                        disabled={!canSubmit || isSubmitting || isGoogleSubmitting || isAppleSubmitting}
                        className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-black px-6 text-base font-bold text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-default disabled:opacity-60"
                    >
                        {isSubmitting ? t(language, "loggingIn") : t(language, "login")}
                    </button>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <button
                            type="button"
                            disabled={isSubmitting || isGoogleSubmitting || isAppleSubmitting}
                            onClick={handleGoogleLogin}
                            className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-full border border-black bg-white px-4 text-[14px] font-medium text-black transition-colors duration-150 hover:bg-[#fff8f5] disabled:cursor-default disabled:opacity-60"
                        >
                            <span className="inline-flex h-[18px] w-[18px] items-center justify-center text-[18px] font-bold leading-none">G</span>
                            <span>{isGoogleSubmitting ? t(language, "googleLoginLoading") : t(language, "googleLogin")}</span>
                        </button>

                        <button
                            type="button"
                            disabled={isSubmitting || isGoogleSubmitting || isAppleSubmitting}
                            onClick={handleAppleLogin}
                            className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-full border border-black bg-white px-4 text-[14px] font-medium text-black transition-colors duration-150 hover:bg-[#fff8f5] disabled:cursor-default disabled:opacity-60"
                        >
                            <AppleLogo className="h-[18px] w-[18px] text-black" />
                            <span>{isAppleSubmitting ? t(language, "appleLoginLoading") : t(language, "appleLogin")}</span>
                        </button>
                    </div>
                </form>
            </div>
        </Blur>
    );
}
