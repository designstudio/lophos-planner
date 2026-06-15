import React, {useRef} from "react";
import {ExtrasMenuBtn} from "./ExtrasMenuBtn.jsx";
import { openForm } from "../../scripts/utils.js";
import { SearchMd, Send01, Globe02 } from "@untitledui/icons";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getAppLanguage, t } from "../../scripts/i18n.js";
import OptionMenuSelect from "../ui/OptionMenuSelect.jsx";
import useAnimatedPresence from "../../hooks/useAnimatedPresence.js";

export default function ExtrasMenu({ isOpen = false, style = {}, onClose = () => {}, onOpenAbout = () => {} }) {
    const { isMounted, isVisible } = useAnimatedPresence(isOpen);
    const { currentUser, appLanguage, setLanguagePreference, agendas } = useAuth();
    const language = appLanguage || getAppLanguage(currentUser?.language);
    const currentAgenda = agendas.find(agenda => String(agenda.id) === String(currentUser?.currentAgendaId));
    const extrasMenuRef = useRef(null);

    function openInvitePage() {
        onOpenAbout();
        onClose();
    }

    function openSearchForm() {
        openForm("search-form");
        onClose();
    }

    function openShareForm() {
        openForm("share-settings-form");
        onClose();
    }

    const extrasBtns = [
        {
            text: t(language, "about"),
            onClick: openInvitePage,
        },
        ...(currentUser ? [
            {
                text: t(language, "search"),
                icon: SearchMd,
                onClick: openSearchForm,
            },
            ...(currentAgenda?.role === "owner" ? [{
                text: t(language, "share"),
                icon: Send01,
                onClick: openShareForm,
            }] : []),
        ] : []),
    ];

    if (!isMounted) {
        return null;
    }

    return (
        <div
            ref={extrasMenuRef}
            className={`extras-menu ${isMounted ? "active" : ""} animated-option-menu option-menu-surface rounded-ds-xl text-ds-text-default w-48 p-1.5 text-center`}
            data-state={isVisible ? "open" : "closed"}
            style={{ ...style, borderRadius: "var(--radius-xl)" }}
            onClick={ev => ev.stopPropagation()}>
            <ul className="px-0.5">
                {
                    extrasBtns.map((btn, index) => (
                        <ExtrasMenuBtn {...btn} key={index}/>
                    ))
                }
            </ul>
            <div className="mx-1.5 mt-2 border-t border-ds-border-default py-2.5">
                <label className="ds-type-body-sm flex items-center gap-2 px-1.5 text-ds-text-default">
                    <Globe02 className="h-[18px] w-[18px] shrink-0" />
                    <OptionMenuSelect
                        value={language}
                        onChange={value => setLanguagePreference(value)}
                        portalAnchorRef={extrasMenuRef}
                        wrapperClassName="flex-1"
                        triggerClassName="bg-transparent pr-6 ds-type-body-sm text-ds-text-default outline-none"
                        portalGap={0}
                        options={[
                            { value: "ptBR", label: t(language, "portugueseBrazil") },
                            { value: "enUS", label: t(language, "english") },
                        ]}
                    />
                </label>
            </div>
        </div>
    )
}
