import React from "react";
import { Form, useSearchParams } from "react-router-dom";
import Blur from "../Blur.jsx";
import { formTransition } from "../../scripts/utils.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getAppLanguage, t } from "../../scripts/i18n.js";

export default function SignUpForm() {
    const { loginWithGoogle, currentUser, pendingAgendaInviteEmail } = useAuth();
    const language = getAppLanguage(currentUser?.language);
    const [searchParams] = useSearchParams();
    const errorMessage = searchParams.get("errorMessage");
    const [socialErrorMessage, setSocialErrorMessage] = React.useState("");
    const [isGoogleSubmitting, setIsGoogleSubmitting] = React.useState(false);
    const [name, setName] = React.useState("");
    const [email, setEmail] = React.useState(() => pendingAgendaInviteEmail || "");
    const [password, setPassword] = React.useState("");
    const [confirmPassword, setConfirmPassword] = React.useState("");

    React.useEffect(() => {
        if (pendingAgendaInviteEmail && !email) {
            setEmail(pendingAgendaInviteEmail);
        }
    }, [pendingAgendaInviteEmail, email]);

    const canSubmit = (
        name.trim() &&
        email.trim() &&
        password.trim() &&
        confirmPassword.trim()
    );

    async function handleGoogleLogin() {
        try {
            setIsGoogleSubmitting(true);
            setSocialErrorMessage("");
            const res = await loginWithGoogle();
            if (res?.type === "error") {
                setSocialErrorMessage(res.errorMessage || t(language, "googleLogin"));
            }
        } catch (err) {
            setSocialErrorMessage(err.message || t(language, "googleLogin"));
        } finally {
            setIsGoogleSubmitting(false);
        }
    }

    return (
        <Blur type="signup-form">
            <div
                className="signup-form ds-modal-shell relative top-4 z-20 mx-auto w-full max-w-[512px] p-6 outline-none"
                onClick={ev => ev.stopPropagation()}
            >
                <div className="w-full flex justify-between items-center mb-6">
                    <h3 className="ds-type-h4 text-ds-text-default">{t(language, "welcome")}</h3>
                    <button
                        type="button"
                        className="ds-type-button inline-flex h-10 items-center justify-center rounded-full bg-ds-background-surface-muted px-5 text-ds-text-default transition-opacity duration-150 hover:opacity-80"
                        onClick={() => formTransition("signup-form", "login-form")}
                    >
                        {t(language, "login")}
                    </button>
                </div>

                {(socialErrorMessage || errorMessage) && (
                    <div className="ds-alert ds-alert-danger mb-4">
                        {socialErrorMessage || errorMessage}
                    </div>
                )}

                <Form method="POST" className="relative" action="/signup">
                    <input type="text" defaultValue="signup-form" name="form-id" id="form-id" className="hidden" />
                    <input type="hidden" name="language" value={language} />

                    <div className="space-y-4">
                        <div className="form-group">
                            <label htmlFor="name" className="sr-only">{t(language, "fullName")}</label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                required
                                value={name}
                                onChange={ev => setName(ev.target.value)}
                                placeholder={t(language, "fullName")}
                                className="input-base pb-3 pt-2"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email" className="sr-only">{t(language, "emailAddress")}</label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                required
                                value={email}
                                onChange={ev => setEmail(ev.target.value)}
                                placeholder={t(language, "emailAddress")}
                                className="input-base pb-3 pt-2"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password" className="sr-only">{t(language, "passwordMin")}</label>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                required
                                value={password}
                                onChange={ev => setPassword(ev.target.value)}
                                placeholder={t(language, "passwordMin")}
                                className="input-base pb-3 pt-2"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirmPassword" className="sr-only">{t(language, "confirmPassword")}</label>
                            <input
                                type="password"
                                id="confirmPassword"
                                name="confirmPassword"
                                required
                                value={confirmPassword}
                                onChange={ev => setConfirmPassword(ev.target.value)}
                                placeholder={t(language, "confirmPassword")}
                                className="input-base pb-3 pt-2"
                            />
                        </div>
                    </div>

                    <p className="ds-type-caption mt-6 text-ds-text-subtle">
                        <span className="block">{t(language, "termsTextLine1")}</span>
                        <span className="block">{t(language, "termsTextLine2")}</span>
                    </p>

                    <button
                        type="submit"
                        disabled={!canSubmit || isGoogleSubmitting}
                        className="ds-button-primary ds-type-body mt-6 inline-flex h-12 w-full items-center justify-center px-6 font-bold transition-opacity duration-150 hover:opacity-90 disabled:cursor-default disabled:opacity-20"
                    >
                        {t(language, "createAccount")}
                    </button>

                    <div className="mt-4 grid grid-cols-1 gap-3">
                        <button
                            type="button"
                            disabled={isGoogleSubmitting}
                            onClick={handleGoogleLogin}
                            className="ds-type-button inline-flex h-12 w-full items-center justify-center gap-3 rounded-full border border-ds-border-strong bg-ds-background-surface px-4 text-ds-text-default transition-colors duration-150 hover:bg-ds-background-surface-muted disabled:cursor-default disabled:opacity-20"
                        >
                            <span className="ds-type-body-lg inline-flex h-[18px] w-[18px] items-center justify-center font-bold leading-none">G</span>
                            <span>{isGoogleSubmitting ? t(language, "googleLoginLoading") : t(language, "googleLogin")}</span>
                        </button>
                    </div>
                </Form>
            </div>
        </Blur>
    );
}
