import React from "react";

function getResolvedDuration(durationMs) {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return durationMs;
    }

    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : durationMs;
}

export default function useAnimatedPresence(isOpen, exitDurationMs = 140) {
    const [isMounted, setIsMounted] = React.useState(isOpen);
    const [isVisible, setIsVisible] = React.useState(isOpen);
    const resolvedExitDurationMs = getResolvedDuration(exitDurationMs);

    React.useEffect(() => {
        let frameId = null;
        let nestedFrameId = null;
        let timeoutId = null;

        if (isOpen) {
            setIsMounted(true);
            setIsVisible(false);

            frameId = window.requestAnimationFrame(() => {
                nestedFrameId = window.requestAnimationFrame(() => {
                    setIsVisible(true);
                });
            });
        } else if (isMounted) {
            setIsVisible(false);
            timeoutId = window.setTimeout(() => {
                setIsMounted(false);
            }, resolvedExitDurationMs);
        }

        return () => {
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }
            if (nestedFrameId !== null) {
                window.cancelAnimationFrame(nestedFrameId);
            }
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }
        };
    }, [isMounted, isOpen, resolvedExitDurationMs]);

    return { isMounted, isVisible };
}
