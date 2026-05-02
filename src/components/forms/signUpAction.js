import { redirect } from "react-router-dom";
import { t } from "../../scripts/i18n.js";

export const signUpAction = AuthContext => async ({ request }) => {
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
