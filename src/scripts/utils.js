export function formDate(date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function parseDateOnly(value) {
    if (value instanceof Date) {
        return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }

    if (typeof value === "string") {
        const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (match) {
            const [, year, month, day] = match;
            return new Date(Number(year), Number(month) - 1, Number(day));
        }
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return new Date();
    }

    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export function toInputDateValue(value) {
    return formDate(parseDateOnly(value));
}

export function toShortId(value, length = 8) {
    return String(value || "")
        .replace(/-/g, "")
        .slice(0, length);
}

export function matchesShortId(fullValue, shortValue) {
    const normalizedFullValue = String(fullValue || "").replace(/-/g, "");
    const normalizedShortValue = String(shortValue || "").replace(/-/g, "");

    if (!normalizedFullValue || !normalizedShortValue) return false;
    return normalizedFullValue.startsWith(normalizedShortValue);
}

export const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
let modalAnimationToken = 0;
const modalCloseTimers = new WeakMap();
let modalRecoveryListenersBound = false;
let modalRecoveryRafId = null;

function scheduleRecoverZombieBlurs() {
    if (typeof window === "undefined") return;
    if (modalRecoveryRafId !== null) return;

    modalRecoveryRafId = window.requestAnimationFrame(() => {
        modalRecoveryRafId = null;
        recoverZombieBlurs();
    });
}

function hardResetBlurState(blurEl, blurId) {
    if (!blurEl) return;

    const panel = blurEl.querySelector(`.${blurId}`);
    blurEl.getAnimations().forEach(animation => animation.cancel());
    panel?.getAnimations().forEach(animation => animation.cancel());

    blurEl.classList.remove("active");
    blurEl.dataset.closing = "false";
    blurEl.dataset.closeStartedAt = "";
    blurEl.style.opacity = "";

    if (panel) {
        panel.style.transform = "";
        panel.style.opacity = "";
        panel.style.top = "";
    }
}

function recoverZombieBlurs() {
    const activeBlurs = document.querySelectorAll(".blur-bg.active");

    activeBlurs.forEach(blurEl => {
        const blurId = blurEl.getAttribute("data-id");
        if (!blurId) return;

        const panel = blurEl.querySelector(`.${blurId}`);
        const panelStyle = panel ? window.getComputedStyle(panel) : null;
        const panelOpacity = panelStyle ? Number(panelStyle.opacity) : 1;
        const blurOpacity = Number(window.getComputedStyle(blurEl).opacity || 1);
        const isClosing = blurEl.dataset.closing === "true";
        const closeStartedAt = Number(blurEl.dataset.closeStartedAt || 0);
        const staleClosing = isClosing && closeStartedAt > 0 && (Date.now() - closeStartedAt > 350);
        const invisibleGhost = panelOpacity < 0.05 || blurOpacity < 0.05;

        if (staleClosing || invisibleGhost) {
            hardResetBlurState(blurEl, blurId);
        }
    });
}

function ensureModalRecoveryListeners() {
    if (modalRecoveryListenersBound || typeof window === "undefined") return;
    modalRecoveryListenersBound = true;

    window.addEventListener("focus", recoverZombieBlurs);
    // Run recovery before click handlers to prevent ghost overlays from stealing interaction.
    window.addEventListener("pointerdown", scheduleRecoverZombieBlurs, true);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            recoverZombieBlurs();
        }
    });
}

const formBlurDict = {
    "login-form": "login-form",
    "task-menu": "task-menu",
    "update-user-form": "update-user-form",
    "signup-form": "signup-form",
    "share-settings-form": "share-settings-form",
}

export async function formTransition(from, to) {
    await closeForm(from);
    openForm(to);
}

export function openForm(formBlurId) {
    ensureModalRecoveryListeners();

    document.querySelector(".profile-menu")?.classList.remove("active");
    document.querySelector(".extras-menu")?.classList.remove("active");

    // Close every other active modal instantly (hard reset), but never touch the target.
    document.querySelectorAll('.blur-bg').forEach(blurEl => {
        const blurId = blurEl.getAttribute('data-id');
        if (!blurId || blurId === formBlurId) return;

        if (blurEl.classList.contains('active') || blurEl.dataset.closing === "true") {
            hardResetBlurState(blurEl, blurId);
        }
    });

    const formBlur = document.querySelector(`[data-id='${formBlurId}']`);
    if (!formBlur) return;

    // Cancel any in-flight close timer for the target modal.
    const pendingCloseTimer = modalCloseTimers.get(formBlur);
    if (pendingCloseTimer) {
        clearTimeout(pendingCloseTimer);
        modalCloseTimers.delete(formBlur);
    }

    const isAlreadyActive = formBlur.classList.contains("active");
    const isClosing = formBlur.dataset.closing === "true";
    const formElement = formBlur.querySelector(`.${formBlurId}`);
    const panelOpacity = formElement ? Number(window.getComputedStyle(formElement).opacity) : 1;
    const isInvisibleGhost = panelOpacity < 0.05;

    // If the modal is already fully visible and healthy, just ensure scroll/overflow state.
    if (isAlreadyActive && !isClosing && !isInvisibleGhost) {
        formBlur.scrollTop = 0;
        formElement?.scrollTo?.(0, 0);
        document.body.style.overflowY = "hidden";
        return;
    }

    // Hard-reset the target to clear any stale animation state.
    hardResetBlurState(formBlur, formBlurId);
    void formBlur.offsetHeight; // force reflow so CSS transitions restart cleanly

    formBlur.dataset.animationToken = String(++modalAnimationToken);
    formBlur.dataset.closing = "false";
    formBlur.classList.add('active');
    formBlur.scrollTop = 0;
    document.body.style.overflowY = "hidden";

    if (!formElement) return;

    formElement.getAnimations().forEach(animation => animation.cancel());
    formElement.style.transform = "";
    formElement.style.opacity = "";
    formElement.style.top = "";
    formElement.scrollTop = 0;

    const openAnimation = formElement.animate(
        [
            { top: "6rem", opacity: 0.5 },
            { top: "3.5rem", opacity: 1 },
        ],
        { duration: 300, fill: "forwards" }
    );

    // After the animation completes, remove the inline top so CSS class takes over again.
    openAnimation.finished.then(() => {
        formElement.style.top = "";
        formElement.style.opacity = "";
    }).catch(() => {
        // Animation was cancelled — nothing to do.
    });
}

export function closeForm(formBlurId) {
    ensureModalRecoveryListeners();

    const fromForm = document.querySelector(`.blur-bg[data-id="${formBlurId}"]`);
    if (!fromForm) return Promise.resolve();

    if (!fromForm.classList.contains("active")) {
        const pendingCloseTimer = modalCloseTimers.get(fromForm);
        if (pendingCloseTimer) {
            clearTimeout(pendingCloseTimer);
            modalCloseTimers.delete(fromForm);
        }
        fromForm.classList.remove("active");
        fromForm.dataset.closing = "false";
        fromForm.dataset.closeStartedAt = "";
        return Promise.resolve();
    }

    if (fromForm.dataset.closing === "true") {
        return Promise.resolve();
    }

    const animationToken = String(++modalAnimationToken);
    fromForm.dataset.animationToken = animationToken;
    fromForm.dataset.closing = "true";
    fromForm.dataset.closeStartedAt = String(Date.now());

    const formElement = fromForm.querySelector(`.${formBlurId}`);
    const animations = [];
    let finalized = false;

    const finalizeClose = () => {
        if (finalized) return;
        finalized = true;

        const activeTimer = modalCloseTimers.get(fromForm);
        if (activeTimer) {
            clearTimeout(activeTimer);
            modalCloseTimers.delete(fromForm);
        }

        // If modal was reopened while close animation was running, ignore stale close completion.
        if (fromForm.dataset.animationToken !== animationToken) {
            return;
        }

        // Cancel all animations and wipe every inline style so the modal starts clean next open.
        fromForm.getAnimations().forEach(a => a.cancel());
        formElement?.getAnimations().forEach(a => a.cancel());

        fromForm.scrollTop = 0;
        if (formElement) {
            formElement.scrollTop = 0;
            formElement.style.transform = "";
            formElement.style.opacity = "";
            formElement.style.top = "";
        }
        fromForm.style.opacity = "";
        fromForm.classList.remove("active");
        fromForm.dataset.closing = "false";
        fromForm.dataset.closeStartedAt = "";
        if (!document.querySelector(".blur-bg.active")) {
            document.body.style.overflowY = "auto";
        }
    };

    animations.push(
        fromForm.animate(
            [
                { opacity: 1 },
                { opacity: 0 },
            ],
            {
                duration: 220,
                easing: "ease-in",
                fill: "forwards",
            }
        ).finished
    );

    if (formElement) {
        animations.push(
            formElement.animate(
                [
                    { transform: "translateY(0)", opacity: 1 },
                    { transform: "translateY(24px)", opacity: 0 },
                ],
                {
                    duration: 220,
                    easing: "ease-in",
                    fill: "forwards",
                }
            ).finished
        );
    }

    const closeTimeout = setTimeout(() => {
        finalizeClose();
    }, 300);
    modalCloseTimers.set(fromForm, closeTimeout);

    return Promise.allSettled(animations).finally(finalizeClose);
}

export function clearOpenedTaskFromUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("openedTask");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}
