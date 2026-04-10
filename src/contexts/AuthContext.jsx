import React from 'react';
import { supabase } from '../scripts/supabase.js';
import { createUser, getCurrentUser, updateUserData } from '../scripts/api.js';

const AuthContext = React.createContext();

export function useAuth() {
    return React.useContext(AuthContext);
}

function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = React.useState(null);
    const [isAuthReady, setIsAuthReady] = React.useState(false);

    React.useEffect(() => {
        let mounted = true;

        async function bootstrapAuth() {
            const { data, error } = await supabase.auth.getSession();
            const sessionUserId = data?.session?.user?.id ?? null;

            console.log('[AUTH] bootstrap getSession', { sessionUserId, error });

            if (!mounted) return;

            if (sessionUserId) {
                const profile = await getCurrentUser(sessionUserId);
                console.log('[AUTH] bootstrap profile', profile);
                if (!mounted) return;

                setCurrentUser(profile);
                localStorage.isLoggedIn = 'true';
                localStorage.theme = profile?.darkMode ? 'dark' : 'light';
            } else {
                setCurrentUser(null);
                localStorage.isLoggedIn = 'false';
            }

            setIsAuthReady(true);
        }

        bootstrapAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('[AUTH] onAuthStateChange', { event, sessionUserId: session?.user?.id ?? null });

            if (session?.user) {
                const profile = await getCurrentUser(session.user.id);
                console.log('[AUTH] fetched profile from onAuthStateChange', profile);

                if (!mounted) return;
                setCurrentUser(profile);
                localStorage.isLoggedIn = 'true';
                localStorage.theme = profile?.darkMode ? 'dark' : 'light';
            } else {
                if (!mounted) return;
                setCurrentUser(null);
                localStorage.isLoggedIn = 'false';
            }

            if (mounted) setIsAuthReady(true);
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    async function signup({ email, password, name }) {
        try {
            console.log('[AUTH] signup start', { email, name });

            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;

            console.log('[AUTH] signup auth response', data);

            if (!data?.user?.id) {
                return { type: 'error', errorMessage: 'User was created without a valid id.' };
            }

            await createUser(data.user.id, { email, name });
            console.log('[AUTH] profile row created');

            const profile = await getCurrentUser(data.user.id);
            console.log('[AUTH] profile after signup', profile);

            setCurrentUser(profile);
            localStorage.isLoggedIn = 'true';
            localStorage.theme = profile?.darkMode ? 'dark' : 'light';

            return { type: 'success', data: profile };
        } catch (err) {
            console.error('[AUTH] signup error', err);

            let message = err.message;
            if (message === 'email rate limit exceeded') {
                message = 'Too many attempts in a short time. Please wait a few minutes and try again.';
            }

            return { type: 'error', errorMessage: message };
        }
    }

    async function login(email, password) {
        try {
            console.log('[AUTH] login start', { email });

            const result = await Promise.race([
                supabase.auth.signInWithPassword({ email, password }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Login timed out.')), 15000)
                ),
            ]);

            const { data, error } = result;
            if (error) throw error;

            console.log('[AUTH] login auth response', data);

            const userId = data?.user?.id;
            if (!userId) {
                return { type: 'error', errorMessage: 'Unable to retrieve authenticated user.' };
            }

            const profile = await getCurrentUser(userId);
            console.log('[AUTH] profile after login', profile);

            if (!profile) {
                return { type: 'error', errorMessage: 'User profile was not found.' };
            }

            setCurrentUser(profile);
            localStorage.isLoggedIn = 'true';
            localStorage.theme = profile.darkMode ? 'dark' : 'light';

            return { type: 'success', data: profile };
        } catch (err) {
            console.error('[AUTH] login error', err);
            return { type: 'error', errorMessage: err.message };
        }
    }

    async function logout() {
        console.log('[AUTH] logout');
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
            console.log('[AUTH] updated profile', updatedProfile);

            setCurrentUser(updatedProfile);
            localStorage.theme = updatedProfile?.darkMode ? 'dark' : 'light';
        } catch (err) {
            console.error('[AUTH] update user error', err);
            return err.message;
        }
    }

    async function resetPassword(email) {
        try {
            console.log('[AUTH] reset password start', { email });
            const { error } = await supabase.auth.resetPasswordForEmail(email);
            if (error) throw error;
            return 'Check your inbox';
        } catch (err) {
            console.error('[AUTH] reset password error', err);
            return err.message;
        }
    }

    const value = {
        currentUser,
        isAuthReady,
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
