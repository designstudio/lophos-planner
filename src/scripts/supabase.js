import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isDev = import.meta.env.DEV;

function getSafeSupabaseDiagnostics() {
    const hasUrl = typeof supabaseUrl === 'string' && supabaseUrl.trim().length > 0;
    const hasAnonKey = typeof supabaseAnonKey === 'string' && supabaseAnonKey.trim().length > 0;

    try {
        const parsedUrl = hasUrl ? new URL(supabaseUrl) : null;
        const origin = parsedUrl?.origin || null;

        return {
            hasUrl,
            hasAnonKey,
            urlValid: !!parsedUrl,
            protocol: parsedUrl?.protocol || null,
            hostname: parsedUrl?.hostname || null,
            origin,
            authHealthPath: origin ? `${origin}/auth/v1/health` : null,
        };
    } catch {
        return {
            hasUrl,
            hasAnonKey,
            urlValid: false,
            protocol: null,
            hostname: null,
            origin: null,
            authHealthPath: null,
        };
    }
}

export function logSafeSupabaseDiagnostics(scope = 'client-init') {
    const diagnostics = getSafeSupabaseDiagnostics();
    if (isDev) {
        console.info('[SUPABASE_DIAG]', JSON.stringify({
            scope,
            ...diagnostics,
        }));
    }
    return diagnostics;
}

export async function probeSupabaseAuthHealth() {
    const diagnostics = getSafeSupabaseDiagnostics();

    if (!diagnostics.authHealthPath) {
        const result = {
            ...diagnostics,
            reachable: false,
            status: null,
            probeError: diagnostics.hasUrl ? 'invalid_supabase_url' : 'missing_supabase_url',
        };
        if (isDev) {
            console.warn('[SUPABASE_DIAG]', JSON.stringify({
                scope: 'auth-health-probe',
                ...result,
            }));
        }
        return result;
    }

    try {
        const response = await fetch(diagnostics.authHealthPath, {
            method: 'GET',
            headers: hasAnonKeyHeader() ? { apikey: supabaseAnonKey } : undefined,
        });

        const result = {
            ...diagnostics,
            reachable: true,
            ok: response.ok,
            status: response.status,
            probeError: null,
        };

        if (isDev) {
            console.info('[SUPABASE_DIAG]', JSON.stringify({
                scope: 'auth-health-probe',
                ...result,
            }));
        }
        return result;
    } catch (error) {
        const result = {
            ...diagnostics,
            reachable: false,
            status: null,
            probeError: error?.message || 'fetch_failed',
        };

        if (isDev) {
            console.warn('[SUPABASE_DIAG]', JSON.stringify({
                scope: 'auth-health-probe',
                ...result,
            }));
        }
        return result;
    }
}

function hasAnonKeyHeader() {
    return typeof supabaseAnonKey === 'string' && supabaseAnonKey.trim().length > 0;
}

logSafeSupabaseDiagnostics();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
    },
});
