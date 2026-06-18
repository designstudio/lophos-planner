import { Form, useActionData, useNavigation } from "react-router-dom";
import Blur from "../Blur.jsx";
import React from "react";

import { useAuth } from "../../contexts/AuthContext.jsx";
import { Moon02, Camera01, Check, Trash03 } from "@untitledui/icons";
import { getAppLanguage, t } from "../../scripts/i18n.js";
import { closeForm, openForm } from "../../scripts/utils.js";
import OptionMenuSelect from "../ui/OptionMenuSelect.jsx";

const MAX_AVATAR_SIZE_BYTES = 100 * 1024;

export default function UpdateUserForm({ recoveryMode = false }) {
    const errorMessage = useActionData();
    const navigation = useNavigation();
    const { currentUser, agendas, deleteAccount } = useAuth();
    const language = getAppLanguage(currentUser?.language);
    const passwordInputRef = React.useRef(null);
    const confirmPasswordInputRef = React.useRef(null);

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
        defaultView: currentUser?.defaultView || "week",
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
        currentUser?.defaultView,
        agendas,
    ]);

    const [formValues, setFormValues] = React.useState(initialFormValues);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = React.useState(false);
    const [deleteAccountError, setDeleteAccountError] = React.useState("");
    const [avatarErrorMessage, setAvatarErrorMessage] = React.useState("");
    const [avatarLoading, setAvatarLoading] = React.useState(false);
    const deleteModalRef = React.useRef(null);
    const deleteConfirmButtonRef = React.useRef(null);
    const deleteCancelButtonRef = React.useRef(null);
    const avatarInputRef = React.useRef(null);
    const wasSubmittingRef = React.useRef(false);

    React.useEffect(() => {
        setFormValues(initialFormValues);
    }, [initialFormValues]);

    React.useEffect(() => {
        if (!recoveryMode) return;
        passwordInputRef.current?.focus?.();
    }, [recoveryMode]);

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
            deleteCancelButtonRef.current?.focus?.();
        });
    }, [isDeleteModalOpen]);

    React.useEffect(() => {
        function handleKeyDown(ev) {
            if (!isDeleteModalOpen) return;

            if (ev.key === "Escape") {
                if (isDeletingAccount) return;
                ev.preventDefault();
                closeDeleteAccountModal();
                return;
            }

            if (ev.key !== "Tab") return;

            const focusableElements = [
                deleteConfirmButtonRef.current,
                deleteCancelButtonRef.current,
            ].filter(Boolean);

            if (focusableElements.length === 0) return;

            const currentIndex = focusableElements.indexOf(document.activeElement);
            const nextIndex = ev.shiftKey
                ? (currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1)
                : (currentIndex === -1 || currentIndex === focusableElements.length - 1 ? 0 : currentIndex + 1);

            ev.preventDefault();
            focusableElements[nextIndex]?.focus?.();
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
            formValues.defaultView !== initialFormValues.defaultView ||
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
        <Blur type="update-user-form" mobileSheet>
            <div
                className="update-user-form ds-modal-shell ds-mobile-sheet relative z-20 mb-6 w-[32rem] max-w-full px-6 py-7 transition-all duration-500 ease-linear"
                onClick={ev => ev.stopPropagation()}
            >
                <h3 className="ds-type-h4 text-ds-text-default">{t(language, "settingsTitle")}</h3>

                {recoveryMode && (
                    <div className="ds-alert ds-alert-success mt-3">
                        {t(language, "recoveryHelper")}
                    </div>
                )}

                {errorMessage && typeof errorMessage === "string" && (
                    <h3 className="ds-alert ds-alert-danger mt-2">
                        {errorMessage}
                    </h3>
                )}

                <Form method="POST" className="relative mt-6" action="/update-user">
                    <div
                        className="flex w-full items-center gap-3 rounded-ds-2xl bg-ds-text-default px-4 py-4 text-ds-text-inverse"
                        style={{
                            backgroundColor: "var(--color-text-default)",
                            color: "var(--color-text-inverse)",
                            borderRadius: "var(--radius-2xl)",
                        }}
                    >
                        <Moon02 className="h-7 w-7 text-ds-text-inverse" style={{ color: "var(--color-text-inverse)" }} />
                        <div className="flex-1">
                            <p className="ds-type-button text-ds-text-inverse">{t(language, "darkMode")}</p>
                            <p className="ds-type-body-sm text-ds-text-inverse">{t(language, "darkModeDescription")}</p>
                        </div>

                        <button
                            type="button"
                            className={`relative box-border h-6 w-11 appearance-none rounded-full border-2 shadow-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-border-default focus-visible:ring-offset-2 focus-visible:ring-offset-ds-text-default ${
                                formValues.darkMode
                                    ? "border-ds-background-surface bg-ds-background-surface"
                                    : "border-ds-background-surface bg-ds-text-default"
                            }`}
                            onClick={() => {
                                const next = !formValues.darkMode;
                                updateField("darkMode", next);
                                localStorage.setItem("theme", next ? "dark" : "light");
                            }}
                            style={{
                                backgroundColor: formValues.darkMode ? "var(--color-bg-surface)" : "var(--color-text-default)",
                                borderColor: "var(--color-bg-surface)",
                                borderRadius: "var(--radius-full)",
                            }}
                        >
                            <div className={`h-4 w-4 absolute left-0.5 top-1/2 -translate-y-1/2 rounded-full flex items-center justify-center transition-all transform ${
                                formValues.darkMode
                                    ? "translate-x-[20px] bg-ds-text-default"
                                    : "translate-x-0 bg-ds-background-surface"
                            }`}
                                style={{
                                    backgroundColor: formValues.darkMode ? "var(--color-text-default)" : "var(--color-bg-surface)",
                                    borderRadius: "var(--radius-full)",
                                }}>
                                {formValues.darkMode && <Check className="h-3 w-3 text-ds-text-inverse" strokeWidth={3} />}
                            </div>
                        </button>
                    </div>

                    <input type="checkbox" checked={formValues.darkMode} name="dark-mode" id="dark-mode" className="hidden" readOnly />
                    <input type="text" defaultValue="update-user-form" name="form-id" id="form-id" className="hidden" />
                    <input type="hidden" name="default-agenda-id" value={formValues.defaultAgendaId || ""} />
                    <input type="hidden" name="default-view" value={formValues.defaultView || "week"} />
                    <input type="hidden" name="language" value={formValues.language || "ptBR"} />
                    <input type="hidden" name="date-format" value={formValues.dateFormat || "DD-MM"} />
                    <input type="hidden" name="week-starts-on" value={formValues.weekStartsOn || "Monday"} />

                    <h4 className="ds-type-label mb-4 mt-8 text-ds-text-default">{t(language, "editProfileSectionTitle")}</h4>

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
                                    className="relative block h-14 w-14 overflow-hidden rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-border-default focus-visible:ring-offset-2"
                                >
                                    {formValues.avatar ? (
                                        <img src={formValues.avatar} alt={t(language, "profileAvatarAlt")} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="ds-type-button flex h-full w-full items-center justify-center bg-ds-background-surface text-ds-text-subtle">
                                            {(formValues.name || currentUser?.name || "U")[0].toUpperCase()}
                                        </div>
                                    )}
                                </button>
                                <div
                                    className="pointer-events-none absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-ds-text-default"
                                    style={{
                                        backgroundColor: "var(--color-text-default)",
                                        borderRadius: "var(--radius-full)",
                                    }}
                                >
                                    {avatarLoading ? (
                                        <svg className="h-[10px] w-[10px] animate-spin text-ds-text-inverse" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                    ) : (
                                        <Camera01
                                            className="h-[10px] w-[10px] text-ds-text-inverse"
                                            style={{ color: "var(--color-text-inverse)" }}
                                        />
                                    )}
                                </div>
                            {avatarErrorMessage && (
                                <p className="ds-alert ds-alert-danger mt-3 max-w-[12rem]">
                                    {avatarErrorMessage}
                                </p>
                            )}
                        </div>

                        <div className="min-w-0">
                            <label htmlFor="name" className="sr-only">{t(language, "name")}</label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                required
                                placeholder={t(language, "name")}
                                value={formValues.name}
                                onChange={ev => updateField("name", ev.target.value)}
                                className="ds-input-line"
                            />

                            <label htmlFor="email" className="sr-only">{t(language, "emailField")}</label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                required
                                placeholder={t(language, "email")}
                                value={formValues.email}
                                onChange={ev => updateField("email", ev.target.value)}
                                className="ds-input-line mt-3"
                            />
                        </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label htmlFor="password" className="sr-only">{t(language, "password")}</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            ref={passwordInputRef}
                            placeholder={t(language, "password")}
                            value={formValues.password}
                            onChange={ev => updateField("password", ev.target.value)}
                            className="ds-input-line"
                        />

                        <label htmlFor="confirmPassword" className="sr-only">{t(language, "confirmPassword")}</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            ref={confirmPasswordInputRef}
                            placeholder={t(language, "confirmPassword")}
                            value={formValues.confirmPassword}
                            onChange={ev => updateField("confirmPassword", ev.target.value)}
                            className="ds-input-line"
                        />
                    </div>

                    <h4 className="ds-type-label mb-4 mt-8 text-ds-text-default">{t(language, "systemSettingsSectionTitle")}</h4>

                    <div className="divide-y divide-ds-border-default border-b border-ds-border-default">
                        <div className="flex items-center justify-between gap-4 py-4">
                            <span className="ds-type-body min-w-0 flex-1 text-ds-text-default">{t(language, "defaultAgendaLabel")}</span>
                            <OptionMenuSelect
                                value={formValues.defaultAgendaId || agendas?.[0]?.id || ""}
                                onChange={value => updateField("defaultAgendaId", value)}
                                disabled={agendas.length === 0}
                                placeholder="-"
                                wrapperClassName="w-auto shrink-0"
                                triggerClassName="ds-type-body rounded-[10px] border-0 bg-transparent px-2 py-1 text-ds-text-default transition-colors hover:bg-ds-background-surface-muted focus:outline-none focus-visible:bg-ds-background-surface-muted focus-visible:ring-2 focus-visible:ring-ds-border-default"
                                options={agendas.length === 0
                                    ? [{ value: "", label: "-" }]
                                    : agendas.map(agenda => ({
                                        value: agenda.id,
                                        label: agenda.name,
                                    }))}
                            />
                        </div>

                        <div className="flex items-center justify-between gap-4 py-4">
                            <span className="ds-type-body min-w-0 flex-1 text-ds-text-default">{t(language, "language")}</span>
                            <OptionMenuSelect
                                value={formValues.language}
                                onChange={value => updateField("language", value)}
                                wrapperClassName="w-auto shrink-0"
                                triggerClassName="ds-type-body rounded-[10px] border-0 bg-transparent px-2 py-1 text-ds-text-default transition-colors hover:bg-ds-background-surface-muted focus:outline-none focus-visible:bg-ds-background-surface-muted focus-visible:ring-2 focus-visible:ring-ds-border-default"
                                options={[
                                    { value: "ptBR", label: t(language, "portugueseBrazil") },
                                    { value: "enUS", label: t(language, "english") },
                                ]}
                            />
                        </div>

                        <div className="flex items-center justify-between gap-4 py-4">
                            <span className="ds-type-body min-w-0 flex-1 text-ds-text-default">{t(language, "dateFormat")}</span>
                            <OptionMenuSelect
                                value={formValues.dateFormat}
                                onChange={value => updateField("dateFormat", value)}
                                wrapperClassName="w-auto shrink-0"
                                triggerClassName="ds-type-body rounded-[10px] border-0 bg-transparent px-2 py-1 text-ds-text-default transition-colors hover:bg-ds-background-surface-muted focus:outline-none focus-visible:bg-ds-background-surface-muted focus-visible:ring-2 focus-visible:ring-ds-border-default"
                                options={[
                                    { value: "DD-MM", label: "DD-MM" },
                                    { value: "MM-DD", label: "MM-DD" },
                                ]}
                            />
                        </div>

                        <div className="flex items-center justify-between gap-4 py-4">
                            <span className="ds-type-body min-w-0 flex-1 text-ds-text-default">{t(language, "weekStartsOn")}</span>
                            <OptionMenuSelect
                                value={formValues.weekStartsOn}
                                onChange={value => updateField("weekStartsOn", value)}
                                wrapperClassName="w-auto shrink-0"
                                triggerClassName="ds-type-body rounded-[10px] border-0 bg-transparent px-2 py-1 text-ds-text-default transition-colors hover:bg-ds-background-surface-muted focus:outline-none focus-visible:bg-ds-background-surface-muted focus-visible:ring-2 focus-visible:ring-ds-border-default"
                                options={[
                                    { value: "Monday", label: t(language, "monday") },
                                    { value: "Sunday", label: t(language, "sunday") },
                                ]}
                            />
                        </div>
                    </div>

                    <div className="mt-6 w-full flex justify-between items-center">
                        <button
                            type="submit"
                            disabled={!hasChanges}
                            className="app-button-hover ds-button-primary ds-type-body rounded-full border border-transparent px-5 py-1.5 font-bold disabled:opacity-20"
                        >
                            {t(language, "save")}
                        </button>

                        <button
                            type="button"
                            className="app-button-hover ds-danger-trigger-hover ds-type-button my-2 rounded-full px-3 py-2 font-normal text-ds-danger-solid"
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
            <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto overscroll-contain px-4 pb-10 pt-16 ds-overlay" onClick={closeDeleteAccountModal}>
                <div
                    ref={deleteModalRef}
                    className="ds-modal-shell relative mb-6 w-[32rem] max-w-full px-6 py-7"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="delete-account-modal-title"
                    aria-describedby="delete-account-modal-description"
                    onClick={ev => ev.stopPropagation()}
                >
                    <h4 id="delete-account-modal-title" className="ds-type-h4 text-ds-text-default">
                        {t(language, "deleteAccountConfirmTitle")}
                    </h4>
                    <p id="delete-account-modal-description" className="ds-type-body mt-3 text-ds-text-default">
                        {t(language, "deleteAccountConfirmMessage")}
                    </p>

                    {deleteAccountError && (
                        <p className="ds-alert ds-alert-danger mt-3">
                            {deleteAccountError}
                        </p>
                    )}

                    <div className="mt-5 flex items-center gap-3">
                        <button
                            ref={deleteConfirmButtonRef}
                            type="button"
                            disabled={isDeletingAccount}
                            onClick={handleDeleteAccount}
                            className="app-button-hover ds-button-danger bg-ds-danger-solid text-ds-text-inverse ds-type-body rounded-full px-6 py-2 font-bold disabled:opacity-20"
                        >
                            {isDeletingAccount ? `${t(language, "confirmDeleteAccount")}...` : t(language, "confirmDeleteAccount")}
                        </button>
                        <button
                            ref={deleteCancelButtonRef}
                            type="button"
                            disabled={isDeletingAccount}
                            onClick={closeDeleteAccountModal}
                            className="app-button-hover ds-button-secondary ds-type-body rounded-full px-6 py-2 font-bold disabled:opacity-20"
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

