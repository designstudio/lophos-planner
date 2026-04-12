import React from 'react';
import ReactDOM from 'react-dom/client';
import HomePage from './HomePage';
import NotFound from "./components/NotFound";
import './index.css';
import { Route, createBrowserRouter, createRoutesFromElements, RouterProvider } from 'react-router-dom';
import AuthProvider, { useAuth } from "./contexts/AuthContext";
import TaskMenuContext from "./contexts/TaskMenuContext";
import { action as signupAction } from "./components/forms/SignUpForm";
import { action as resetPasswordAction } from "./components/forms/ResetPasswordForm";
import { action as updateUserAction } from "./components/forms/UpdateUserForm";
import Error from "./components/Error.jsx";
import PublicSharePage from "./PublicSharePage.jsx";

function App() {
    const authContext = useAuth();

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
            <Route path="/signup" action={signupAction(authContext)} />
            <Route path="/reset-password" action={resetPasswordAction(authContext)} />
            <Route path="/update-user" action={updateUserAction(authContext)} />
            <Route path="*" element={<NotFound />} />
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
