import React, { useEffect } from 'react';
import Header from './components/Header';
import TaskListContainer from './components/tasks/TaskListContainer';
import LoginForm from "./components/forms/LoginForm";
import SignUpForm from "./components/forms/SignUpForm";
import UpdateUserForm from "./components/forms/UpdateUserForm";
import { useAuth } from "./contexts/AuthContext";
import ResetPasswordForm from "./components/forms/ResetPasswordForm";
import InvitePage from "./components/InvitePage";
import TaskMenu from "./components/tasks/TaskMenu";
import SearchTaskForm from "./components/forms/SearchTaskForm.jsx";

function HomePage() {
    const { currentUser } = useAuth();

    useEffect(() => {
        if (currentUser?.darkMode || localStorage.theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [currentUser]);

    useEffect(() => {
        const loginBlur = document.querySelector('[data-id="login-form"]');
        const signupBlur = document.querySelector('[data-id="signup-form"]');
        const resetBlur = document.querySelector('[data-id="reset-password-form"]');

        if (currentUser) {
            loginBlur?.classList.remove('active');
            signupBlur?.classList.remove('active');
            resetBlur?.classList.remove('active');
            document.body.style.overflowY = 'auto';
        } else {
            loginBlur?.classList.add('active');
        }
    }, [currentUser]);

    return (
        <div className="min-w-screen min-h-screen bg-white dark:bg-black">
            <main className="max-container">
                {currentUser ? (
                    <>
                        <TaskListContainer />
                        <SearchTaskForm />
                        <UpdateUserForm />
                        <ResetPasswordForm />
                        <TaskMenu />
                        <InvitePage />
                    </>
                ) : (
                    <>
                        <LoginForm />
                        <SignUpForm />
                        <ResetPasswordForm />
                    </>
                )}
            </main>
        </div>
    );
}

export default HomePage;
