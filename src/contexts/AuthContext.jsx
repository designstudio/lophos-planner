import React from 'react';
import { supabase } from '../scripts/supabase.js';
import {
    createUser,
    getCurrentUser,
    updateUserData,
    deleteCurrentAccount,
    ensureDefaultAgenda,
    createAgenda as createAgendaApi,
    updateAgendaName as updateAgendaNameApi,
    setUserCurrentAgenda,
    deleteAgenda as deleteAgendaApi,
} from '../scripts/api.js';

const AuthContext = React.createContext();

export function useAuth() {
    return React.useContext(AuthContext);
}

function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = React.useState(null);
    const [agendas, setAgendas] = React.useState([]);
    const [isAuthReady, setIsAuthReady] = React.useState(false);
    const loadedProfileIdRef = React.useRef(null);
    const signOutTimerRef = React.useRef(null);

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
            language: profile?.language ?? 'ptBR',
            dateFormat: profile?.dateFormat ?? 'DD-MM',
            weekStartsOn: profile?.weekStartsOn ?? 'Monday',
            currentAgendaId: profile?.currentAgendaId ?? null,
        };
    }

    React.useEffect(() => {
        let mounted = true;

        async function bootstrapAuth() {
            const { data, error } = await supabase.auth.getSession();
            const sessionUser = data?.session?.user ?? null;

            if (!mounted) return;

            if (sessionUser) {
                // Libera a UI imediatamente com fallback
                const fallbackUser = buildFallbackUser(sessionUser);
                setCurrentUser(fallbackUser);
                localStorage.isLoggedIn = 'true';
                localStorage.theme = fallbackUser.darkMode ? 'dark' : 'light';
                localStorage.language = fallbackUser.language;

                // Tenta enriquecer com o perfil público sem bloquear a UI
                try {
                    const profile = await getCurrentUser(sessionUser.id);

                    if (!mounted) return;
                    if (profile) {
                        const ensured = await ensureDefaultAgenda(sessionUser.id, profile.currentAgendaId);
                        const mergedUser = buildFallbackUser(sessionUser, profile);
                        mergedUser.currentAgendaId = ensured.currentAgendaId;
                        setCurrentUser(mergedUser);
                        setAgendas(ensured.agendas);
                        localStorage.theme = mergedUser.darkMode ? 'dark' : 'light';
                        localStorage.language = mergedUser.language;
                    }
                } catch (err) {
                    console.error('[AUTH] bootstrap profile error', err);
                }
            } else {
                setCurrentUser(null);
                setAgendas([]);
                localStorage.isLoggedIn = 'false';
            }

            setIsAuthReady(true);
        }

        bootstrapAuth();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            const sessionUser = session?.user ?? null;

            if (sessionUser) {
                if (!mounted) return;

                // Cancela sign-out pendente (Supabase v2 às vezes dispara SIGNED_OUT + SIGNED_IN no refresh de token)
                if (signOutTimerRef.current) {
                    clearTimeout(signOutTimerRef.current);
                    signOutTimerRef.current = null;
                }

                if (loadedProfileIdRef.current === sessionUser.id) {
                    setIsAuthReady(true);
                    return;
                }

                loadedProfileIdRef.current = sessionUser.id;

                const fallbackUser = buildFallbackUser(sessionUser);
                setCurrentUser(fallbackUser);
                localStorage.isLoggedIn = 'true';
                localStorage.theme = fallbackUser.darkMode ? 'dark' : 'light';
                localStorage.language = fallbackUser.language;
                setIsAuthReady(true);
                // Fetch de perfil não feito aqui — bootstrapAuth e login() já cuidam disso
            } else {
                if (!mounted) return;
                // Debounce: evita limpar o estado durante refresh de token (SIGNED_OUT seguido de SIGNED_IN)
                signOutTimerRef.current = setTimeout(() => {
                    if (!mounted) return;
                    loadedProfileIdRef.current = null;
                    setCurrentUser(null);
                    setAgendas([]);
                    localStorage.isLoggedIn = 'false';
                    setIsAuthReady(true);
                    signOutTimerRef.current = null;
                }, 500);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
            if (signOutTimerRef.current) clearTimeout(signOutTimerRef.current);
        };
    }, []);

    async function signup({ email, password, name }) {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { name },
                },
            });
            if (error) throw error;

            const sessionUser = data?.user;
            if (!sessionUser?.id) {
                return { type: 'error', errorMessage: 'User was created without a valid id.' };
            }

            // Tenta criar o perfil público, mas não bloqueia login
            try {
                await createUser(sessionUser.id, { email, name });
            } catch (err) {
                console.error('[AUTH] createUser error', err);
            }

            const fallbackUser = buildFallbackUser(sessionUser, {
                email,
                name,
                darkMode: false,
                language: 'ptBR',
                dateFormat: 'DD-MM',
                weekStartsOn: 'Monday',
                currentAgendaId: null,
            });

            const ensured = await ensureDefaultAgenda(sessionUser.id, fallbackUser.currentAgendaId);
            fallbackUser.currentAgendaId = ensured.currentAgendaId;

            setCurrentUser(fallbackUser);
            setAgendas(ensured.agendas);
            localStorage.isLoggedIn = 'true';
            localStorage.theme = 'light';
            localStorage.language = fallbackUser.language;

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
            const result = await Promise.race([
                supabase.auth.signInWithPassword({ email, password }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Login timed out.')), 15000)
                ),
            ]);

            const { data, error } = result;
            if (error) throw error;

            const sessionUser = data?.user;
            if (!sessionUser?.id) {
                return { type: 'error', errorMessage: 'Unable to retrieve authenticated user.' };
            }

            const fallbackUser = buildFallbackUser(sessionUser);

            const ensured = await ensureDefaultAgenda(sessionUser.id, fallbackUser.currentAgendaId);
            fallbackUser.currentAgendaId = ensured.currentAgendaId;

            setCurrentUser(fallbackUser);
            setAgendas(ensured.agendas);
            localStorage.isLoggedIn = 'true';
            localStorage.theme = fallbackUser.darkMode ? 'dark' : 'light';
            localStorage.language = fallbackUser.language;

            // Tenta enriquecer, mas não trava o login
            try {
                const profile = await getCurrentUser(sessionUser.id);

                if (profile) {
                    const ensuredFromProfile = await ensureDefaultAgenda(sessionUser.id, profile.currentAgendaId);
                    const mergedUser = buildFallbackUser(sessionUser, profile);
                    mergedUser.currentAgendaId = ensuredFromProfile.currentAgendaId;
                    setCurrentUser(mergedUser);
                    setAgendas(ensuredFromProfile.agendas);
                    localStorage.theme = mergedUser.darkMode ? 'dark' : 'light';
                    localStorage.language = mergedUser.language;
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
        await supabase.auth.signOut();
        setCurrentUser(null);
        setAgendas([]);
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
                language: data.language,
                dateFormat: data.dateFormat,
                weekStartsOn: data.weekStartsOn,
            }));

            localStorage.theme = data.darkMode ? 'dark' : 'light';
            localStorage.language = data.language;
        } catch (err) {
            console.error('[AUTH] update user error', err);
            return err.message;
        }
    }

    async function resetPassword(email) {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email);
            if (error) throw error;
            return 'Check your inbox';
        } catch (err) {
            console.error('[AUTH] reset password error', err);
            return err.message;
        }
    }

    async function deleteAccount() {
        try {
            if (!currentUser?.uid) {
                return { type: 'error', errorMessage: 'User session not found.' };
            }

            await deleteCurrentAccount(currentUser.uid);
            await supabase.auth.signOut();

            setCurrentUser(null);
            setAgendas([]);
            localStorage.isLoggedIn = 'false';
            localStorage.theme = 'light';
            localStorage.language = 'ptBR';

            window.location.href = '/';
            return { type: 'success' };
        } catch (err) {
            console.error('[AUTH] delete account error', err);
            return { type: 'error', errorMessage: err.message || 'Unable to delete account.' };
        }
    }

    async function createAgenda(name, avatar = "", color = "#3b82f6") {
        if (!currentUser?.uid) {
            return { type: 'error', errorMessage: 'User session not found.' };
        }

        try {
            const agenda = await createAgendaApi(currentUser.uid, name, { setAsCurrent: true, avatar, color });
            const nextAgendas = [...agendas, agenda];
            setAgendas(nextAgendas);
            setCurrentUser(prev => ({
                ...prev,
                currentAgendaId: agenda.id,
            }));
            return { type: 'success', data: agenda };
        } catch (err) {
            return { type: 'error', errorMessage: err.message || 'Unable to create agenda.' };
        }
    }

    async function switchAgenda(agendaId) {
        if (!currentUser?.uid || !agendaId) return;
        await setUserCurrentAgenda(currentUser.uid, agendaId);
        setCurrentUser(prev => ({
            ...prev,
            currentAgendaId: agendaId,
        }));
    }

    async function renameAgenda(agendaId, name, avatar = "", color = "#3b82f6", sortCompletedTasks = null) {
        if (!currentUser?.uid || !agendaId) {
            return { type: 'error', errorMessage: 'Agenda not found.' };
        }

        try {
            const updated = await updateAgendaNameApi(currentUser.uid, agendaId, name, avatar, color, sortCompletedTasks);
            setAgendas(prev => prev.map(agenda => (
                String(agenda.id) === String(updated.id) ? updated : agenda
            )));
            return { type: 'success', data: updated };
        } catch (err) {
            return { type: 'error', errorMessage: err.message || 'Unable to update agenda name.' };
        }
    }

    async function deleteAgenda(agendaId) {
        if (!currentUser?.uid || !agendaId) {
            return { type: 'error', errorMessage: 'Agenda not found.' };
        }

        try {
            const data = await deleteAgendaApi(currentUser.uid, agendaId);
            setAgendas(data.agendas || []);
            setCurrentUser(prev => ({
                ...prev,
                currentAgendaId: data.currentAgendaId,
            }));
            return { type: 'success', data };
        } catch (err) {
            return { type: 'error', errorMessage: err.message || 'Unable to delete agenda.' };
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
        deleteAccount,
        agendas,
        createAgenda,
        switchAgenda,
        renameAgenda,
        deleteAgenda,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
