import React from 'react';
import { supabase } from '../scripts/supabase.js';
import { detectBrowserLanguage } from '../scripts/i18n.js';
import {
    createUser,
    getCurrentUser,
    getUserAgendas,
    updateUserData,
    deleteCurrentAccount,
    ensureDefaultAgenda,
    createAgenda as createAgendaApi,
    acceptAgendaInvite as acceptAgendaInviteApi,
    getAgendaInviteDetails as getAgendaInviteDetailsApi,
    updateAgendaName as updateAgendaNameApi,
    setUserCurrentAgenda,
    setUserDefaultAgenda,
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
    const [isPasswordRecovery, setIsPasswordRecovery] = React.useState(false);
    const [appLanguage, setAppLanguage] = React.useState(() => (
        (typeof localStorage !== 'undefined' && localStorage.language) || detectBrowserLanguage()
    ));
    const [pendingAgendaInviteToken, setPendingAgendaInviteTokenState] = React.useState(() => (
        (typeof localStorage !== 'undefined' && localStorage.getItem('pendingAgendaInviteToken')) || null
    ));
    const [pendingAgendaInviteEmail, setPendingAgendaInviteEmailState] = React.useState(() => (
        (typeof localStorage !== 'undefined' && localStorage.getItem('pendingAgendaInviteEmail')) || null
    ));
    const loadedProfileIdRef = React.useRef(null);
    const signOutTimerRef = React.useRef(null);
    const isBootstrappingRef = React.useRef(true);

    function stripAuthParamsFromUrl() {
        if (typeof window === 'undefined') return;

        const url = new URL(window.location.href);
        const authParams = ['code', 'state', 'error', 'error_code', 'error_description'];
        let changed = false;

        for (const param of authParams) {
            if (url.searchParams.has(param)) {
                url.searchParams.delete(param);
                changed = true;
            }
        }

        if (!changed) return;

        const nextSearch = url.searchParams.toString();
        const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
        window.history.replaceState({}, document.title, nextUrl);
    }

    function getStoredDefaultAgendaId(userId) {
        if (!userId || typeof localStorage === 'undefined') return null;
        return localStorage.getItem(`defaultAgendaId:${userId}`);
    }

    function setStoredDefaultAgendaId(userId, agendaId) {
        if (!userId || typeof localStorage === 'undefined') return;
        if (!agendaId) {
            localStorage.removeItem(`defaultAgendaId:${userId}`);
            return;
        }
        localStorage.setItem(`defaultAgendaId:${userId}`, String(agendaId));
    }

    function clearStoredDefaultAgendaId(userId) {
        if (!userId || typeof localStorage === 'undefined') return;
        localStorage.removeItem(`defaultAgendaId:${userId}`);
    }

    function getStoredDefaultView(userId) {
        if (!userId || typeof localStorage === 'undefined') return null;
        return localStorage.getItem(`defaultView:${userId}`);
    }

    function setStoredDefaultView(userId, defaultView) {
        if (!userId || typeof localStorage === 'undefined') return;
        if (!defaultView) {
            localStorage.removeItem(`defaultView:${userId}`);
            return;
        }
        localStorage.setItem(`defaultView:${userId}`, String(defaultView));
    }

    function getPendingAgendaInviteToken() {
        return pendingAgendaInviteToken;
    }

    function setPendingAgendaInviteToken(token) {
        if (typeof localStorage === 'undefined') return;
        if (!token) {
            localStorage.removeItem('pendingAgendaInviteToken');
            setPendingAgendaInviteTokenState(null);
            return;
        }
        const nextToken = String(token);
        localStorage.setItem('pendingAgendaInviteToken', nextToken);
        setPendingAgendaInviteTokenState(nextToken);
    }

    function setPendingAgendaInviteEmail(email) {
        if (typeof localStorage === 'undefined') return;
        if (!email) {
            localStorage.removeItem('pendingAgendaInviteEmail');
            setPendingAgendaInviteEmailState(null);
            return;
        }
        const nextEmail = String(email).trim();
        localStorage.setItem('pendingAgendaInviteEmail', nextEmail);
        setPendingAgendaInviteEmailState(nextEmail);
    }

    function clearPendingAgendaInviteToken() {
        if (typeof localStorage === 'undefined') return;
        localStorage.removeItem('pendingAgendaInviteToken');
        setPendingAgendaInviteTokenState(null);
    }

    function clearPendingAgendaInviteEmail() {
        if (typeof localStorage === 'undefined') return;
        localStorage.removeItem('pendingAgendaInviteEmail');
        setPendingAgendaInviteEmailState(null);
    }

    async function captureInviteTokenFromUrl() {
        if (typeof window === 'undefined') return null;

        const url = new URL(window.location.href);
        const inviteToken = (url.searchParams.get('invite') || '').trim();
        if (!inviteToken) return null;

        setPendingAgendaInviteToken(inviteToken);
        clearPendingAgendaInviteEmail();
        url.searchParams.delete('invite');
        url.searchParams.delete('email');
        const nextSearch = url.searchParams.toString();
        const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
        window.history.replaceState({}, document.title, nextUrl);

        try {
            const inviteDetails = await getAgendaInviteDetailsApi(inviteToken);
            if (inviteDetails?.inviteeEmail) {
                setPendingAgendaInviteEmail(inviteDetails.inviteeEmail);
            }
        } catch (err) {
            console.error('[AUTH] invite details lookup error', err);
        }

        return inviteToken;
    }

    function detectPasswordRecoveryFromUrl() {
        if (typeof window === 'undefined') return false;

        const url = new URL(window.location.href);
        return url.searchParams.get('type') === 'recovery' || url.hash.includes('type=recovery');
    }

    async function applyPendingAgendaInvite(userId) {
        const inviteToken = getPendingAgendaInviteToken();
        if (!inviteToken || !userId) return null;

        try {
            const invite = await acceptAgendaInviteApi(inviteToken);
            clearPendingAgendaInviteToken();
            clearPendingAgendaInviteEmail();

            const nextAgendas = await getUserAgendas(userId);
            return {
                agendaId: invite?.agenda_id || null,
                agendas: nextAgendas,
            };
        } catch (err) {
            const message = err?.message || '';
            if (/different email address/i.test(message)) {
                return { type: 'error', errorMessage: message };
            }

            clearPendingAgendaInviteToken();
            return { type: 'error', errorMessage: message };
        }
    }

    function buildFallbackUser(sessionUser, profile = null) {
        if (!sessionUser) return null;

        return {
            uid: sessionUser.id,
            email: profile?.email ?? sessionUser.email ?? '',
            avatar: profile?.avatar ?? null,
            name:
                profile?.name ??
                sessionUser.user_metadata?.name ??
                sessionUser.user_metadata?.full_name ??
                sessionUser.email?.split('@')[0] ??
                'User',
            displayName:
                profile?.name ??
                sessionUser.user_metadata?.name ??
                sessionUser.user_metadata?.full_name ??
                sessionUser.email?.split('@')[0] ??
                'User',
            darkMode: profile?.darkMode ?? false,
            language: profile?.language ?? ((typeof localStorage !== 'undefined' && localStorage.language) || detectBrowserLanguage()),
            dateFormat: profile?.dateFormat ?? 'DD-MM',
            weekStartsOn: profile?.weekStartsOn ?? 'Monday',
            defaultView: profile?.defaultView ?? getStoredDefaultView(sessionUser.id) ?? 'week',
            currentAgendaId: profile?.defaultAgendaId ?? profile?.currentAgendaId ?? null,
            defaultAgendaId: profile?.defaultAgendaId ?? null,
        };
    }

    async function ensureSessionUserSetup(sessionUser, fallbackProfile = null) {
        if (!sessionUser?.id) {
            return {
                user: null,
                agendas: [],
            };
        }

        let profile = fallbackProfile ?? await getCurrentUser(sessionUser.id);

        if (!profile) {
            try {
                await createUser(sessionUser.id, {
                    email: sessionUser.email ?? '',
                    name:
                        sessionUser.user_metadata?.name ??
                        sessionUser.user_metadata?.full_name ??
                        sessionUser.email?.split('@')[0] ??
                        'User',
                    defaultView: 'week',
                });
            } catch (err) {
                console.error('[AUTH] ensureSessionUserSetup createUser error', err);
            }

            profile = await getCurrentUser(sessionUser.id);
        }

        const fallbackUser = buildFallbackUser(sessionUser, profile);
        const preferredAgendaId =
            profile?.defaultAgendaId ??
            getStoredDefaultAgendaId(sessionUser.id) ??
            null;

        const ensured = await ensureDefaultAgenda(sessionUser.id, preferredAgendaId);
        fallbackUser.currentAgendaId = ensured.currentAgendaId;
        fallbackUser.defaultAgendaId = preferredAgendaId || ensured.currentAgendaId;

        return {
            user: fallbackUser,
            agendas: ensured.agendas,
        };
    }

    React.useEffect(() => {
        let mounted = true;

        async function bootstrapAuth() {
            isBootstrappingRef.current = true;
            const { data, error } = await supabase.auth.getSession();
            const sessionUser = data?.session?.user ?? null;
            const isRecoveryUrl = detectPasswordRecoveryFromUrl();

            if (!mounted) return;

            await captureInviteTokenFromUrl();
            setIsPasswordRecovery(isRecoveryUrl);

            if (sessionUser) {
                stripAuthParamsFromUrl();

                try {
                    const { user, agendas: nextAgendas } = await ensureSessionUserSetup(sessionUser);

                    if (!mounted) return;
                    if (user) {
                        setCurrentUser(user);
                        setAgendas(nextAgendas);
                        loadedProfileIdRef.current = sessionUser.id;
                        localStorage.isLoggedIn = 'true';
                        localStorage.theme = user.darkMode ? 'dark' : 'light';
                        localStorage.language = user.language;
                        setAppLanguage(user.language);
                        setStoredDefaultView(sessionUser.id, user.defaultView || 'week');
                    }

                    const inviteResult = await applyPendingAgendaInvite(sessionUser.id);
                    if (inviteResult?.agendaId) {
                        setCurrentUser(prev => prev ? {
                            ...prev,
                            currentAgendaId: inviteResult.agendaId,
                            defaultAgendaId: inviteResult.agendaId,
                        } : prev);
                        setAgendas(inviteResult.agendas || []);
                        setStoredDefaultAgendaId(sessionUser.id, inviteResult.agendaId);
                        await setUserDefaultAgenda(sessionUser.id, inviteResult.agendaId).catch(() => {});
                    }
                } catch (err) {
                    console.error('[AUTH] bootstrap profile error', err);
                }
            } else {
                setCurrentUser(null);
                setAgendas([]);
                localStorage.isLoggedIn = 'false';
            }

            isBootstrappingRef.current = false;
            setIsAuthReady(true);
        }

        bootstrapAuth();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            const sessionUser = session?.user ?? null;

            if (sessionUser) {
                if (!mounted) return;
                if (isBootstrappingRef.current) return;

                stripAuthParamsFromUrl();

                // Cancela sign-out pendente (Supabase v2 às vezes dispara SIGNED_OUT + SIGNED_IN no refresh de token)
                if (signOutTimerRef.current) {
                    clearTimeout(signOutTimerRef.current);
                    signOutTimerRef.current = null;
                }

                if (loadedProfileIdRef.current === sessionUser.id || currentUser?.uid === sessionUser.id) {
                    loadedProfileIdRef.current = sessionUser.id;
                    setIsAuthReady(true);
                    return;
                }

                loadedProfileIdRef.current = sessionUser.id;

                const fallbackUser = buildFallbackUser(sessionUser);
                setCurrentUser(fallbackUser);
                localStorage.isLoggedIn = 'true';
                localStorage.theme = fallbackUser.darkMode ? 'dark' : 'light';
                localStorage.language = fallbackUser.language;
                setAppLanguage(fallbackUser.language);
                setIsPasswordRecovery(event === 'PASSWORD_RECOVERY');
                setIsAuthReady(true);
                // Fetch de perfil não feito aqui — bootstrapAuth e login() já cuidam disso
            } else {
                if (!mounted) return;
                if (isBootstrappingRef.current) return;
                // Debounce: evita limpar o estado durante refresh de token (SIGNED_OUT seguido de SIGNED_IN)
                signOutTimerRef.current = setTimeout(() => {
                    if (!mounted) return;
                    loadedProfileIdRef.current = null;
                    setCurrentUser(null);
                    setAgendas([]);
                    setIsPasswordRecovery(false);
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
                await createUser(sessionUser.id, { email, name, defaultView: 'week' });
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
                defaultView: 'week',
                currentAgendaId: null,
                defaultAgendaId: null,
            });

            const ensured = await ensureDefaultAgenda(sessionUser.id, fallbackUser.currentAgendaId);
            fallbackUser.currentAgendaId = ensured.currentAgendaId;
            fallbackUser.defaultAgendaId = ensured.currentAgendaId;
            setStoredDefaultAgendaId(sessionUser.id, ensured.currentAgendaId);
            setIsPasswordRecovery(false);

                setCurrentUser(fallbackUser);
                setAgendas(ensured.agendas);
                loadedProfileIdRef.current = sessionUser.id;
                localStorage.isLoggedIn = 'true';
                localStorage.theme = 'light';
                localStorage.language = fallbackUser.language;
                setAppLanguage(fallbackUser.language);
                setStoredDefaultView(sessionUser.id, fallbackUser.defaultView);

                const inviteResult = await applyPendingAgendaInvite(sessionUser.id);
                if (inviteResult?.agendaId) {
                    fallbackUser.currentAgendaId = inviteResult.agendaId;
                    fallbackUser.defaultAgendaId = inviteResult.agendaId;
                    setCurrentUser(prev => prev ? {
                        ...prev,
                        currentAgendaId: inviteResult.agendaId,
                        defaultAgendaId: inviteResult.agendaId,
                    } : prev);
                    setAgendas(inviteResult.agendas || []);
                    setStoredDefaultAgendaId(sessionUser.id, inviteResult.agendaId);
                    await setUserDefaultAgenda(sessionUser.id, inviteResult.agendaId).catch(() => {});
                }

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
            let resolvedUser = fallbackUser;

            setIsPasswordRecovery(false);

            // Tenta enriquecer, mas não trava o login
            try {
                const profile = await getCurrentUser(sessionUser.id);

                if (profile) {
                    const preferredAgendaId =
                        profile.defaultAgendaId ??
                        getStoredDefaultAgendaId(sessionUser.id) ??
                        null;

                    const ensuredFromProfile = await ensureDefaultAgenda(sessionUser.id, preferredAgendaId);
                    const mergedUser = buildFallbackUser(sessionUser, profile);
                    mergedUser.currentAgendaId = ensuredFromProfile.currentAgendaId;
                    mergedUser.defaultAgendaId = preferredAgendaId || ensuredFromProfile.currentAgendaId;
                    mergedUser.defaultView = profile.defaultView || getStoredDefaultView(sessionUser.id) || 'week';
                    setStoredDefaultAgendaId(sessionUser.id, mergedUser.defaultAgendaId);
                    setStoredDefaultView(sessionUser.id, mergedUser.defaultView);
                    setCurrentUser(mergedUser);
                    setAgendas(ensuredFromProfile.agendas);
                    loadedProfileIdRef.current = sessionUser.id;
                    localStorage.theme = mergedUser.darkMode ? 'dark' : 'light';
                    localStorage.language = mergedUser.language;
                    setAppLanguage(mergedUser.language);
                    resolvedUser = mergedUser;
                }
            } catch (err) {
                console.error('[AUTH] login profile enrichment error', err);
            }

            if (!resolvedUser?.uid) {
                const preferredAgendaId = fallbackUser.defaultAgendaId ?? getStoredDefaultAgendaId(sessionUser.id) ?? null;
                const ensured = await ensureDefaultAgenda(sessionUser.id, preferredAgendaId);
                fallbackUser.currentAgendaId = ensured.currentAgendaId;
                fallbackUser.defaultAgendaId = preferredAgendaId || ensured.currentAgendaId;
                fallbackUser.defaultView = fallbackUser.defaultView || getStoredDefaultView(sessionUser.id) || 'week';
                setStoredDefaultAgendaId(sessionUser.id, fallbackUser.defaultAgendaId);
                setStoredDefaultView(sessionUser.id, fallbackUser.defaultView);
                setCurrentUser(fallbackUser);
                setAgendas(ensured.agendas);
                loadedProfileIdRef.current = sessionUser.id;
                localStorage.isLoggedIn = 'true';
                localStorage.theme = fallbackUser.darkMode ? 'dark' : 'light';
                localStorage.language = fallbackUser.language;
                setAppLanguage(fallbackUser.language);
                resolvedUser = fallbackUser;
            }

            const inviteResult = await applyPendingAgendaInvite(sessionUser.id);
            if (inviteResult?.agendaId) {
                resolvedUser = {
                    ...resolvedUser,
                    currentAgendaId: inviteResult.agendaId,
                    defaultAgendaId: inviteResult.agendaId,
                };
                setCurrentUser(prev => prev ? {
                    ...prev,
                    currentAgendaId: inviteResult.agendaId,
                    defaultAgendaId: inviteResult.agendaId,
                } : prev);
                setAgendas(inviteResult.agendas || []);
                setStoredDefaultAgendaId(sessionUser.id, inviteResult.agendaId);
                await setUserDefaultAgenda(sessionUser.id, inviteResult.agendaId).catch(() => {});
            }

            return { type: 'success', data: resolvedUser };
        } catch (err) {
            console.error('[AUTH] login error', err);
            return { type: 'error', errorMessage: err.message };
        }
    }

    async function loginWithGoogle() {
        try {
            const redirectTo = `${window.location.origin}/`;
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                },
            });

            if (error) throw error;
            return { type: 'success' };
        } catch (err) {
            console.error('[AUTH] loginWithGoogle error', err);
            return { type: 'error', errorMessage: err.message || 'Unable to sign in with Google.' };
        }
    }

    async function logout() {
        await supabase.auth.signOut();
        setCurrentUser(null);
        setAgendas([]);
        clearStoredDefaultAgendaId(currentUser?.uid);
        clearPendingAgendaInviteToken();
        clearPendingAgendaInviteEmail();
        localStorage.isLoggedIn = 'false';
        localStorage.theme = 'light';
        const nextLanguage = localStorage.language || detectBrowserLanguage();
        setAppLanguage(nextLanguage);
        return window.location.reload();
    }

    async function setLanguagePreference(nextLanguage) {
        if (!nextLanguage) return;

        localStorage.language = nextLanguage;
        setAppLanguage(nextLanguage);

        if (!currentUser?.uid) return;

        try {
            await updateUserData(currentUser.uid, {
                name: currentUser.name,
                darkMode: currentUser.darkMode,
                language: nextLanguage,
                dateFormat: currentUser.dateFormat,
                weekStartsOn: currentUser.weekStartsOn,
            });

            setCurrentUser(prev => prev ? {
                ...prev,
                language: nextLanguage,
            } : prev);
        } catch (err) {
            console.error('[AUTH] set language preference error', err);
        }
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

            await updateUserData(currentUser.uid, {
                ...data,
            });

            if (typeof data.defaultAgendaId !== 'undefined') {
                const result = await setUserDefaultAgenda(currentUser.uid, data.defaultAgendaId || null);
                if (result?.persisted === false) {
                    setStoredDefaultAgendaId(currentUser.uid, data.defaultAgendaId || null);
                }
            }

            if (typeof data.defaultView !== 'undefined') {
                setStoredDefaultView(currentUser.uid, data.defaultView || 'week');
            }

            setCurrentUser(prev => ({
                ...prev,
                email,
                name: data.name,
                ...(typeof data.avatar !== 'undefined' ? { avatar: data.avatar } : {}),
                displayName: data.name,
                darkMode: data.darkMode,
                language: data.language,
                dateFormat: data.dateFormat,
                weekStartsOn: data.weekStartsOn,
                ...(typeof data.defaultView !== 'undefined' ? { defaultView: data.defaultView || 'week' } : {}),
                ...(typeof data.defaultAgendaId !== 'undefined' ? { defaultAgendaId: data.defaultAgendaId || null } : {}),
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
            const redirectTo = `${window.location.origin}/reset-password`;
            const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
            if (error) throw error;
            return { type: 'success' };
        } catch (err) {
            console.error('[AUTH] reset password error', err);
            const cooldownMatch = String(err?.message || '').match(/after\s+(\d+)\s+seconds?/i);
            return {
                type: 'error',
                errorMessage: err.message,
                cooldownSeconds: cooldownMatch ? Number(cooldownMatch[1]) : null,
            };
        }
    }

    async function completePasswordRecovery(password) {
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;

            setIsPasswordRecovery(false);
            stripAuthParamsFromUrl();

            return { type: 'success' };
        } catch (err) {
            console.error('[AUTH] complete password recovery error', err);
            return { type: 'error', errorMessage: err.message };
        }
    }

    async function deleteAccount() {
        try {
            if (!currentUser?.uid) {
                return { type: 'error', errorMessage: 'User session not found.' };
            }

            await deleteCurrentAccount(currentUser.uid);
            await supabase.auth.signOut();
            clearStoredDefaultAgendaId(currentUser.uid);

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

    async function createAgenda(name, avatar = "", color = "#3b82f6", options = {}) {
        if (!currentUser?.uid) {
            return { type: 'error', errorMessage: 'User session not found.' };
        }

        try {
            const { sortCompletedTasks = true, relatedLinksEnabled = true } = options;
            const agenda = await createAgendaApi(currentUser.uid, name, {
                setAsCurrent: true,
                avatar,
                color,
                sortCompletedTasks,
                relatedLinksEnabled,
            });
            const normalizedAgenda = {
                ...agenda,
                sort_completed_tasks: agenda?.sort_completed_tasks ?? sortCompletedTasks,
                related_links_enabled: agenda?.related_links_enabled ?? relatedLinksEnabled,
                role: agenda?.role || 'owner',
            };
            const nextAgendas = [...agendas, normalizedAgenda];
            setAgendas(nextAgendas);
            setCurrentUser(prev => ({
                ...prev,
                currentAgendaId: normalizedAgenda.id,
                defaultAgendaId: prev?.defaultAgendaId ?? normalizedAgenda.id,
            }));
            if (!currentUser?.defaultAgendaId) {
                setStoredDefaultAgendaId(currentUser.uid, normalizedAgenda.id);
                await setUserDefaultAgenda(currentUser.uid, normalizedAgenda.id);
            }
            return { type: 'success', data: normalizedAgenda };
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

    async function renameAgenda(agendaId, name, avatar = "", color = "#3b82f6", sortCompletedTasks = null, relatedLinksEnabled = null) {
        if (!currentUser?.uid || !agendaId) {
            return { type: 'error', errorMessage: 'Agenda not found.' };
        }

        try {
            const existingAgenda = agendas.find(agenda => String(agenda.id) === String(agendaId));
            const updated = await updateAgendaNameApi(currentUser.uid, agendaId, name, avatar, color, sortCompletedTasks, relatedLinksEnabled);
            const normalizedUpdated = {
                ...updated,
                ...(sortCompletedTasks !== null ? { sort_completed_tasks: sortCompletedTasks } : {}),
                ...(relatedLinksEnabled !== null ? { related_links_enabled: relatedLinksEnabled } : {}),
                role: existingAgenda?.role || updated?.role || 'owner',
            };
            setAgendas(prev => prev.map(agenda => (
                String(agenda.id) === String(normalizedUpdated.id) ? normalizedUpdated : agenda
            )));
            return { type: 'success', data: normalizedUpdated };
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
                defaultAgendaId:
                    String(prev?.defaultAgendaId) === String(agendaId)
                        ? data.currentAgendaId
                        : prev?.defaultAgendaId,
            }));
            if (String(currentUser?.defaultAgendaId) === String(agendaId)) {
                setStoredDefaultAgendaId(currentUser.uid, data.currentAgendaId || null);
                await setUserDefaultAgenda(currentUser.uid, data.currentAgendaId || null);
            }
            return { type: 'success', data };
        } catch (err) {
            return { type: 'error', errorMessage: err.message || 'Unable to delete agenda.' };
        }
    }

    const value = {
        currentUser,
        appLanguage,
        isAuthReady,
        isPasswordRecovery,
        pendingAgendaInviteToken,
        pendingAgendaInviteEmail,
        signup,
        login,
        loginWithGoogle,
        logout,
        resetPassword,
        completePasswordRecovery,
        updateUser,
        deleteAccount,
        agendas,
        createAgenda,
        switchAgenda,
        renameAgenda,
        deleteAgenda,
        setLanguagePreference,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
