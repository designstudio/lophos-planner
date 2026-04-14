import { supabase } from './supabase.js';
import levenshtein from 'js-levenshtein';
import { parseDateOnly } from './utils.js';

function normalizeSearchText(text) {
    return (text || "")
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

export function sleep(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

export function tryCatchDecorator(func) {
    return async function () {
        try {
            const data = await func.call(this, ...arguments);
            return { success: true, data };
        } catch (err) {
            return { success: false, message: err.message };
        }
    };
}

// Tasks CRUD

export async function createTask(data) {
    const { data: task, error } = await supabase
        .from('tasks')
        .insert(data)
        .select()
        .single();

    if (error) throw error;
    return { ...task, date: parseDateOnly(task.date) };
}

export async function getUserTasks(userId, agendaId = null) {
    if ((!userId || userId === 'undefined') && !agendaId) {
        return [];
    }

    let query = supabase
        .from('tasks')
        .select('*');

    if (agendaId) {
        query = query.eq('agenda_id', agendaId);
    } else {
        query = query.eq('uid', userId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data.map(task => ({ ...task, date: parseDateOnly(task.date) }));
}

export async function getSearchedTasks(userId, agendaId, query) {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return [];

    const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

    const tasks = await getUserTasks(userId, agendaId);

    return tasks
        .map(task => {
            const normalizedName = normalizeSearchText(task.name);
            const words = normalizedName.split(/\s+/).filter(Boolean);

            const hasAllQueryTokens = queryTokens.every(token =>
                normalizedName.includes(token)
            );

            if (hasAllQueryTokens) {
                return { task, score: 0 };
            }

            if (normalizedName.includes(normalizedQuery)) {
                return { task, score: 0 };
            }

            if (words.some(word => word.includes(normalizedQuery))) {
                return { task, score: 1 };
            }

            // Restrictive fuzzy fallback to avoid unrelated matches.
            if (normalizedQuery.length < 5) {
                return null;
            }

            const bestWordDistance = words.length
                ? Math.min(...words.map(word => levenshtein(word, normalizedQuery)))
                : Infinity;
            const fullDistance = normalizedName ? levenshtein(normalizedName, normalizedQuery) : Infinity;
            const bestDistance = Math.min(bestWordDistance, fullDistance);
            const maxDistance = normalizedQuery.length >= 8 ? 2 : 1;

            if (bestDistance <= maxDistance) {
                return { task, score: 10 + bestDistance };
            }

            return null;
        })
        .filter(Boolean)
        .sort((a, b) => {
            if (a.score !== b.score) return a.score - b.score;

            const dateA = new Date(a.task.date).getTime();
            const dateB = new Date(b.task.date).getTime();
            return dateB - dateA;
        })
        .map(item => item.task)
        .slice(0, 10);
}

export async function updateTask(taskId, data) {
    const { error } = await supabase
        .from('tasks')
        .update(data)
        .eq('id', taskId);

    if (error) throw error;
}

export async function deleteTask(taskId) {
    const { data: taskData, error: fetchError } = await supabase
        .from('tasks')
        .select('date, order')
        .eq('id', taskId)
        .maybeSingle();

    if (fetchError) throw fetchError;
    if (!taskData) return;

    const { data: sameDayTasks, error: queryError } = await supabase
        .from('tasks')
        .select('id, order')
        .eq('date', taskData.date);

    if (queryError) throw queryError;

    const subsequent = (sameDayTasks || []).filter(task => task.order > taskData.order);

    await Promise.all(
        subsequent.map(task =>
            supabase.from('tasks').update({ order: task.order - 1 }).eq('id', task.id)
        )
    );

    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) throw error;
}

export async function reOrderTasks(reOrdered) {
    await Promise.all(
        reOrdered.map((task, index) =>
            supabase.from('tasks').update({ order: index }).eq('id', task.id)
        )
    );
}

export async function toggleDoneTask(taskId) {
    const { data, error: fetchError } = await supabase
        .from('tasks')
        .select('done')
        .eq('id', taskId)
        .single();

    if (fetchError) throw fetchError;

    const { error } = await supabase
        .from('tasks')
        .update({ done: !data.done })
        .eq('id', taskId);

    if (error) throw error;
}

export async function clearUsersTasks(userId) {
    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('uid', userId);

    if (error) throw error;
}

export async function deleteCurrentAccount(userId) {
    const { error } = await supabase.rpc('delete_user_account_with_audit', {
        p_source: 'self_service_web',
        p_metadata: {
            app: 'lophos-planner',
            user_id_hint: userId,
        },
    });

    if (error) throw error;
}

// Users CRUD

export async function createUser(id, data) {
    const payload = {
        id,
        email: data.email,
        name: data.name,
        avatar: data.avatar ?? null,
        dark_mode: data.darkMode ?? false,
        language: data.language ?? 'ptBR',
        date_format: data.dateFormat ?? 'DD-MM',
        week_starts_on: data.weekStartsOn ?? 'Monday',
    };

    const { error } = await supabase.from('users').insert(payload);
    if (error) {
        const missingAvatarColumn = /column\s+"?avatar"?\s+of relation\s+"?users"? does not exist|Could not find the 'avatar' column/i.test(error.message || '');
        if (!missingAvatarColumn) throw error;

        const { avatar: _ignoredAvatar, ...payloadWithoutAvatar } = payload;
        const retry = await supabase.from('users').insert(payloadWithoutAvatar);
        if (retry.error) throw retry.error;
    }

    const defaultAgenda = await createAgenda(id, 'Pessoal', { setAsCurrent: false });
    await setUserCurrentAgenda(id, defaultAgenda.id);
}

const _getCurrentUserInFlight = new Map();

export function getCurrentUser(id) {
    if (!id) {
        return Promise.resolve(null);
    }

    if (_getCurrentUserInFlight.has(id)) {
        return _getCurrentUserInFlight.get(id);
    }

    const promise = Promise.race([
        supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .maybeSingle(),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('getCurrentUser timed out.')), 15000)
        ),
    ]).then(result => {
        const { data, error } = result;

        if (error || !data) {
            return null;
        }

        const profile = {
            uid: data.id,
            email: data.email,
            name: data.name,
            avatar: data.avatar || '',
            displayName: data.name,
            darkMode: data.dark_mode,
            language: data.language,
            dateFormat: data.date_format,
            weekStartsOn: data.week_starts_on,
            currentAgendaId: data.current_agenda_id || null,
            defaultAgendaId: data.default_agenda_id || null,
        };
        return profile;
    }).finally(() => _getCurrentUserInFlight.delete(id));

    _getCurrentUserInFlight.set(id, promise);
    return promise;
}

export async function updateUserData(id, data) {
    const payload = {
        name: data.name,
        dark_mode: data.darkMode,
        language: data.language ?? 'ptBR',
        date_format: data.dateFormat ?? 'DD-MM',
        week_starts_on: data.weekStartsOn ?? 'Monday',
    };

    if (typeof data.avatar !== 'undefined') {
        payload.avatar = (data.avatar || '').trim() || null;
    }

    if (typeof data.defaultAgendaId !== 'undefined') {
        payload.default_agenda_id = data.defaultAgendaId || null;
    }

    const { error } = await supabase
        .from('users')
        .update(payload)
        .eq('id', id);

    if (error) {
        const missingAvatarColumn = /column\s+"?avatar"?\s+of relation\s+"?users"? does not exist|Could not find the 'avatar' column/i.test(error.message || '');
        if (!missingAvatarColumn) throw error;

        const { avatar: _ignoredAvatar, ...payloadWithoutAvatar } = payload;
        const retry = await supabase
            .from('users')
            .update(payloadWithoutAvatar)
            .eq('id', id);

        if (retry.error) throw retry.error;
    }
}

// Agendas

export async function getUserAgendas(userId) {
    const { data, error } = await supabase.rpc('get_user_agendas', {
        p_user_id: userId,
    });

    if (error) throw error;

    return (data || []).map(agenda => ({
        ...agenda,
        role: agenda?.role || (String(agenda?.uid) === String(userId) ? 'owner' : 'member'),
    }));
}

export async function createAgenda(userId, name, options = {}) {
    const { setAsCurrent = true, avatar = null, color = '#3b82f6', sortCompletedTasks = true, relatedLinksEnabled = true } = options;

    const payload = {
        uid: userId,
        name: (name || '').trim() || 'Nova agenda',
        avatar: (avatar || '').trim() || null,
        color: (color || '').trim() || '#3b82f6',
        sort_completed_tasks: sortCompletedTasks,
        related_links_enabled: relatedLinksEnabled,
    };

    let agendaData = null;

    const { data, error } = await supabase
        .from('agendas')
        .insert(payload)
        .select('*')
        .single();

    if (error) {
        const shouldRetryWithoutColorOrSort = /column\s+"?(color|sort_completed_tasks|related_links_enabled)"?\s+of relation\s+"?agendas"? does not exist|Could not find the '(color|sort_completed_tasks|related_links_enabled)' column/i.test(error.message || '');
        if (!shouldRetryWithoutColorOrSort) throw error;

        const { color: _ignoredColor, sort_completed_tasks: _ignoredSort, related_links_enabled: _ignoredRelatedLinksEnabled, ...payloadWithoutColorOrSort } = payload;
        const retry = await supabase
            .from('agendas')
            .insert(payloadWithoutColorOrSort)
            .select('*')
            .single();

        if (retry.error) throw retry.error;
        agendaData = retry.data;
    } else {
        agendaData = data;
    }

    if (setAsCurrent) {
        await setUserCurrentAgenda(userId, agendaData.id);
    }

    return {
        ...agendaData,
        role: 'owner',
    };
}

export async function updateAgendaName(userId, agendaId, name, avatar = null, color = '#3b82f6', sortCompletedTasks = null, relatedLinksEnabled = null) {
    const nextName = (name || '').trim();
    if (!nextName) throw new Error('Agenda name is required.');

    const nextAvatar = (avatar || '').trim() || null;
    const nextColor = (color || '').trim() || '#3b82f6';

    const fullPayload = { name: nextName, avatar: nextAvatar, color: nextColor };
    if (sortCompletedTasks !== null) {
        fullPayload.sort_completed_tasks = sortCompletedTasks;
    }
    if (relatedLinksEnabled !== null) {
        fullPayload.related_links_enabled = relatedLinksEnabled;
    }

    let updatedData = null;
    const firstTry = await supabase
        .from('agendas')
        .update(fullPayload)
        .eq('id', agendaId)
        .eq('uid', userId)
        .select('*')
        .single();

    if (firstTry.error) {
        const shouldRetryWithoutColor = /column\s+"?(color|sort_completed_tasks|related_links_enabled)"?\s+of relation\s+"?agendas"? does not exist|Could not find the '(color|sort_completed_tasks|related_links_enabled)' column/i.test(firstTry.error.message || '');
        if (!shouldRetryWithoutColor) throw firstTry.error;

        const fallbackPayload = { name: nextName, avatar: nextAvatar };
        const retry = await supabase
            .from('agendas')
            .update(fallbackPayload)
            .eq('id', agendaId)
            .eq('uid', userId)
            .select('*')
            .single();

        if (retry.error) throw retry.error;
        updatedData = retry.data;
    } else {
        updatedData = firstTry.data;
    }

    return updatedData;
}

export async function setUserCurrentAgenda(userId, agendaId) {
    const { error } = await supabase
        .from('users')
        .update({ current_agenda_id: agendaId })
        .eq('id', userId);

    if (error) throw error;
}

export async function setUserDefaultAgenda(userId, agendaId) {
    const { error } = await supabase
        .from('users')
        .update({ default_agenda_id: agendaId })
        .eq('id', userId);

    if (!error) return { persisted: true };

    const missingDefaultAgendaColumn = /column\s+"?default_agenda_id"?\s+of relation\s+"?users"? does not exist|Could not find the 'default_agenda_id' column/i.test(error.message || '');
    if (missingDefaultAgendaColumn) {
        return { persisted: false };
    }

    throw error;
}

export async function ensureDefaultAgenda(userId, preferredAgendaId = null) {
    const agendas = await getUserAgendas(userId);

    if (agendas.length === 0) {
        const created = await createAgenda(userId, 'Pessoal', { setAsCurrent: false });
        await setUserCurrentAgenda(userId, created.id);
        return {
            agendas: [created],
            currentAgendaId: created.id,
        };
    }

    const currentAgendaId = agendas.some(agenda => String(agenda.id) === String(preferredAgendaId))
        ? preferredAgendaId
        : agendas[0].id;

    if (String(currentAgendaId) !== String(preferredAgendaId || '')) {
        await setUserCurrentAgenda(userId, currentAgendaId);
    }

    return {
        agendas,
        currentAgendaId,
    };
}

export async function deleteAgenda(userId, agendaId) {
    const agendas = await getUserAgendas(userId);
    if (agendas.length <= 1) {
        throw new Error('At least one agenda must remain.');
    }

    const { error: deleteTasksError } = await supabase
        .from('tasks')
        .delete()
        .eq('agenda_id', agendaId)
        .eq('uid', userId);

    if (deleteTasksError) throw deleteTasksError;

    const { error: deleteAgendaError } = await supabase
        .from('agendas')
        .delete()
        .eq('id', agendaId)
        .eq('uid', userId);

    if (deleteAgendaError) throw deleteAgendaError;

    const remainingAgendas = (await getUserAgendas(userId)).filter(agenda => String(agenda.id) !== String(agendaId));
    const nextCurrentAgenda = remainingAgendas[0];

    if (nextCurrentAgenda) {
        await setUserCurrentAgenda(userId, nextCurrentAgenda.id);
    }

    return {
        agendas: remainingAgendas,
        currentAgendaId: nextCurrentAgenda?.id || null,
    };
}

// Public share

function generateShareToken() {
    const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    const tokenLength = 8;
    const randomValues = globalThis.crypto?.getRandomValues?.(new Uint8Array(tokenLength));

    if (randomValues) {
        return Array.from(randomValues, value => alphabet[value % alphabet.length]).join("");
    }

    return Math.random().toString(36).slice(2, 2 + tokenLength).padEnd(tokenLength, "0");
}

async function assignUniqueShareToken(agendaId, shareEnabled) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const shareToken = generateShareToken();
        const { error: updateError } = await supabase
            .from('agendas')
            .update({ share_token: shareToken })
            .eq('id', agendaId);

        if (!updateError) {
            return {
                shareToken,
                shareEnabled: !!shareEnabled,
            };
        }

        const isUniqueViolation = updateError.code === '23505';
        if (!isUniqueViolation || attempt === 4) {
            throw updateError;
        }
    }
}

export async function getShareSettings(agendaId) {
    const { data, error } = await supabase
        .from('agendas')
        .select('share_token, share_enabled')
        .eq('id', agendaId)
        .single();

    if (error) throw error;

    if (data.share_token && data.share_token.length === 8) {
        return {
            shareToken: data.share_token,
            shareEnabled: !!data.share_enabled,
        };
    }

    if (data.share_token) {
        return assignUniqueShareToken(agendaId, data.share_enabled);
    }

    return {
        shareToken: "",
        shareEnabled: !!data.share_enabled,
    };
}

export async function getOrCreateShareSettings(agendaId) {
    const { data, error } = await supabase
        .from('agendas')
        .select('share_token, share_enabled')
        .eq('id', agendaId)
        .single();

    if (error) throw error;

    if (data.share_token) {
        if (data.share_token.length !== 8) {
            return assignUniqueShareToken(agendaId, data.share_enabled);
        }

        return {
            shareToken: data.share_token,
            shareEnabled: !!data.share_enabled,
        };
    }

    return assignUniqueShareToken(agendaId, data.share_enabled);
}

export async function setShareEnabled(agendaId, enabled) {
    const shareSettings = await getOrCreateShareSettings(agendaId);

    const { error } = await supabase
        .from('agendas')
        .update({
            share_enabled: enabled,
            share_token: shareSettings.shareToken,
        })
        .eq('id', agendaId);

    if (error) throw error;

    return {
        shareToken: shareSettings.shareToken,
        shareEnabled: !!enabled,
    };
}

export async function acceptAgendaInvite(token) {
    const { data, error } = await supabase.rpc('accept_agenda_invite', {
        p_token: token,
    });

    if (error) throw error;
    return data;
}
export async function getAgendaInviteDetails(token) {
    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/send-agenda-invite?invite=${encodeURIComponent(token)}`;

    const response = await fetch(functionUrl, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    const text = await response.text();
    let payload = null;

    try {
        payload = text ? JSON.parse(text) : null;
    } catch {
        payload = null;
    }

    if (!response.ok) {
        const message =
            payload?.error ||
            payload?.message ||
            text ||
            `Request failed with status ${response.status}.`;
        throw new Error(message);
    }

    return payload;
}

export async function getAgendaMembers(agendaId) {
    if (!agendaId) return [];

    const { data: rpcData, error: rpcError } = await supabase.rpc('get_agenda_members', {
        p_agenda_id: agendaId,
    });

    if (rpcError) throw rpcError;

    return (Array.isArray(rpcData) ? rpcData : []).map(member => ({
        uid: member?.uid || member?.id || null,
        name: member?.name || member?.email || 'Member',
        email: member?.email || '',
        role: member?.role || 'member',
        avatar: member?.avatar || '',
        created_at: member?.created_at || null,
    }));
}

export async function sendAgendaInvite(agendaId, email, origin = '', language = 'ptBR') {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token || '';
    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/send-agenda-invite`;

    const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
            agendaId,
            email,
            origin,
            language,
        }),
    });

    const text = await response.text();
    let payload = null;

    try {
        payload = text ? JSON.parse(text) : null;
    } catch {
        payload = null;
    }

    if (!response.ok) {
        const message =
            payload?.error ||
            payload?.message ||
            text ||
            `Request failed with status ${response.status}.`;
        throw new Error(message);
    }

    return payload;
}

export async function getPublicAgendaByShareToken(shareToken) {
    const { data, error } = await supabase.rpc('get_public_agenda_by_share_token', {
        p_share_token: shareToken,
    });

    if (error) throw error;
    if (!data) return null;

    let normalized = data;
    if (Array.isArray(normalized)) {
        normalized = normalized[0] ?? null;
    }

    if (typeof normalized === 'string') {
        try {
            normalized = JSON.parse(normalized);
        } catch {
            normalized = null;
        }
    }

    if (!normalized || typeof normalized !== 'object') return null;

    return {
        owner: {
            name: normalized?.owner?.name,
            language: normalized?.owner?.language || 'ptBR',
            dateFormat: normalized?.owner?.dateFormat || 'DD-MM',
            weekStartsOn: normalized?.owner?.weekStartsOn || 'Monday',
        },
        agenda: {
            id: normalized?.agenda?.id,
            name: normalized?.agenda?.name,
            avatar: normalized?.agenda?.avatar || '',
            color: normalized?.agenda?.color || '#3b82f6',
            sort_completed_tasks: normalized?.agenda?.sort_completed_tasks ?? true,
            related_links_enabled: normalized?.agenda?.related_links_enabled ?? true,
        },
        tasks: (Array.isArray(normalized?.tasks) ? normalized.tasks : []).map(task => ({
            ...task,
            date: parseDateOnly(task.date),
        })),
    };
}
