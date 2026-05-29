import React from "react";
import Blur from "../Blur.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getAppLanguage, t } from "../../scripts/i18n.js";
import { sendAgendaInvite } from "../../scripts/api.js";
import { closeForm, openForm, subscribeToModalState } from "../../scripts/utils.js";

export default function InviteCollaboratorForm() {
    const { currentUser, agendas } = useAuth();
    const language = getAppLanguage(currentUser?.language);
    const currentAgenda = agendas.find(agenda => String(agenda.id) === String(currentUser?.currentAgendaId));
    const copy = React.useMemo(() => ({
        title: t(language, "inviteCollaboratorTitle"),
        description: t(language, "inviteCollaboratorDescription"),
        emailLabel: t(language, "emailField"),
        send: t(language, "inviteCollaboratorSend"),
        sending: t(language, "inviteCollaboratorSending"),
        success: t(language, "inviteCollaboratorSuccess"),
        error: t(language, "inviteCollaboratorError"),
        cancel: t(language, "cancel"),
    }), [language]);

    const inputRef = React.useRef(null);
    const modalRef = React.useRef(null);
    const [email, setEmail] = React.useState("");
    const [isSending, setIsSending] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState("");
    const [successMessage, setSuccessMessage] = React.useState("");

    React.useEffect(() => {
        const focusInput = () => {
            inputRef.current?.focus();
            inputRef.current?.select?.();
        };

        let rafId = null;
        let timeoutId = null;

        const scheduleFocus = () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            if (timeoutId !== null) window.clearTimeout(timeoutId);

            rafId = requestAnimationFrame(focusInput);
            timeoutId = window.setTimeout(focusInput, 180);
        };

        const unsubscribe = subscribeToModalState("invite-collaborator-form", isOpen => {
            if (isOpen) {
                scheduleFocus();
                setErrorMessage("");
                setSuccessMessage("");
            }
        });

        return () => {
            unsubscribe();
            if (rafId !== null) cancelAnimationFrame(rafId);
            if (timeoutId !== null) window.clearTimeout(timeoutId);
        };
    }, []);

    React.useEffect(() => {
        if (!successMessage) return undefined;

        const timeoutId = window.setTimeout(() => {
            setSuccessMessage("");
        }, 3000);

        return () => window.clearTimeout(timeoutId);
    }, [successMessage]);

    async function handleSubmit(ev) {
        ev.preventDefault();
        if (!currentAgenda?.id || !email.trim() || isSending) return;

        setIsSending(true);
        setErrorMessage("");
        setSuccessMessage("");

        try {
            await sendAgendaInvite(currentAgenda.id, email.trim(), window.location.origin, language);
            setEmail("");
            setSuccessMessage(copy.success);
        } catch (err) {
            setErrorMessage(err?.message || copy.error);
        } finally {
            setIsSending(false);
        }
    }

    function handleClose() {
        closeForm("invite-collaborator-form");
        setErrorMessage("");
        setSuccessMessage("");
        requestAnimationFrame(() => openForm("share-settings-form"));
    }

    return (
        <Blur bgColor="bg-black" type="invite-collaborator-form">
            <div
                ref={modalRef}
                className="invite-collaborator-form ds-modal-shell relative z-20 w-[28rem] p-4 transition-all duration-[160ms] ease-linear lg:p-8"
                onClick={ev => ev.stopPropagation()}
            >
                <div>
                    <h3 className="ds-type-h4 text-ds-text-default">
                        {copy.title}
                    </h3>
                    <p className="ds-type-body-sm mt-2 text-ds-text-muted">
                        {copy.description}
                    </p>
                </div>

                <form className="mt-6" onSubmit={handleSubmit}>
                    <label className="ds-type-label block text-ds-text-default" htmlFor="invite-collaborator-email">
                        {copy.emailLabel}
                    </label>
                    <input
                        ref={inputRef}
                        id="invite-collaborator-email"
                        type="email"
                        value={email}
                        onChange={ev => setEmail(ev.target.value)}
                        className="ds-input-line mt-2 py-2"
                    />

                    {errorMessage && (
                        <p className="ds-alert ds-alert-danger mt-3">
                            {errorMessage}
                        </p>
                    )}

                    {successMessage && (
                        <p className="ds-alert ds-alert-success mt-3">
                            {successMessage}
                        </p>
                    )}

                    <div className="mt-6 flex items-center justify-start gap-3">
                        <button
                            type="submit"
                            disabled={isSending || !email.trim()}
                            className="app-button-hover ds-button-primary ds-type-body rounded-full px-6 py-2 font-bold disabled:opacity-20"
                        >
                            {isSending ? copy.sending : copy.send}
                        </button>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="app-button-hover ds-button-secondary ds-type-body rounded-full px-6 py-2 font-bold"
                        >
                            {copy.cancel}
                        </button>
                    </div>
                </form>
            </div>
        </Blur>
    );
}
