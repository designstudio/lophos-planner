import React from 'react';
import { supabase } from '../scripts/supabase.js';
import { createUser, getCurrentUser, updateUserData } from '../scripts/api.js';

const AuthContext = React.createContext();

export function useAuth() {
    return React.useContext(AuthContext);
}

function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = React.useState(null);

    React.useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                const profile = await getCurrentUser(session.user.id);
                setCurrentUser(profile);
                localStorage.isLoggedIn = 'true';
                localStorage.theme = profile?.darkMode ? 'dark' : 'light';
            } else {
                setCurrentUser(null);
                localStorage.isLoggedIn = 'false';
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    async function signup({ email, password, name }) {
        try {
            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;

            if (!data?.user?.id) {
                return { type: 'error', errorMessage: 'User was created without a valid id.' };
            }

            await createUser(data.user.id, { email, name });

            const profile = await getCurrentUser(data.user.id);
            setCurrentUser(profile);
            localStorage.isLoggedIn = 'true';
            localStorage.theme = profile?.darkMode ? 'dark' : 'light';

            return { type: 'success', data: profile };
        } catch (err) {
            let message = err.message;

            if (message === 'email rate limit exceeded') {
                message = 'Too many attempts in a short time. Please wait a few minutes and try again.';
            }

            return { type: 'error', errorMessage: message };
        }
    }

    async function login(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;

            const userId = data?.user?.id;
            if (!userId) {
                return { type: 'error', errorMessage: 'Unable to retrieve authenticated user.' };
            }

            const profile = await getCurrentUser(userId);
            if (!profile) {
                return { type: 'error', errorMessage: 'User profile was not found.' };
            }

            setCurrentUser(profile);
            localStorage.isLoggedIn = 'true';
            localStorage.theme = profile.darkMode ? 'dark' : 'light';

            return { type: 'success', data: profile };
        } catch (err) {
            return { type: 'error', errorMessage: err.message };
        }
    }

    async function logout() {
        await supabase.auth.signOut();
        setCurrentUser(null);
        localStorage.isLoggedIn = 'false';
        localStorage.theme = 'light';
        return window.location.reload();
    }

    async function updateUser(email, password, data) {
        try {
            const updates = {};
            if (email !== currentUser.email) updates.email = email;
            if (password) updates.password = password;

            if (Object.keys(updates).length > 0) {
                const { error } = await supabase.auth.updateUser(updates);
                if (error) throw error;
            }

            await updateUserData(currentUser.uid, data);
            const updatedProfile = await getCurrentUser(currentUser.uid);
            setCurrentUser(updatedProfile);
            localStorage.theme = updatedProfile?.darkMode ? 'dark' : 'light';
        } catch (err) {
            return err.message;
        }
    }

    async function resetPassword(email) {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email);
            if (error) throw error;
            return 'Check your inbox';
        } catch (err) {
            return err.message;
        }
    }

    const value = {
        currentUser,
        signup,
        login,
        logout,
        resetPassword,
        updateUser,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export default AuthProvider;
