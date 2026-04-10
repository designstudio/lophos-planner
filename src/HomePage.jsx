import React, {useEffect, useState} from 'react'
import Header from './components/Header'
import TaskListContainer from './components/tasks/TaskListContainer'
import LoginForm from "./components/forms/LoginForm";
import SignUpForm from "./components/forms/SignUpForm";
import UpdateUserForm from "./components/forms/UpdateUserForm";
import {useAuth} from "./contexts/AuthContext";
import ResetPasswordForm from "./components/forms/ResetPasswordForm";
import InvitePage from "./components/InvitePage";
import TaskMenu from "./components/tasks/TaskMenu";
import SearchTaskForm from "./components/forms/SearchTaskForm.jsx";

function HomePage() {

    const { currentUser } = useAuth();
    useEffect(() => {
        if (localStorage.theme === 'dark' || currentUser?.darkMode) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }, [localStorage.theme]);

    return (
        <div className="min-w-screen min-h-screen bg-white dark:bg-black">
            <main className="max-container">
                <TaskListContainer/>
                <LoginForm/>
                <SearchTaskForm/>
                <SignUpForm/>
                <UpdateUserForm/>
                <ResetPasswordForm/>
                <TaskMenu/>
                <InvitePage />
            </main>
        </div>

    )
}

export default HomePage
