// Fallback anti-clickjacking when CSP frame-ancestors header cannot be configured.
(function () {
    try {
        if (window.top !== window.self) {
            window.top.location = window.self.location;
        }
    } catch (error) {
        document.documentElement.style.display = "none";
    }
})();
