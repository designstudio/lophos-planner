import { supabase } from './supabase.js';
import levenshtein from 'js-levenshtein';

const MAX_LEVENSHTEIN_DISTANCE = 3;

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
    return { ...task, date: new Date(task.date) };
}

export async function getUserTasks(userId) {
    if (!userId || userId === 'undefined') {
        return [];
    }

    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('uid', userId);

    if (error) throw error;
    return data.map(task => ({ ...task, date: new Date(task.date) }));
}

export async function getSearchedTasks(userId, query) {
    const tasks = await getUserTasks(userId);
    return tasks
        .filter(task => levenshtein(task.name, query) <= MAX_LEVENSHTEIN_DISTANCE)
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
        .single();

    if (fetchError) throw fetchError;

    const { data: subsequent, error: queryError } = await supabase
        .from('tasks')
        .select('id, order')
        .eq('date', taskData.date)
        .gt('order', taskData.order);

    if (queryError) throw queryError;

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

// Users CRUD

export async function createUser(id, data) {
    const { error } = await supabase.from('users').insert({
        id,
        email: data.email,
        name: data.name,
        dark_mode: data.darkMode ?? false,
    });

    if (error) throw error;
}

export async function getCurrentUser(id) {
    if (!id) return null;

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error || !data) return null;

    return {
        uid: data.id,
        email: data.email,
        name: data.name,
        darkMode: data.dark_mode,
    };
}

export async function updateUserData(id, data) {
    const { error } = await supabase
        .from('users')
        .update({ name: data.name, dark_mode: data.darkMode })
        .eq('id', id);

    if (error) throw error;
}
