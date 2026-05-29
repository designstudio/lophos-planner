import React, { Suspense, useEffect } from 'react';
import Lottie from "lottie-react";
import todoLoadingAnimation from "./assets/todo-loading.json";
import { useAuth } from "./contexts/AuthContext";
import Header from "./components/Header";
import { getAppLanguage, getLocale } from "./scripts/i18n.js";
import { closeForm, openForm } from "./scripts/utils.js";

const TaskListContainer = React.lazy(() => import("./components/tasks/TaskListContainer"));
const BoardViewContainer = React.lazy(() => import("./components/tasks/BoardViewContainer.jsx"));
const LoginForm = React.lazy(() => import("./components/forms/LoginForm"));
const SignUpForm = React.lazy(() => import("./components/forms/SignUpForm"));
const UpdateUserForm = React.lazy(() => import("./components/forms/UpdateUserForm"));
const ShareSettingsForm = React.lazy(() => import("./components/forms/ShareSettingsForm.jsx"));
const InviteCollaboratorForm = React.lazy(() => import("./components/forms/InviteCollaboratorForm.jsx"));
const CreateAgendaForm = React.lazy(() => import("./components/forms/CreateAgendaForm.jsx"));
const StatusGeneratorForm = React.lazy(() => import("./components/forms/StatusGeneratorForm.jsx"));
const ResetPasswordForm = React.lazy(() => import("./components/forms/ResetPasswordForm"));
const InvitePage = React.lazy(() => import("./components/InvitePage"));
const TaskMenu = React.lazy(() => import("./components/tasks/TaskMenu"));
const SearchTaskForm = React.lazy(() => import("./components/forms/SearchTaskForm.jsx"));

function AppLoadingScreen({ fixed = false }) {
    return (
        <div className={`${fixed ? "fixed inset-0 z-50" : "min-w-screen min-h-screen"} bg-white dark:bg-black`}>
            <div className="flex min-h-screen items-center justify-center">
                <Lottie animationData={todoLoadingAnimation} loop style={{ width: 84, height: 84 }} />
            </div>
        </div>
    );
}

function SurfaceFallback() {
    return <AppLoadingScreen fixed />;
}

function HomePage() {
    const { currentUser, agendas, isAuthReady, pendingAgendaInviteToken, isPasswordRecovery } = useAuth();
    const [isAboutOpen, setIsAboutOpen] = React.useState(false);
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
        const accent = currentAgenda?.color || 'var(--color-brand-accent)';
        document.documentElement.style.setProperty('--agenda-accent', accent);

        const soft = /^#([0-9a-fA-F]{6})$/.test(accent)
            ? `${accent}22`
            : 'var(--color-brand-accent-subtle)';
        document.documentElement.style.setProperty('--agenda-accent-soft', soft);
    }, [currentAgenda?.id, currentAgenda?.color]);

    useEffect(() => {
        if (!isAuthReady) return;

        if (isPasswordRecovery && currentUser) {
            closeForm("login-form");
            closeForm("signup-form");
            closeForm("reset-password-form");
            openForm("update-user-form");
        } else if (currentUser) {
            closeForm("login-form");
            closeForm("signup-form");
            closeForm("reset-password-form");
        } else {
            if (pendingAgendaInviteToken) {
                openForm("signup-form");
            } else {
                openForm("login-form");
            }
        }
    }, [currentUser, isAuthReady, pendingAgendaInviteToken, isPasswordRecovery]);

    if (!isAuthReady) {
        return <AppLoadingScreen />;
    }

    return (
        <div className="min-w-screen min-h-screen bg-white dark:bg-black">
            <main className="max-container">
                <Header onOpenAbout={() => setIsAboutOpen(true)} />
                <Suspense fallback={<SurfaceFallback />}>
                    {currentUser ? (
                        <>
                            <TaskListContainer />
                            <BoardViewContainer />
                            <SearchTaskForm />
                            <UpdateUserForm recoveryMode={isPasswordRecovery} />
                            <CreateAgendaForm />
                            <StatusGeneratorForm />
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
                    <InvitePage
                        isOpen={isAboutOpen}
                        onClose={() => setIsAboutOpen(false)}
                    />
                </Suspense>
            </main>
        </div>
    );
}

export default HomePage;
