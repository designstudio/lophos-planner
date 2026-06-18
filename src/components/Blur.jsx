import { useRef, useEffect, useState } from 'react';
import { updateTask, tryCatchDecorator } from "../scripts/api.js";
import { clearTaskFromUrl, closeForm, hasOpenModals, isModalOpen, registerModal, setPageScrollLocked, subscribeToModalState } from "../scripts/utils.js";

export default function Blur({ children, type, bgColor="bg-white", forceActive = false, mobileSheet = false }) {
    const blurRef = useRef(null);
    const openedAtRef = useRef(0);
    const lastFocusedElementRef = useRef(null);
    const [isActive, setIsActive] = useState(() => forceActive || isModalOpen(type));
    const topSpacingClass = ["task-menu", "search-form", "share-settings-form", "update-user-form", "invite-collaborator-form", "status-generator-form"].includes(type)
        ? "pt-16"
        : "pt-6";

    function clearOpenedTaskInUrl() {
        if (type !== "task-menu") return;
        clearTaskFromUrl();
    }

    useEffect(() => {
        const el = blurRef.current;
        if (!el) return;

        const unregister = registerModal(type, el);

        if (forceActive) {
            openedAtRef.current = Date.now();
            setPageScrollLocked(true);
        }
        return () => {
            unregister();
            if (!hasOpenModals()) {
                setPageScrollLocked(false);
            }
        };
    }, [forceActive, type]);

    useEffect(() => {
        return subscribeToModalState(type, nextIsOpen => {
            setIsActive(nextIsOpen || forceActive);
            if (nextIsOpen) {
                openedAtRef.current = Date.now();
            }
        });
    }, [forceActive, type]);

    useEffect(() => {
        if (!isActive) {
            const lastFocusedElement = lastFocusedElementRef.current;
            if (lastFocusedElement && lastFocusedElement.isConnected) {
                lastFocusedElement.focus?.();
            }
            return;
        }

        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement && !blurRef.current?.contains(activeElement)) {
            lastFocusedElementRef.current = activeElement;
        }

        const focusFirstElement = () => {
            const focusableElement = blurRef.current?.querySelector(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );

            if (focusableElement instanceof HTMLElement) {
                focusableElement.focus();
                return;
            }

            blurRef.current?.focus();
        };

        const rafId = requestAnimationFrame(focusFirstElement);
        return () => cancelAnimationFrame(rafId);
    }, [isActive]);

    async function closeModal() {
        const selection = typeof window !== "undefined" ? window.getSelection?.() : null;
        if (selection && !selection.isCollapsed && String(selection).trim()) return;

        // Ignore close shortly after open because Sortable.js can emit a synthetic click.
        if (type === "task-menu" && Date.now() - openedAtRef.current < 300) return;
        // Prevent opener click bleed-through for other modals.
        if (type !== "task-menu" && Date.now() - openedAtRef.current < 120) return;

        const rootEl = blurRef.current;
        const colorPicker = rootEl?.querySelector(".task-menu-color-picker");
        if (colorPicker) {
            colorPicker.classList.remove("active");
        }

        clearOpenedTaskInUrl();

        const form = rootEl?.querySelector(".task-menu-form");
        if (form) {
            const noteFlushDetail = { type, noteDraft: null };
            window.dispatchEvent(new CustomEvent("task-note-flush-request", {
                detail: noteFlushDetail,
            }));

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
            const flushedNoteDraft = noteFlushDetail.noteDraft && typeof noteFlushDetail.noteDraft === "object"
                ? noteFlushDetail.noteDraft
                : null;
            const nextDescription = flushedNoteDraft
                ? (flushedNoteDraft.description || "").toString()
                : (formData.get("task-description") || "").toString();
            const noteFormat = flushedNoteDraft
                ? (flushedNoteDraft.note_format || "").toString()
                : (formData.get("task-note-format") || "").toString();
            const noteBlocksRaw = flushedNoteDraft
                ? JSON.stringify(flushedNoteDraft.note_blocks || null)
                : (formData.get("task-note-blocks") || "").toString();
            const notePlainText = flushedNoteDraft
                ? (flushedNoteDraft.note_plain_text || "").toString()
                : (formData.get("task-note-plain-text") || "").toString();
            const noteMigratedAt = flushedNoteDraft
                ? (flushedNoteDraft.note_migrated_at || "").toString()
                : (formData.get("task-note-migrated-at") || "").toString();
            let noteBlocks = null;

            if (noteBlocksRaw.trim()) {
                try {
                    noteBlocks = JSON.parse(noteBlocksRaw);
                } catch {
                    noteBlocks = null;
                }
            }

            const updates = {
                name: formData.get("task-name"),
                date: formData.get("task-date"),
                done: formData.get("task-type") === "meeting" ? false : formData.has("task-done"),
                color: formData.get("task-color"),
                task_type: formData.get("task-type") || "task",
                description: nextDescription,
                related_links: relatedLinks,
            };

            if (noteFormat === "blocknote") {
                updates.note_format = "blocknote";
                updates.note_blocks = noteBlocks;
                updates.note_plain_text = notePlainText;
                updates.note_migrated_at = noteMigratedAt || null;
            } else {
                updates.note_format = "markdown";
                updates.note_blocks = null;
                updates.note_plain_text = "";
                updates.note_migrated_at = null;
            }

            window.dispatchEvent(new CustomEvent("task-updated-local", {
                detail: { taskId, updates },
            }));

            tryCatchDecorator(updateTask)(taskId, updates);
        }

        if (!forceActive) {
            await closeForm(type);
        }
        setPageScrollLocked(false);
    }

    async function handleTaskMenuClose(ev) {
        if (ev.target !== ev.currentTarget) return;
        ev.stopPropagation();
        await closeModal();
    }

    useEffect(() => {
        function handleKeyDown(ev) {
            if (ev.key !== "Escape") return;

            const el = blurRef.current;
            if (!el?.classList.contains("active")) return;

            ev.preventDefault();
            closeModal();
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [forceActive, type]);

    useEffect(() => {
        async function handleModalCloseRequest(ev) {
            if (ev.detail?.type !== type) return;

            const el = blurRef.current;
            if (!el?.classList.contains("active")) return;

            await closeModal();
        }

        window.addEventListener("modal-close-request", handleModalCloseRequest);
        return () => window.removeEventListener("modal-close-request", handleModalCloseRequest);
    }, [type]);

    return (
        <div ref={blurRef} data-id={type} data-mobile-sheet={mobileSheet ? "true" : "false"} className={`blur-bg ${isActive ? "active" : ""} fixed inset-0 z-[60]
        overflow-y-auto overscroll-contain px-4 ${topSpacingClass} pb-10 transition-all duration-[160ms] ease-linear cursor-default flex justify-center items-start`}
             style={{
                 backgroundColor: "var(--color-overlay-scrim)",
                 backdropFilter: "blur(2px)",
                 WebkitBackdropFilter: "blur(2px)",
             }}
             role="dialog"
             aria-modal="true"
             aria-hidden={!isActive}
             tabIndex={-1}
             onClick={handleTaskMenuClose} >
            { children }
        </div>
    )
}
