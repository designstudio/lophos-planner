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
import BrandedLoadingIndicator from "./components/BrandedLoadingIndicator.jsx";
import PublicSharePage from "./PublicSharePage.jsx";

const HomePage = React.lazy(() => import("./HomePage"));
const NotFound = React.lazy(() => import("./components/NotFound"));

function LazyPage({ children }) {
    return (
        <React.Suspense
            fallback={(
                <div className="min-h-screen bg-ds-background-page flex items-center justify-center">
                    <BrandedLoadingIndicator size={72} />
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
                element={<PublicSharePage />}
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

function PublicShareApp() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/share/:shareToken" element={<PublicSharePage />} />
                <Route path="*" element={<LazyPage><NotFound /></LazyPage>} />
            </Routes>
        </BrowserRouter>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
const isPublicShareRoute = typeof window !== "undefined" && /^\/share\/[^/]+/.test(window.location.pathname);

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
