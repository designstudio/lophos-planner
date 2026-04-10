import {db} from "./firebase.js";
import {
    collection,
    addDoc,
    doc,
    getDoc,
    getDocs,
    deleteDoc,
    updateDoc,
    query,
    where,
    setDoc,
    increment,

} from "firebase/firestore";
import levenshtein from "js-levenshtein";

const taskColRef = collection(db, "tasks");
const userColRef = collection(db, "users");

const MAX_LEVENSHTEIN_DISTANCE = 3;

export function sleep(time) {
    return new Promise(resolve => {
        setTimeout(resolve, time);
    });
}

export function tryCatchDecorator(func) {

    return async function () {
        try {
            const data = await func.call(this, ...arguments);
            return {
                success: true,
                data,
            }
        } catch (err) {
            console.log(err.message);
            return {
                success: false,
                message: err.message,
            }
        }
    }
}

// Tasks CRUD

export async function createTask(data) {
    const docRef = await addDoc(taskColRef, data);
    const newTask = await getDoc(docRef);
    console.log(`creating task ${data.name} ${data.order}`)
    return {
        ...newTask.data(),
        id: newTask.id,
    };
}

export async function getUserTasks(userId) {
    console.log(userId);
    // await sleep(1000);
    const q = query(taskColRef,
        where("uid", "==", userId || "null"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        date: new Date(doc.data().date),
    }))
}

export async function getSearchedTasks(userId, query) {
    const tasks = await getUserTasks(userId);
    return tasks.filter(task => levenshtein(task.name, query) <= MAX_LEVENSHTEIN_DISTANCE).slice(0, 10);
}

export async function updateTask(taskId, data) {
    console.log(`updating task ${taskId}`);
    console.log(data);
    const taskRef = doc(db, "tasks", taskId);
    await updateDoc(taskRef, data);
}

export async function deleteTask(taskId) {

    const taskRef = doc(db, "tasks", taskId);
    const taskData = (await getDoc(taskRef)).data();
    console.log("in delete", taskData);
    const q = query(taskColRef, where("date", "==", taskData.date),
        where("order", ">", taskData.order));
    (await getDocs(q)).docs.map(async doc => {
        await updateDoc(doc.ref, {
            order: increment(-1),
        })
    });
    console.log("in delete 2", taskData);
    await deleteDoc(taskRef);
}

export async function reOrderTasks(reOrdered) {

    reOrdered.map(async (task, index) => {
        console.log(task.id, task.name, index);
        await updateDoc(doc(db, "tasks", task.id), {
            order: index,
        });
    })
}

export async function toggleDoneTask(taskId) {
    const taskRef = doc(db, "tasks", taskId);
    const taskDone = (await getDoc(taskRef)).data().done;
    await updateDoc(taskRef, {
        done: !taskDone,
    });
}

export async function clearUsersTasks(userId) {
    const tasks = await getUserTasks(userId);
    console.log(`deleting ${tasks.length}`)
    tasks.map(async ({ id }) => {
        await deleteDoc(doc(db, "tasks", id));
    })
}

// Users CRUD

export async function createUser(id, data) {
    console.log('in create user', id, data);
    await setDoc(doc(db, 'users', id), data);
}

export async function getCurrentUser(id) {
    if (!id) return null;
    const userRef = doc(db, 'users', id);
    const userSnapshot = await getDoc(userRef);
    return {
        uid: userSnapshot.id,
        ...userSnapshot.data(),
    }
}

export async function updateUserData(id, data) {
    const userRef = doc(db, 'users', id);
    await updateDoc(userRef, data);
}

