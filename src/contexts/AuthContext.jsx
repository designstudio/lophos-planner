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

    function buildFallbackUser(sessionUser, profile = null) {
        if (!sessionUser) return null;

        return {
            uid: sessionUser.id,
            email: profile?.email ?? sessionUser.email ?? '',
            name:
                profile?.name ??
                sessionUser.user_metadata?.name ??
                sessionUser.email?.split('@')[0] ??
                'User',
            darkMode: profile?.darkMode ?? false,
        };
    }

    React.useEffect(() => {
        let mounted = true;

        async function bootstrapAuth() {
            const { data, error } = await supabase.auth.getSession();
            const sessionUser = data?.session?.user ?? null;

            console.log('[AUTH] bootstrap getSession', { sessionUserId: sessionUser?.id ?? null, error });

            if (!mounted) return;

            if (sessionUser) {
                // Libera a UI imediatamente com fallback
                const fallbackUser = buildFallbackUser(sessionUser);
                setCurrentUser(fallbackUser);
                localStorage.isLoggedIn = 'true';
                localStorage.theme = fallbackUser.darkMode ? 'dark' : 'light';

                // Tenta enriquecer com o perfil público sem bloquear a UI
                try {
                    const profile = await getCurrentUser(sessionUser.id);
                    console.log('[AUTH] bootstrap profile', profile);

                    if (!mounted) return;
                    if (profile) {
                        const mergedUser = buildFallbackUser(sessionUser, profile);
                        setCurrentUser(mergedUser);
                        localStorage.theme = mergedUser.darkMode ? 'dark' : 'light';
                    }
                } catch (err) {
                    console.error('[AUTH] bootstrap profile error', err);
                }
            } else {
                setCurrentUser(null);
                localStorage.isLoggedIn = 'false';
            }

            setIsAuthReady(true);
        }

        bootstrapAuth();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            const sessionUser = session?.user ?? null;
            console.log('[AUTH] onAuthStateChange', { event, sessionUserId: sessionUser?.id ?? null });

            if (sessionUser) {
                const fallbackUser = buildFallbackUser(sessionUser);
                if (!mounted) return;

                // Libera a UI já
                setCurrentUser(fallbackUser);
                localStorage.isLoggedIn = 'true';
                localStorage.theme = fallbackUser.darkMode ? 'dark' : 'light';

                // Tenta buscar perfil sem travar
                try {
                    const profile = await getCurrentUser(sessionUser.id);
                    console.log('[AUTH] fetched profile from onAuthStateChange', profile);

                    if (!mounted) return;
                    if (profile) {
                        const mergedUser = buildFallbackUser(sessionUser, profile);
                        setCurrentUser(mergedUser);
                        localStorage.theme = mergedUser.darkMode ? 'dark' : 'light';
                    }
                } catch (err) {
                    console.error('[AUTH] onAuthStateChange profile error', err);
                }
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

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { name },
                },
            });
            if (error) throw error;

            console.log('[AUTH] signup auth response', data);

            const sessionUser = data?.user;
            if (!sessionUser?.id) {
                return { type: 'error', errorMessage: 'User was created without a valid id.' };
            }

            // Tenta criar o perfil público, mas não bloqueia login
            try {
                await createUser(sessionUser.id, { email, name });
                console.log('[AUTH] profile row created');
            } catch (err) {
                console.error('[AUTH] createUser error', err);
            }

            const fallbackUser = buildFallbackUser(sessionUser, {
                email,
                name,
                darkMode: false,
            });

            setCurrentUser(fallbackUser);
            localStorage.isLoggedIn = 'true';
            localStorage.theme = 'light';

            return { type: 'success', data: fallbackUser };
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

            const sessionUser = data?.user;
            if (!sessionUser?.id) {
                return { type: 'error', errorMessage: 'Unable to retrieve authenticated user.' };
            }

            const fallbackUser = buildFallbackUser(sessionUser);
            setCurrentUser(fallbackUser);
            localStorage.isLoggedIn = 'true';
            localStorage.theme = fallbackUser.darkMode ? 'dark' : 'light';

            // Tenta enriquecer, mas não trava o login
            try {
                const profile = await getCurrentUser(sessionUser.id);
                console.log('[AUTH] profile after login', profile);

                if (profile) {
                    const mergedUser = buildFallbackUser(sessionUser, profile);
                    setCurrentUser(mergedUser);
                    localStorage.theme = mergedUser.darkMode ? 'dark' : 'light';
                    return { type: 'success', data: mergedUser };
                }
            } catch (err) {
                console.error('[AUTH] login profile enrichment error', err);
            }

            return { type: 'success', data: fallbackUser };
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

            setCurrentUser(prev => ({
                ...prev,
                email,
                name: data.name,
                darkMode: data.darkMode,
            }));

            localStorage.theme = data.darkMode ? 'dark' : 'light';
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

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
