import { redirect } from "react-router-dom";

export const resetPasswordAction = AuthContext => async ({ request }) => {
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

    return { type: "success" };
};
