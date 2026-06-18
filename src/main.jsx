import React from 'react';
import ReactDOM from 'react-dom/client';
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import './styles/tokens.css';
import './index.css';
import { BrowserRouter, Route, Routes, createBrowserRouter, createRoutesFromElements, RouterProvider } from 'react-router-dom';
import AuthProvider, { useAuth } from "./contexts/AuthContext";
import TaskMenuContext from "./contexts/TaskMenuContext";
import { signUpAction } from "./components/forms/signUpAction.js";
import { resetPasswordAction } from "./components/forms/resetPasswordAction.js";
import { updateUserAction } from "./components/forms/updateUserAction.js";
import Error from "./components/Error.jsx";
import LoadingIndicator from "./components/LoadingIndicator.jsx";

const HomePage = React.lazy(() => import("./HomePage"));
const NotFound = React.lazy(() => import("./components/NotFound"));
const PublicSharePage = React.lazy(() => import("./PublicSharePage.jsx"));

function LazyPage({ children }) {
    return (
        <React.Suspense
            fallback={(
                <div className="min-h-screen bg-ds-background-page flex items-center justify-center">
                    <LoadingIndicator size={72} />
                </div>
            )}
        >
            {children}
        </React.Suspense>
    );
}

function App() {
    const authContext = useAuth();

    React.useEffect(() => {
        const root = document.documentElement;
        const themeColor = getComputedStyle(root).getPropertyValue("--color-bg-page").trim();
        if (!themeColor) return;

        let meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement("meta");
            meta.setAttribute("name", "theme-color");
            document.head.appendChild(meta);
        }

        meta.setAttribute("content", themeColor);
    }, []);

    const router = createBrowserRouter(createRoutesFromElements(
        <>
            <Route
                path="/"
                element={<HomePage />}
                errorElement={<Error />}
            />
            <Route
                path="/share/:shareToken"
                element={<LazyPage><PublicSharePage /></LazyPage>}
                errorElement={<Error />}
            />
            <Route
                path="/reset-password"
                element={<HomePage />}
                action={resetPasswordAction(authContext)}
            />
            <Route path="/signup" action={signUpAction(authContext)} />
            <Route path="/update-user" action={updateUserAction(authContext)} />
            <Route path="*" element={<LazyPage><NotFound /></LazyPage>} />
        </>
    ));

    return <RouterProvider router={router} />;
}

function PublicShareDebugPage() {
    return (
        <main className="min-h-screen bg-white px-6 py-8 text-ds-text-default dark:bg-ds-background-page">
            <h1 className="ds-type-h3 text-ds-text-default">Share debug</h1>
            <p className="mt-3 ds-type-body-sm text-ds-text-default">PublicSharePage mounted</p>
        </main>
    );
}

function PublicShareApp() {
    const isDebugStatic = typeof window !== "undefined"
        && new URLSearchParams(window.location.search).get("debugStatic") === "1";
    const shareElement = isDebugStatic
        ? <PublicShareDebugPage />
        : <LazyPage><PublicSharePage /></LazyPage>;

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/share/:shareToken" element={shareElement} />
                <Route path="*" element={<LazyPage><NotFound /></LazyPage>} />
            </Routes>
        </BrowserRouter>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
const isPublicShareRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/share/");

if (isPublicShareRoute) {
    root.render(<PublicShareApp />);
} else {
    root.render(
        <AuthProvider>
            <TaskMenuContext>
                <App />
            </TaskMenuContext>
        </AuthProvider>
    );
}
