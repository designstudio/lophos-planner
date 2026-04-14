import { Form, redirect, useActionData, useNavigation } from "react-router-dom";
import Blur from "../Blur.jsx";
import React from "react";

import { useAuth } from "../../contexts/AuthContext.jsx";
import { Moon02, Camera01, Check, Trash03, ChevronDown } from "@untitledui/icons";
import { getAppLanguage, t } from "../../scripts/i18n.js";
import { closeForm, openForm } from "../../scripts/utils.js";

const MAX_AVATAR_SIZE_BYTES = 100 * 1024;

export const action = (AuthContext) => async ({ request }) => {
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

    if (password && password.length < 6) {
        return "Password must be at least 6 characters";
    }

    if (passwordConfirm !== password) {
        return "Passwords don't match";
    }

    await updateUser(email, password, { name, avatar, darkMode, language, dateFormat, weekStartsOn, defaultAgendaId });
    return redirect("/");
};

export default function UpdateUserForm() {
    const errorMessage = useActionData();
    const navigation = useNavigation();
    const { currentUser, agendas, deleteAccount } = useAuth();
    const language = getAppLanguage(currentUser?.language);

    const initialFormValues = React.useMemo(() => ({
        name: currentUser?.name || "",
        email: currentUser?.email || "",
        avatar: currentUser?.avatar || "",
        password: "",
        confirmPassword: "",
        darkMode: !!currentUser?.darkMode,
        dateFormat: currentUser?.dateFormat || "DD-MM",
        weekStartsOn: currentUser?.weekStartsOn || "Monday",
        language: currentUser?.language || "ptBR",
        defaultAgendaId: currentUser?.defaultAgendaId || currentUser?.currentAgendaId || agendas?.[0]?.id || "",
    }), [
        currentUser?.name,
        currentUser?.email,
        currentUser?.avatar,
        currentUser?.darkMode,
        currentUser?.dateFormat,
        currentUser?.weekStartsOn,
        currentUser?.language,
        currentUser?.defaultAgendaId,
        currentUser?.currentAgendaId,
        agendas,
    ]);

    const [formValues, setFormValues] = React.useState(initialFormValues);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = React.useState(false);
    const [deleteAccountError, setDeleteAccountError] = React.useState("");
    const [avatarErrorMessage, setAvatarErrorMessage] = React.useState("");
    const [avatarLoading, setAvatarLoading] = React.useState(false);
    const deleteModalRef = React.useRef(null);
    const avatarInputRef = React.useRef(null);
    const wasSubmittingRef = React.useRef(false);

    React.useEffect(() => {
        setFormValues(initialFormValues);
    }, [initialFormValues]);

    React.useEffect(() => {
        if (!isDeleteModalOpen || !deleteModalRef.current) return;

        const modalEl = deleteModalRef.current;
        modalEl.style.transition = "none";
        modalEl.style.transform = "translateY(24px)";
        modalEl.style.opacity = "0";

        requestAnimationFrame(() => {
            modalEl.style.transition = "transform 160ms ease, opacity 160ms ease";
            modalEl.style.transform = "translateY(0)";
            modalEl.style.opacity = "1";
        });
    }, [isDeleteModalOpen]);

    React.useEffect(() => {
        function handleKeyDown(ev) {
            if (ev.key !== "Escape") return;
            if (!isDeleteModalOpen || isDeletingAccount) return;

            ev.preventDefault();
            closeDeleteAccountModal();
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isDeleteModalOpen, isDeletingAccount]);

    React.useEffect(() => {
        if (navigation.state === "submitting") {
            wasSubmittingRef.current = true;
            return;
        }

        if (wasSubmittingRef.current && navigation.state === "idle") {
            const hasActionError = typeof errorMessage === "string" && errorMessage.length > 0;
            if (!hasActionError) {
                closeForm("update-user-form");
            }
            wasSubmittingRef.current = false;
        }
    }, [navigation.state, errorMessage]);

    const hasChanges = React.useMemo(() => {
        return (
            formValues.name !== initialFormValues.name ||
            formValues.email !== initialFormValues.email ||
            formValues.avatar !== initialFormValues.avatar ||
            formValues.darkMode !== initialFormValues.darkMode ||
            formValues.dateFormat !== initialFormValues.dateFormat ||
            formValues.weekStartsOn !== initialFormValues.weekStartsOn ||
            formValues.language !== initialFormValues.language ||
            formValues.defaultAgendaId !== initialFormValues.defaultAgendaId ||
            formValues.password.length > 0 ||
            formValues.confirmPassword.length > 0
        );
    }, [formValues, initialFormValues]);

    function updateField(field, value) {
        setFormValues(prev => ({
            ...prev,
            [field]: value,
        }));
    }

    async function handleAvatarChange(ev) {
        const file = ev.target.files?.[0];
        if (!file) return;

        if (file.size > MAX_AVATAR_SIZE_BYTES) {
            setAvatarErrorMessage(t(language, "agendaAvatarMaxSizeError"));
            ev.target.value = "";
            return;
        }

        setAvatarLoading(true);
        try {
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result || "");
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            updateField("avatar", typeof dataUrl === "string" ? dataUrl : "");
            setAvatarErrorMessage("");
        } finally {
            setAvatarLoading(false);
        }
    }

    async function handleDeleteAccount() {
        setIsDeletingAccount(true);
        setDeleteAccountError("");

        const result = await deleteAccount();
        if (result?.type === "error") {
            setDeleteAccountError(result.errorMessage || t(language, "deleteAccountError"));
            setIsDeletingAccount(false);
            return;
        }

        setIsDeletingAccount(false);
    }

    function openDeleteAccountModal() {
        setDeleteAccountError("");
        closeForm("update-user-form");
        setIsDeleteModalOpen(true);
    }

    function closeDeleteAccountModal() {
        if (isDeletingAccount) return;
        setIsDeleteModalOpen(false);
        setDeleteAccountError("");
        requestAnimationFrame(() => openForm("update-user-form"));
    }

    return (
        <>
        {!isDeleteModalOpen && (
        <Blur type="update-user-form">
            <div
                className="update-user-form relative mb-6 w-[32rem] max-w-full z-20 bg-[rgb(250,250,252)] rounded-[28px] px-6 py-7 shadow-lg text-black transition-all duration-500 ease-linear"
                onClick={ev => ev.stopPropagation()}
            >
                <h3 className="text-[21px] font-bold leading-7 tracking-[-0.5px] text-black">{t(language, "settingsTitle")}</h3>

                {errorMessage && typeof errorMessage === "string" && (
                    <h3 className="mt-2 rounded-md px-3 py-2 text-sm bg-red-400 text-black">
                        {errorMessage}
                    </h3>
                )}

                <Form method="POST" className="relative mt-6" action="/update-user">
                    <div className="flex w-full items-center gap-3 rounded-[13px] bg-black px-4 py-4 text-white">
                        <Moon02 className="h-7 w-7 text-white" />
                        <div className="flex-1">
                            <p className="text-sm font-bold text-white">{t(language, "darkMode")}</p>
                            <p className="text-sm leading-4 text-white">{t(language, "darkModeDescription")}</p>
                        </div>

                        <button
                            type="button"
                            className={`h-6 w-11 appearance-none rounded-full relative box-border border-2 shadow-none focus:outline-none transition-colors ${
                                formValues.darkMode
                                    ? "bg-[#edeae3] border-[#edeae3]"
                                    : "bg-black border-[#edeae3]"
                            }`}
                            onClick={() => {
                                const next = !formValues.darkMode;
                                updateField("darkMode", next);
                                localStorage.setItem("theme", next ? "dark" : "light");
                            }}
                        >
                            <div className={`h-4 w-4 absolute left-0.5 top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center transition-all transform ${
                                formValues.darkMode
                                    ? "translate-x-[20px] bg-black"
                                    : "translate-x-0 bg-[#edeae3]"
                            }`}>
                                {formValues.darkMode && <Check className="h-3 w-3 text-[#edeae3]" strokeWidth={3} />}
                            </div>
                        </button>
                    </div>

                    <input type="checkbox" checked={formValues.darkMode} name="dark-mode" id="dark-mode" className="hidden" readOnly />
                    <input type="text" defaultValue="update-user-form" name="form-id" id="form-id" className="hidden" />

                    <h4 className="mb-4 mt-6 text-[16px] font-bold leading-[1.333333] text-black">Editar perfil</h4>

                    <input type="hidden" name="avatar" value={formValues.avatar} />

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
                        <div className="relative flex-shrink-0 self-start">
                                <input
                                    ref={avatarInputRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                                    onChange={handleAvatarChange}
                                    className="hidden"
                                    id="profile-avatar-upload"
                                />
                                <button
                                    type="button"
                                    onClick={() => avatarInputRef.current?.click()}
                                    className="relative block h-14 w-14 overflow-hidden rounded-full"
                                >
                                    {formValues.avatar ? (
                                        <img src={formValues.avatar} alt="Profile avatar" className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-white text-sm font-bold text-black/30">
                                            {(formValues.name || currentUser?.name || "U")[0].toUpperCase()}
                                        </div>
                                    )}
                                </button>
                                <div className="pointer-events-none absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-black">
                                    {avatarLoading ? (
                                        <svg className="h-[10px] w-[10px] animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                    ) : (
                                        <Camera01 className="h-[10px] w-[10px] text-white" />
                                    )}
                                </div>
                            {avatarErrorMessage && (
                                <p className="mt-3 max-w-[12rem] rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">
                                    {avatarErrorMessage}
                                </p>
                            )}
                        </div>

                        <div className="min-w-0">
                            <input
                                type="text"
                                id="name"
                                name="name"
                                required
                                placeholder={t(language, "name")}
                                value={formValues.name}
                                onChange={ev => updateField("name", ev.target.value)}
                                className="w-full py-2 border-b border-[rgba(0,0,0,0.15)] bg-transparent text-base text-black placeholder:text-black/45 focus:outline-none"
                            />

                            <input
                                type="email"
                                id="email"
                                name="email"
                                required
                                placeholder={t(language, "email")}
                                value={formValues.email}
                                onChange={ev => updateField("email", ev.target.value)}
                                className="w-full mt-3 py-2 border-b border-[rgba(0,0,0,0.15)] bg-transparent text-base text-black placeholder:text-black/45 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <input
                            type="password"
                            id="password"
                            name="password"
                            placeholder={t(language, "password")}
                            value={formValues.password}
                            onChange={ev => updateField("password", ev.target.value)}
                            className="w-full py-2 border-b border-[rgba(0,0,0,0.15)] bg-transparent text-base text-black placeholder:text-black/45 focus:outline-none"
                        />

                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            placeholder={t(language, "confirmPassword")}
                            value={formValues.confirmPassword}
                            onChange={ev => updateField("confirmPassword", ev.target.value)}
                            className="w-full py-2 border-b border-[rgba(0,0,0,0.15)] bg-transparent text-base text-black placeholder:text-black/45 focus:outline-none"
                        />
                    </div>

                    <h4 className="mb-4 mt-6 text-[16px] font-bold leading-[1.333333] text-black">Configurações do sistema</h4>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <label className="text-[13px] font-semibold text-black">
                            {t(language, "defaultView")}
                            <div className="relative mt-4">
                                <select
                                    name="default-agenda-id"
                                    value={formValues.defaultAgendaId || agendas?.[0]?.id || ""}
                                    onChange={ev => updateField("defaultAgendaId", ev.target.value)}
                                    className="w-full appearance-none border-b border-[rgba(0,0,0,0.15)] bg-transparent pb-2 pl-0 pr-6 text-base font-normal text-black focus:outline-none"
                                    disabled={agendas.length === 0}
                                >
                                    {agendas.length === 0 && <option value="">-</option>}
                                    {agendas.map(agenda => (
                                        <option key={agenda.id} value={agenda.id}>{agenda.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
                            </div>
                        </label>

                        <label className="text-[13px] font-semibold text-black">
                            {t(language, "language")}
                            <div className="relative mt-4">
                                <select
                                    name="language"
                                    value={formValues.language}
                                    onChange={ev => updateField("language", ev.target.value)}
                                    className="w-full appearance-none border-b border-[rgba(0,0,0,0.15)] bg-transparent pb-2 pl-0 pr-6 text-base font-normal text-black focus:outline-none"
                                >
                                    <option value="ptBR">{t(language, "portugueseBrazil")}</option>
                                    <option value="enUS">{t(language, "english")}</option>
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
                            </div>
                        </label>

                        <label className="text-[13px] font-semibold text-black">
                            {t(language, "dateFormat")}
                            <div className="relative mt-4">
                                <select
                                    name="date-format"
                                    value={formValues.dateFormat}
                                    onChange={ev => updateField("dateFormat", ev.target.value)}
                                    className="w-full appearance-none border-b border-[rgba(0,0,0,0.15)] bg-transparent pb-2 pl-0 pr-6 text-base font-normal text-black focus:outline-none"
                                >
                                    <option value="DD-MM">DD-MM</option>
                                    <option value="MM-DD">MM-DD</option>
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
                            </div>
                        </label>

                        <label className="text-[13px] font-semibold text-black">
                            {t(language, "weekStartsOn")}
                            <div className="relative mt-4">
                                <select
                                    name="week-starts-on"
                                    value={formValues.weekStartsOn}
                                    onChange={ev => updateField("weekStartsOn", ev.target.value)}
                                    className="w-full appearance-none border-b border-[rgba(0,0,0,0.15)] bg-transparent pb-2 pl-0 pr-6 text-base font-normal text-black focus:outline-none"
                                >
                                    <option value="Monday">{t(language, "monday")}</option>
                                    <option value="Sunday">{t(language, "sunday")}</option>
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
                            </div>
                        </label>
                    </div>

                    <div className="mt-6 w-full flex justify-between items-center">
                        <button
                            type="submit"
                            disabled={!hasChanges}
                            className="app-button-hover py-1.5 px-5 border border-black bg-black text-white rounded-full font-bold disabled:opacity-20"
                        >
                            {t(language, "save")}
                        </button>

                        <button
                            type="button"
                            className="app-button-hover my-2 rounded-full py-1 text-[14px] font-normal text-[#df535f]"
                            onClick={openDeleteAccountModal}
                        >
                            <Trash03 className="mr-1 inline h-4 w-4" /> {t(language, "deleteAccount")}
                        </button>
                    </div>
                </Form>
            </div>
        </Blur>
        )}

        {isDeleteModalOpen && (
            <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto overscroll-contain bg-black/20 px-4 pt-16 pb-10" onClick={closeDeleteAccountModal}>
                <div
                    ref={deleteModalRef}
                    className="relative mb-6 w-[32rem] max-w-full rounded-[28px] bg-[#efe5de] px-6 py-7 shadow-lg text-black"
                    onClick={ev => ev.stopPropagation()}
                >
                    <h4 className="text-[21px] font-bold leading-7 tracking-[-0.5px] text-black">
                        {t(language, "deleteAccountConfirmTitle")}
                    </h4>
                    <p className="mt-3 text-base leading-7 text-black">
                        {t(language, "deleteAccountConfirmMessage")}
                    </p>

                    {deleteAccountError && (
                        <p className="mt-3 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">
                            {deleteAccountError}
                        </p>
                    )}

                    <div className="mt-5 flex items-center gap-3">
                        <button
                            type="button"
                            disabled={isDeletingAccount}
                            onClick={handleDeleteAccount}
                            className="app-button-hover rounded-full bg-[#df535f] px-6 py-2 text-base font-bold text-white disabled:opacity-20"
                        >
                            {isDeletingAccount ? `${t(language, "confirmDeleteAccount")}...` : t(language, "confirmDeleteAccount")}
                        </button>
                        <button
                            type="button"
                            disabled={isDeletingAccount}
                            onClick={closeDeleteAccountModal}
                            className="app-button-hover rounded-full border border-black px-6 py-2 text-base font-bold text-black disabled:opacity-20"
                        >
                            {t(language, "cancel")}
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
