import React from "react";

const MOBILE_MEDIA_QUERY = "(max-width: 1023px)";

export default function useIsMobileViewport() {
    const getMatches = React.useCallback(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
            return false;
        }

        return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
    }, []);

    const [isMobile, setIsMobile] = React.useState(getMatches);

    React.useEffect(() => {
        const matches = getMatches();
        setIsMobile(matches);

        if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
            return undefined;
        }

        const mediaQueryList = window.matchMedia(MOBILE_MEDIA_QUERY);
        const handleChange = event => setIsMobile(event.matches);

        if (typeof mediaQueryList.addEventListener === "function") {
            mediaQueryList.addEventListener("change", handleChange);
            return () => mediaQueryList.removeEventListener("change", handleChange);
        }

        mediaQueryList.addListener(handleChange);
        return () => mediaQueryList.removeListener(handleChange);
    }, [getMatches]);

    return isMobile;
}
