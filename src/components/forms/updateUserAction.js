import { redirect } from "react-router-dom";

export const updateUserAction = AuthContext => async ({ request }) => {
    const formData = await request.formData();
    const { updateUser } = AuthContext;

    const name = formData.get("name");
    const email = formData.get("email");
    const avatar = formData.get("avatar");
    const password = formData.get("password");
    const passwordConfirm = formData.get("confirmPassword");
    const darkMode = formData.get("dark-mode") === "on";
    const language = formData.get("language") || "ptBR";
    const dateFormat = formData.get("date-format") || "DD-MM";
    const weekStartsOn = formData.get("week-starts-on") || "Monday";
    const defaultAgendaId = formData.get("default-agenda-id") || null;
    const defaultView = formData.get("default-view") || "week";

    if (password && password.length < 6) {
        return "Password must be at least 6 characters";
    }

    if (passwordConfirm !== password) {
        return "Passwords don't match";
    }

    await updateUser(email, password, { name, avatar, darkMode, language, dateFormat, weekStartsOn, defaultAgendaId, defaultView });
    return redirect("/");
};
