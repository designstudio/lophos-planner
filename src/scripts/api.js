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
    if (!userId || userId === 'undefined') {
        return [];
    }

    let query = supabase
        .from('tasks')
        .select('*')
        .eq('uid', userId);

    if (agendaId) {
        query = query.eq('agenda_id', agendaId);
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
        .sort((a, b) => a.score - b.score)
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
        dark_mode: data.darkMode ?? false,
        language: data.language ?? 'ptBR',
        date_format: data.dateFormat ?? 'DD-MM',
        week_starts_on: data.weekStartsOn ?? 'Monday',
    };

    const { error } = await supabase.from('users').insert(payload);

    if (error) throw error;

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

    if (typeof data.defaultAgendaId !== 'undefined') {
        payload.default_agenda_id = data.defaultAgendaId || null;
    }

    const firstTry = await supabase
        .from('users')
        .update(payload)
        .eq('id', id);

    if (!firstTry.error) return;

    // Backward compatibility for instances that still don't have default_agenda_id.
    const missingDefaultAgendaColumn = /column\s+"?default_agenda_id"?\s+of relation\s+"?users"? does not exist|Could not find the 'default_agenda_id' column/i.test(firstTry.error.message || '');
    if (!missingDefaultAgendaColumn) throw firstTry.error;

    const { default_agenda_id: _ignoredDefaultAgendaId, ...payloadWithoutDefaultAgenda } = payload;
    const retry = await supabase
        .from('users')
        .update(payloadWithoutDefaultAgenda)
        .eq('id', id);

    if (retry.error) throw retry.error;
}

// Agendas

export async function getUserAgendas(userId) {
    const { data, error } = await supabase
        .from('agendas')
        .select('*')
        .eq('uid', userId)
        .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
}

export async function createAgenda(userId, name, options = {}) {
    const { setAsCurrent = true, avatar = null, color = '#3b82f6', sortCompletedTasks = true } = options;

    const payload = {
        uid: userId,
        name: (name || '').trim() || 'Nova agenda',
        avatar: (avatar || '').trim() || null,
        color: (color || '').trim() || '#3b82f6',
        sort_completed_tasks: sortCompletedTasks,
    };

    let agendaData = null;

    const { data, error } = await supabase
        .from('agendas')
        .insert(payload)
        .select('*')
        .single();

    if (error) {
        const shouldRetryWithoutColorOrSort = /column\s+"?(color|sort_completed_tasks)"?\s+of relation\s+"?agendas"? does not exist|Could not find the '(color|sort_completed_tasks)' column/i.test(error.message || '');
        if (!shouldRetryWithoutColorOrSort) throw error;

        const { color: _ignoredColor, sort_completed_tasks: _ignoredSort, ...payloadWithoutColorOrSort } = payload;
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

    return agendaData;
}

export async function updateAgendaName(userId, agendaId, name, avatar = null, color = '#3b82f6', sortCompletedTasks = null) {
    const nextName = (name || '').trim();
    if (!nextName) throw new Error('Agenda name is required.');

    const nextAvatar = (avatar || '').trim() || null;
    const nextColor = (color || '').trim() || '#3b82f6';

    const fullPayload = { name: nextName, avatar: nextAvatar, color: nextColor };
    if (sortCompletedTasks !== null) {
        fullPayload.sort_completed_tasks = sortCompletedTasks;
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
        const shouldRetryWithoutColor = /column\s+"?color"?\s+of relation\s+"?agendas"? does not exist|Could not find the 'color' column/i.test(firstTry.error.message || '');
        if (!shouldRetryWithoutColor) throw firstTry.error;

        const retry = await supabase
            .from('agendas')
            .update({ name: nextName, avatar: nextAvatar })
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

export async function getPublicAgendaByShareToken(shareToken) {
    const { data: agenda, error: agendaError } = await supabase
        .from('agendas')
        .select('*')
        .eq('share_token', shareToken)
        .maybeSingle();

    if (agendaError) throw agendaError;
    if (!agenda || !agenda.share_enabled) return null;

    const { data: owner, error: ownerError } = await supabase
        .from('users')
        .select('id, name, language, date_format, week_starts_on')
        .eq('id', agenda.uid)
        .maybeSingle();

    if (ownerError) throw ownerError;
    if (!owner) return null;

    const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('uid', owner.id)
        .eq('agenda_id', agenda.id)
        .order('order');

    if (tasksError) throw tasksError;

    return {
        owner: {
            id: owner.id,
            name: owner.name,
            language: owner.language || 'ptBR',
            dateFormat: owner.date_format || 'DD-MM',
            weekStartsOn: owner.week_starts_on || 'Monday',
        },
        agenda: {
            id: agenda.id,
            name: agenda.name,
            avatar: agenda.avatar || '',
            color: agenda.color || '#3b82f6',
        },
        tasks: (tasks || []).map(task => ({ ...task, date: parseDateOnly(task.date) })),
    };
}
