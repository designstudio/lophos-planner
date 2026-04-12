import { Form, redirect, useActionData } from "react-router-dom";
import Blur from "../Blur.jsx";
import { formTransition } from "../../scripts/utils.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getAppLanguage, t } from "../../scripts/i18n.js";

export const action = (AuthContext) => async ({ request }) => {
    const { resetPassword } = AuthContext;

    const formData = await request.formData();
    const email = formData.get("email");
    await resetPassword(email);

    return redirect("/");
};

export default function ResetPasswordForm() {
    const errorMessage = useActionData();
    const { currentUser } = useAuth();
    const language = getAppLanguage(currentUser?.language);

    return (
        <Blur type="reset-password-form">
            <div
                className="task-menu relative top-4 w-[28rem] z-20 bg-stone-50 dark:bg-gray-800 rounded-xl p-6 shadow-lg text-gray-700 dark:text-gray-300"
                onClick={ev => ev.stopPropagation()}
            >
                <div className="w-full flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{t(language, "resetPassword")}</h3>
                    <button
                        type="button"
                        className="btn btn-secondary text-sm"
                        onClick={() => formTransition("reset-password-form", "login-form")}
                    >
                        {t(language, "back")}
                    </button>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {t(language, "resetDescription")}
                </p>

                {errorMessage && typeof errorMessage === "string" && (
                    <div className="rounded-lg px-4 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 py-4 mb-4 border border-red-300 dark:border-red-700">
                        {errorMessage}
                    </div>
                )}

                <Form method="POST" className="relative space-y-4" action="/reset-password">
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

                    <button
                        type="submit"
                        className="btn btn-primary w-full"
                    >
                        {t(language, "sendResetLink")}
                    </button>
                </Form>
            </div>
        </Blur>
    );
}
