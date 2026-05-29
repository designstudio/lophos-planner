import React from "react";
import { Form, useActionData, useNavigation } from "react-router-dom";
import Blur from "../Blur.jsx";
import { formTransition } from "../../scripts/utils.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getAppLanguage, t } from "../../scripts/i18n.js";

export default function ResetPasswordForm() {
    const actionData = useActionData();
    const navigation = useNavigation();
    const { currentUser, isPasswordRecovery } = useAuth();
    const language = getAppLanguage(currentUser?.language);
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [confirmPassword, setConfirmPassword] = React.useState("");
    const [cooldownRemaining, setCooldownRemaining] = React.useState(0);

    const isSubmitting = navigation.state === "submitting";
    const isRecoveryMode = isPasswordRecovery;
    const actionIsError = typeof actionData === "object" && actionData?.type === "error";
    const actionIsSuccess = typeof actionData === "object" && actionData?.type === "success";
    const successMessage = actionIsSuccess ? t(language, "resetEmailSent") : "";
    const errorMessage = typeof actionData === "string"
        ? actionData
        : actionIsError
            ? actionData.errorMessage
            : "";
    const cooldownSeconds = actionIsError ? Number(actionData?.cooldownSeconds || 0) : 0;

    React.useEffect(() => {
        if (!cooldownSeconds || isRecoveryMode) return undefined;

        setCooldownRemaining(cooldownSeconds);
        const timerId = window.setInterval(() => {
            setCooldownRemaining(prev => (prev > 1 ? prev - 1 : 0));
        }, 1000);

        return () => window.clearInterval(timerId);
    }, [cooldownSeconds, isRecoveryMode]);

    React.useEffect(() => {
        if (actionIsSuccess) {
            setCooldownRemaining(0);
        }
    }, [actionIsSuccess]);

    const canSubmit = isRecoveryMode
        ? password.trim() && confirmPassword.trim()
        : email.trim() && cooldownRemaining === 0;

    return (
        <Blur type="reset-password-form">
            <div
                className="reset-password-form ds-modal-shell relative top-4 z-20 mx-auto w-full max-w-[512px] p-6 outline-none"
                onClick={ev => ev.stopPropagation()}
            >
                <div className="w-full flex justify-between items-center mb-6">
                    <h3 className="ds-type-h4 text-ds-text-default">
                        {isRecoveryMode ? t(language, "resetPasswordRecoveryTitle") : t(language, "resetPasswordTitle")}
                    </h3>

                    {!isRecoveryMode ? (
                        <button
                            type="button"
                            className="ds-type-button inline-flex h-10 items-center justify-center rounded-full bg-ds-background-surface-muted px-5 text-ds-text-default transition-opacity duration-150 hover:opacity-80"
                            onClick={() => formTransition("reset-password-form", "login-form")}
                        >
                            {t(language, "login")}
                        </button>
                    ) : null}
                </div>

                <p className="ds-type-body mb-6 text-ds-text-subtle">
                    {isRecoveryMode ? t(language, "resetRecoveryDescription") : t(language, "resetDescription")}
                </p>

                {successMessage && (
                    <div className="ds-alert ds-alert-success mb-4">
                        {successMessage}
                    </div>
                )}

                {errorMessage && (
                    <div className="ds-alert ds-alert-danger mb-4">
                        {errorMessage}
                    </div>
                )}

                {!isRecoveryMode && cooldownRemaining > 0 && (
                    <div className="ds-alert ds-alert-warning mb-4">
                        {language === "enUS"
                            ? `Please wait ${cooldownRemaining} seconds before trying again.`
                            : `Aguarde ${cooldownRemaining} segundos antes de tentar novamente.`}
                    </div>
                )}

                <Form method="POST" className="relative space-y-4" action="/reset-password">
                    <input type="text" defaultValue="reset-password-form" name="form-id" id="form-id" className="hidden" />
                    <input type="hidden" name="mode" value={isRecoveryMode ? "recovery" : "request"} />

                    {isRecoveryMode ? (
                        <>
                            <div className="form-group">
                                <label htmlFor="password" className="sr-only">{t(language, "newPassword")}</label>
                                <input
                                    type="password"
                                    id="password"
                                    name="password"
                                    required
                                    value={password}
                                    onChange={ev => setPassword(ev.target.value)}
                                    placeholder={t(language, "newPassword")}
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
                        </>
                    ) : (
                        <div className="form-group">
                            <label htmlFor="email" className="sr-only">{t(language, "emailField")}</label>
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
                    )}

                    <button
                        type="submit"
                        disabled={!canSubmit || isSubmitting}
                        className="ds-button-primary ds-type-body mt-5 inline-flex h-12 w-full items-center justify-center px-6 font-bold transition-opacity duration-150 hover:opacity-90 disabled:cursor-default disabled:opacity-20"
                    >
                        {isSubmitting
                            ? `${isRecoveryMode ? t(language, "saveNewPassword") : t(language, "sendResetLink")}...`
                            : isRecoveryMode ? t(language, "saveNewPassword") : t(language, "sendResetLink")}
                    </button>
                </Form>
            </div>
        </Blur>
    );
}
