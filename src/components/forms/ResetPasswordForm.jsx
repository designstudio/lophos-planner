import React from "react";
import { Form, redirect, useActionData, useNavigation } from "react-router-dom";
import Blur from "../Blur.jsx";
import { formTransition } from "../../scripts/utils.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getAppLanguage, t } from "../../scripts/i18n.js";

export const action = (AuthContext) => async ({ request }) => {
    const { resetPassword, completePasswordRecovery } = AuthContext;

    const formData = await request.formData();
    const mode = formData.get("mode") || "request";

    if (mode === "recovery") {
        const password = formData.get("password") || "";
        const passwordConfirm = formData.get("confirmPassword") || "";

        if (password.length < 6) {
            return "Password must be at least 6 characters";
        }

        if (passwordConfirm !== password) {
            return "Passwords don't match";
        }

        const result = await completePasswordRecovery(password);
        if (result?.type === "error") {
            return result.errorMessage || "Unable to update password right now.";
        }

        return redirect("/");
    }

    const email = formData.get("email");
    const result = await resetPassword(email);
    if (result?.type === "error") {
        return result.errorMessage || "Unable to send reset email right now.";
    }

    return redirect("/");
};

export default function ResetPasswordForm() {
    const errorMessage = useActionData();
    const navigation = useNavigation();
    const { currentUser, isPasswordRecovery } = useAuth();
    const language = getAppLanguage(currentUser?.language);
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [confirmPassword, setConfirmPassword] = React.useState("");

    const isSubmitting = navigation.state === "submitting";
    const isRecoveryMode = isPasswordRecovery;
    const canSubmit = isRecoveryMode
        ? password.trim() && confirmPassword.trim()
        : email.trim();

    return (
        <Blur type="reset-password-form">
            <div
                className="reset-password-form relative top-4 z-20 mx-auto w-full max-w-[512px] rounded-[24px] bg-[rgb(250,250,252)] p-6 text-black shadow-lg outline-none"
                onClick={ev => ev.stopPropagation()}
            >
                <div className="w-full flex justify-between items-center mb-6">
                    <h3 className="text-[21px] font-bold leading-[1.333333] tracking-[-0.5px] text-black">
                        {isRecoveryMode ? t(language, "resetPasswordRecoveryTitle") : t(language, "resetPasswordTitle")}
                    </h3>

                    {!isRecoveryMode ? (
                        <button
                            type="button"
                            className="inline-flex h-10 items-center justify-center rounded-full bg-[rgba(17,24,39,0.06)] px-5 text-sm font-bold leading-none text-black transition-opacity duration-150 hover:opacity-80"
                            onClick={() => formTransition("reset-password-form", "login-form")}
                        >
                            {t(language, "login")}
                        </button>
                    ) : null}
                </div>

                <p className="mb-6 text-[15px] leading-6 text-[#0000008d]">
                    {isRecoveryMode ? t(language, "resetRecoveryDescription") : t(language, "resetDescription")}
                </p>

                {errorMessage && typeof errorMessage === "string" && (
                    <div className="mb-4 rounded-[18px] border border-red-300 bg-red-100 px-4 py-4 text-sm text-red-700">
                        {errorMessage}
                    </div>
                )}

                <Form method="POST" className="relative space-y-4" action="/reset-password">
                    <input type="text" defaultValue="reset-password-form" name="form-id" id="form-id" className="hidden" />
                    <input type="hidden" name="mode" value={isRecoveryMode ? "recovery" : "request"} />

                    {isRecoveryMode ? (
                        <>
                            <div className="form-group">
                                <input
                                    type="password"
                                    id="password"
                                    name="password"
                                    required
                                    value={password}
                                    onChange={ev => setPassword(ev.target.value)}
                                    placeholder={t(language, "newPassword")}
                                    className="input-base border-b border-[rgba(0,0,0,0.15)] pb-3 pt-2 text-[16px] text-black placeholder:text-[#0000008d] focus:border-black"
                                />
                            </div>

                            <div className="form-group">
                                <input
                                    type="password"
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    required
                                    value={confirmPassword}
                                    onChange={ev => setConfirmPassword(ev.target.value)}
                                    placeholder={t(language, "confirmPassword")}
                                    className="input-base border-b border-[rgba(0,0,0,0.15)] pb-3 pt-2 text-[16px] text-black placeholder:text-[#0000008d] focus:border-black"
                                />
                            </div>
                        </>
                    ) : (
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
                    )}

                    <button
                        type="submit"
                        disabled={!canSubmit || isSubmitting}
                        className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-black px-6 text-base font-bold text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-default disabled:opacity-20"
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
