import { Form, redirect, useSearchParams } from "react-router-dom";
import Blur from "../Blur.jsx";
import { formTransition } from "../../scripts/utils.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getAppLanguage, t } from "../../scripts/i18n.js";

export const action = (AuthContext) => async ({ request }) => {
    const formData = await request.formData();

    const { signup } = AuthContext;
    const name = formData.get("name");
    const email = formData.get("email");
    const passwordConfirm = formData.get("confirmPassword");
    const password = formData.get("password");

    const language = formData.get("language") || "ptBR";

    if (password && password.length < 6) {
        return redirect(`/?errorMessage=${encodeURIComponent(t(language, "passwordMinError"))}`);
    }

    if (passwordConfirm !== password) {
        return redirect(`/?errorMessage=${encodeURIComponent(t(language, "passwordsDontMatch"))}`);
    }

    const result = await signup({ email, password, name });

    if (result?.type === "error") {
        return redirect(`/?errorMessage=${encodeURIComponent(result.errorMessage)}`);
    }

    window.location.href = "/";
    return null;
};

export default function SignUpForm() {
    const { currentUser } = useAuth();
    const language = getAppLanguage(currentUser?.language);
    const [searchParams] = useSearchParams();
    const errorMessage = searchParams.get("errorMessage");

    return (
        <Blur type="signup-form">
            <div
                className="signup-form relative top-4 w-[28rem] max-w-screen-sm z-20 bg-stone-50 dark:bg-gray-800 rounded-xl p-6 shadow-lg text-gray-700 dark:text-gray-300"
                onClick={ev => ev.stopPropagation()}
            >
                <div className="w-full flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{t(language, "welcome")}</h3>
                    <button
                        type="button"
                        className="btn btn-secondary text-sm"
                        onClick={() => formTransition("signup-form", "login-form")}
                    >
                        {t(language, "logIn")}
                    </button>
                </div>

                {errorMessage && (
                    <div className="rounded-lg px-4 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 py-4 mb-4 border border-red-300 dark:border-red-700">
                        {errorMessage}
                    </div>
                )}

                <Form method="POST" className="relative space-y-4" action="/signup">
                    <input type="text" defaultValue="signup-form" name="form-id" id="form-id" className="hidden" />
                    <input type="hidden" name="language" value={language} />

                    <div className="form-group">
                        <input
                            type="text"
                            id="name"
                            name="name"
                            required
                            placeholder={t(language, "fullName")}
                            className="input-base"
                        />
                    </div>

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
                            placeholder={t(language, "passwordMin")}
                            className="input-base"
                        />
                    </div>

                    <div className="form-group">
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            required
                            placeholder={t(language, "confirmPassword")}
                            className="input-base"
                        />
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t(language, "termsText")}
                    </p>

                    <button
                        type="submit"
                        className="btn btn-primary w-full mt-4"
                    >
                        {t(language, "createAccount")}
                    </button>
                </Form>
            </div>
        </Blur>
    );
}
