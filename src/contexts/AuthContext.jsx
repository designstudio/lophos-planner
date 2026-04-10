import React, {useContext, useEffect, useState} from 'react';
import {auth, googleProvider} from "../scripts/firebase.js";
import {signInWithEmailAndPassword,
    signOut,
    updatePassword,
    updateEmail,
    sendPasswordResetEmail,
    createUserWithEmailAndPassword,
    signInWithPopup,
} from "firebase/auth"
import { createUser, getCurrentUser, updateUserData } from "../scripts/api.js";

const AuthContext = React.createContext();

export function useAuth() {
    return React.useContext(AuthContext);
}

function AuthProvider({ children }) {

    const [currentUser, setCurrentUser] = React.useState(null);

    React.useEffect(() => {
        return auth.onAuthStateChanged(async user => {
            setCurrentUser(await getCurrentUser(user.uid));
            localStorage.isLoggedIn = user ? "true" : "false";
            console.log(localStorage.isLoggedIn);
        })
    }, []);

    async function signup({ email, password, name }) {
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            localStorage.isLoggedIn = "true";
            return await createUser(auth.currentUser.uid, {email, name});
        } catch (err) {
            return {
                type: "error",
                errorMessage: err.message,
            };
        }
    }

    async function login(email, password) {
        try {
            localStorage.isLoggedIn = "true";
            return await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            return {
                type: "error",
                errorMessage: err.message,
            };
        }
    }

    async function googleSignIn() {
        try {
            const res = await signInWithPopup(auth, googleProvider);
            const {displayName:name, email, } = res.user;
            console.log(res.user);
            const user = await getCurrentUser(res.user.uid);
            localStorage.theme = user.darkMode ? "dark" : "light";
            return res.user;
        } catch (err) {
            return {
                type: "error",
                errorMessage: err.message,
            };
        }
    }

    async function googleSignUp() {
        try {
            const res = await signInWithPopup(auth, googleProvider);
            const {uid, displayName:name, email, } = res.user;
            console.log(uid, name, email);
            console.log(res.user);
            return await createUser(uid, {email, name});
        } catch (err) {
            return {
                type: "error",
                errorMessage: err.message,
            };
        }
    }

    async function logout() {
        await signOut(auth);
        localStorage.isLoggedIn = "false";
        localStorage.theme = "light";
        return window.location.reload();
    }

    async function updateUser(email, password, data) {
        try {
            if (email !== currentUser.email) {
                await updateEmail(auth.currentUser, email);
            }
            if (password && password !== currentUser.password) {
                await updatePassword(auth.currentUser, password);
            }
            await updateUserData(currentUser.uid, data);
            return setCurrentUser(await getCurrentUser(currentUser.uid));
        } catch(err) {
            return err.message;
        }
    }

    async function resetPassword(email) {
        try {
            await sendPasswordResetEmail(auth, email);
            return 'Check your inbox';
        } catch (err) {
            return err.message;
        }
    }

    const value = {
        currentUser,
        signup,
        login,
        googleSignIn,
        googleSignUp,
        logout,
        resetPassword,
        updateUser,
    }

    return (
        <AuthContext.Provider value={value}>
            { children }
        </AuthContext.Provider>
    );
}

export default AuthProvider;