import React from 'react';
import ReactDOM from 'react-dom/client';
import HomePage from './HomePage';
import './styles/tokens.css';
import './index.css';
import { Route, createBrowserRouter, createRoutesFromElements, RouterProvider } from 'react-router-dom';
import AuthProvider, { useAuth } from "./contexts/AuthContext";
import TaskMenuContext from "./contexts/TaskMenuContext";
import { signUpAction } from "./components/forms/signUpAction.js";
import { resetPasswordAction } from "./components/forms/resetPasswordAction.js";
import { updateUserAction } from "./components/forms/updateUserAction.js";
import Error from "./components/Error.jsx";

const NotFound = React.lazy(() => import("./components/NotFound"));
const PublicSharePage = React.lazy(() => import("./PublicSharePage.jsx"));

function LazyPage({ children }) {
    return <React.Suspense fallback={null}>{children}</React.Suspense>;
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

ReactDOM.createRoot(document.getElementById('root')).render(
    <AuthProvider>
        <TaskMenuContext>
            <App />
        </TaskMenuContext>
    </AuthProvider>
);
