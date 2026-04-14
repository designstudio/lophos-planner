import React from "react";
import Blur from "../Blur.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getAppLanguage } from "../../scripts/i18n.js";
import { sendAgendaInvite } from "../../scripts/api.js";
import { closeForm, openForm } from "../../scripts/utils.js";

function getInviteCopy(language) {
    return language === "enUS"
        ? {
            title: "Invite to collaborate",
            description: "The person receives an email with the invite and joins the agenda after creating an account or signing in.",
            emailLabel: "Email",
            send: "Invite",
            sending: "Sending...",
            success: "Invite sent!",
            error: "Unable to send the invite right now.",
            cancel: "Cancel",
        }
        : {
            title: "Convidar para colaborar",
            description: "A pessoa recebe um e-mail com o convite e entra na agenda ao criar conta ou acessar.",
            emailLabel: "E-mail",
            send: "Convidar",
            sending: "Enviando...",
            success: "Convite enviado!",
            error: "NÃ£o foi possÃ­vel enviar o convite agora.",
            cancel: "Cancelar",
        };
}

export default function InviteCollaboratorForm() {
    const { currentUser, agendas } = useAuth();
    const language = getAppLanguage(currentUser?.language);
    const currentAgenda = agendas.find(agenda => String(agenda.id) === String(currentUser?.currentAgendaId));
    const copy = React.useMemo(() => getInviteCopy(language), [language]);

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

        const blurEl = modalRef.current?.closest('.blur-bg[data-id="invite-collaborator-form"]');
        if (!blurEl) return undefined;

        let rafId = null;
        let timeoutId = null;

        const scheduleFocus = () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            if (timeoutId !== null) window.clearTimeout(timeoutId);

            rafId = requestAnimationFrame(focusInput);
            timeoutId = window.setTimeout(focusInput, 180);
        };

        if (blurEl.classList.contains("active")) {
            scheduleFocus();
        }

        const observer = new MutationObserver(() => {
            if (blurEl.classList.contains("active")) {
                scheduleFocus();
                setErrorMessage("");
                setSuccessMessage("");
            }
        });

        observer.observe(blurEl, { attributes: true, attributeFilter: ["class"] });

        return () => {
            observer.disconnect();
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
                className="invite-collaborator-form relative z-20 w-[28rem] rounded-xl bg-[rgb(250,250,252)] p-4 text-gray-600 transition-all duration-[160ms] ease-linear lg:p-8"
                onClick={ev => ev.stopPropagation()}
            >
                <div>
                    <h3 className="text-xl font-bold tracking-tight text-black">
                        {copy.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-black/70">
                        {copy.description}
                    </p>
                </div>

                <form className="mt-6" onSubmit={handleSubmit}>
                    <label className="block text-sm font-bold text-black" htmlFor="invite-collaborator-email">
                        {copy.emailLabel}
                    </label>
                    <input
                        ref={inputRef}
                        id="invite-collaborator-email"
                        type="email"
                        value={email}
                        onChange={ev => setEmail(ev.target.value)}
                        className="mt-2 w-full border-b border-[rgba(0,0,0,0.15)] bg-transparent py-2 text-[16px] text-black focus:border-black focus:outline-none"
                    />

                    {errorMessage && (
                        <p className="mt-3 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">
                            {errorMessage}
                        </p>
                    )}

                    {successMessage && (
                        <p className="mt-3 rounded-md bg-green-100 px-3 py-2 text-sm text-green-700">
                            {successMessage}
                        </p>
                    )}

                    <div className="mt-6 flex items-center justify-start gap-3">
                        <button
                            type="submit"
                            disabled={isSending || !email.trim()}
                            className="app-button-hover rounded-full bg-black px-6 py-2 text-[16px] font-bold leading-[1.333] text-white disabled:opacity-20"
                        >
                            {isSending ? copy.sending : copy.send}
                        </button>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="app-button-hover rounded-full border border-black px-6 py-2 text-[16px] font-bold leading-[1.333] text-black"
                        >
                            {copy.cancel}
                        </button>
                    </div>
                </form>
            </div>
        </Blur>
    );
}
