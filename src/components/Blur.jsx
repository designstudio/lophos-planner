import { useRef, useEffect } from 'react';
import { useSearchParams } from "react-router-dom";
import { updateTask, tryCatchDecorator } from "../scripts/api.js";
import { closeForm } from "../scripts/utils.js";

export default function Blur({ children, type, bgColor="bg-white", forceActive = false }) {
    const blurRef = useRef(null);
    const openedAtRef = useRef(0);
    const [, setSearchParams] = useSearchParams();

    function clearOpenedTaskInUrl() {
        if (type !== "task-menu") return;

        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.delete("openedTask");
            return next;
        });
    }

    useEffect(() => {
        const el = blurRef.current;
        if (!el) return;

        if (forceActive) {
            openedAtRef.current = Date.now();
            document.body.style.overflowY = "hidden";
        }

        const observer = new MutationObserver(() => {
            if (el.classList.contains('active')) {
                openedAtRef.current = Date.now();
            }
        });

        observer.observe(el, { attributes: true, attributeFilter: ['class'] });
        return () => {
            observer.disconnect();
            if (!document.querySelector(".blur-bg.active")) {
                document.body.style.overflowY = "auto";
            }
        };
    }, [forceActive]);

    async function handleTaskMenuClose(ev) {
        if (ev.target !== ev.currentTarget) return;

        const selection = typeof window !== "undefined" ? window.getSelection?.() : null;
        if (selection && !selection.isCollapsed && String(selection).trim()) return;

        // Ignore close shortly after open because Sortable.js can emit a synthetic click.
        if (type === "task-menu" && Date.now() - openedAtRef.current < 300) return;
        // Prevent opener click bleed-through for other modals.
        if (type !== "task-menu" && Date.now() - openedAtRef.current < 120) return;

        ev.stopPropagation();
        if (!forceActive) {
            closeForm(type);
        }

        const colorPicker = ev.target.querySelector(".task-menu-color-picker");
        if (colorPicker) {
            colorPicker.classList.remove("active");
        }

        clearOpenedTaskInUrl();

        const form = ev.target.querySelector(".task-menu-form");
        if (form) {
            const formData = new FormData(form);
            const rawRelatedLinks = formData.get("task-related-links");
            let relatedLinks = [];

            if (typeof rawRelatedLinks === "string" && rawRelatedLinks.trim()) {
                try {
                    const parsed = JSON.parse(rawRelatedLinks);
                    relatedLinks = Array.isArray(parsed) ? parsed : [];
                } catch {
                    relatedLinks = [];
                }
            }

            const taskId = formData.get("task-id");
            const nextDescription = (formData.get("task-description") || "").toString();
            const initialDescription = (formData.get("task-initial-description") || "").toString();
            const isDescriptionDirty = formData.get("task-description-dirty") === "true";
            const updates = {
                name: formData.get("task-name"),
                date: formData.get("task-date"),
                done: formData.has("task-done"),
                color: formData.get("task-color"),
                description: !isDescriptionDirty && !nextDescription.trim() && initialDescription.trim()
                    ? initialDescription
                    : nextDescription,
                related_links: relatedLinks,
            };

            window.dispatchEvent(new CustomEvent("task-updated-local", {
                detail: { taskId, updates },
            }));

            tryCatchDecorator(updateTask)(taskId, updates);
        }
        document.body.style.overflowY = 'auto';
    }

    return (
        <div ref={blurRef} data-id={type} className={`blur-bg ${forceActive ? "active" : ""} bg-black bg-opacity-20 dark:bg-opacity-40 fixed inset-0 z-10
        overflow-y-auto overscroll-contain px-4 pt-6 pb-10 transition-all duration-300 ease-linear cursor-default flex justify-center items-start`} onClick={handleTaskMenuClose} >
            { children }
        </div>
    )
}
