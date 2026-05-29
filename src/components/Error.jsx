import React from "react";
import { Link, useRouteError } from "react-router-dom";
import { getAppLanguage, t } from "../scripts/i18n.js";

export default function Error() {
    const error = useRouteError();
    const language = getAppLanguage();
    const errorTitle = error?.statusText || error?.message || "Unexpected error";
    const errorCode = error?.status || "500";

    return (
        <main className="ds-surface-page min-h-screen px-6 py-10">
            <div className="ds-surface-card mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl flex-col justify-center rounded-ds-2xl px-6 py-8 sm:px-10 sm:py-10">
                <p className="ds-type-caption uppercase text-ds-text-subtle" style={{ letterSpacing: "0.18em" }}>{errorCode}</p>
                <h1 className="ds-type-h1 mt-4 max-w-[16ch] sm:ds-type-display">
                    {t(language, "errorPageTitle")}
                </h1>
                <p className="ds-type-body mt-4 max-w-2xl text-ds-text-muted">
                    {t(language, "errorPageDescription")}
                </p>
                <div className="mt-6 rounded-ds-xl border border-ds-border-default bg-ds-background-surface-muted px-4 py-4">
                    <p className="ds-type-label">{errorTitle}</p>
                </div>
                <div className="mt-8">
                    <Link
                        to="/"
                        className="ds-button-primary ds-type-button inline-flex h-12 items-center justify-center px-6 transition-opacity duration-150"
                    >
                        {t(language, "goHome")}
                    </Link>
                </div>
            </div>
        </main>
    );
}
