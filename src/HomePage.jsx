import React, { useEffect } from 'react';
import TaskListContainer from './components/tasks/TaskListContainer';
import LoginForm from "./components/forms/LoginForm";
import SignUpForm from "./components/forms/SignUpForm";
import UpdateUserForm from "./components/forms/UpdateUserForm";
import ShareSettingsForm from "./components/forms/ShareSettingsForm.jsx";
import InviteCollaboratorForm from "./components/forms/InviteCollaboratorForm.jsx";
import CreateAgendaForm from "./components/forms/CreateAgendaForm.jsx";
import { useAuth } from "./contexts/AuthContext";
import ResetPasswordForm from "./components/forms/ResetPasswordForm";
import InvitePage from "./components/InvitePage";
import TaskMenu from "./components/tasks/TaskMenu";
import SearchTaskForm from "./components/forms/SearchTaskForm.jsx";
import Header from "./components/Header";
import { getAppLanguage, getLocale } from "./scripts/i18n.js";
import { openForm } from "./scripts/utils.js";

function HomePage() {
    const { currentUser, agendas, isAuthReady, pendingAgendaInviteToken } = useAuth();
    const language = getAppLanguage(currentUser?.language);
    const currentAgenda = agendas.find(agenda => String(agenda.id) === String(currentUser?.currentAgendaId));

    useEffect(() => {
        if (currentUser?.darkMode || localStorage.theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [currentUser]);

    useEffect(() => {
        document.documentElement.lang = getLocale(language);
    }, [language]);

    useEffect(() => {
        const baseTitle = "Lophos Planner";
        const agendaName = (currentAgenda?.name || "").trim();
        document.title = agendaName ? `${agendaName} - ${baseTitle}` : baseTitle;
    }, [currentAgenda?.name]);

    useEffect(() => {
        const accent = currentAgenda?.color || '#3b82f6';
        document.documentElement.style.setProperty('--agenda-accent', accent);

        const soft = /^#([0-9a-fA-F]{6})$/.test(accent)
            ? `${accent}22`
            : 'rgba(59, 130, 246, 0.2)';
        document.documentElement.style.setProperty('--agenda-accent-soft', soft);
    }, [currentAgenda?.id, currentAgenda?.color]);

    useEffect(() => {
        if (!isAuthReady) return;

        const loginBlur = document.querySelector('[data-id="login-form"]');
        const signupBlur = document.querySelector('[data-id="signup-form"]');
        const resetBlur = document.querySelector('[data-id="reset-password-form"]');

        if (currentUser) {
            loginBlur?.classList.remove('active');
            signupBlur?.classList.remove('active');
            resetBlur?.classList.remove('active');
            document.body.style.overflowY = 'auto';
        } else {
            if (pendingAgendaInviteToken) {
                openForm("login-form");
            } else {
                loginBlur?.classList.add('active');
            }
        }
    }, [currentUser, isAuthReady, pendingAgendaInviteToken]);

    if (!isAuthReady) {
        return (
            <div className="min-w-screen min-h-screen bg-white dark:bg-black">
                <main className="max-container">
                    <LoginForm />
                    <SignUpForm />
                    <ResetPasswordForm />
                </main>
            </div>
        );
    }

    return (
        <div className="min-w-screen min-h-screen bg-white dark:bg-black">
            <main className="max-container">
                <Header />
                {currentUser ? (
                    <>
                        <TaskListContainer />
                        <SearchTaskForm />
                        <UpdateUserForm />
                        <CreateAgendaForm />
                        <ShareSettingsForm />
                        <InviteCollaboratorForm />
                        <ResetPasswordForm />
                        <TaskMenu />
                    </>
                ) : (
                    <>
                        <LoginForm />
                        <SignUpForm />
                        <ResetPasswordForm />
                    </>
                )}
                <InvitePage />
            </main>
        </div>
    );
}

export default HomePage;
