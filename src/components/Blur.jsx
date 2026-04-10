import { updateTask, tryCatchDecorator } from "../scripts/api.js";

export default function Blur({ children, type, bgColor="bg-white" }) {

    async function handleTaskMenuClose(ev) {
        ev.stopPropagation();
        ev.target.classList.remove('active');
        const form = ev.target.querySelector(".task-menu-form");
        if (form) {
            const formData = new FormData(form);
            console.log({
                name: formData.get("task-name"),
                done: formData.has("task-done"),
                color: formData.get("task-color"),
                description: formData.get("task-description"),
            });

            await tryCatchDecorator(updateTask)(formData.get("task-id"), {
                name: formData.get("task-name"),
                done: formData.has("task-done"),
                color: formData.get("task-color"),
                description: formData.get("task-description"),
            });
            const colorPicker = ev.target.querySelector(".task-menu-color-picker");
            colorPicker.classList.remove("active");
        }
        document.body.style.overflowY = 'auto';
    }

    return (
        <div data-id={type} className={`blur-bg ${bgColor} bg-opacity-70 dark:bg-opacity-0 fixed top-0 left-0 h-full w-full z-10
        transition-all duration-300 ease-linear cursor-default flex justify-center items-start`} onClick={handleTaskMenuClose} >
            { children }
        </div>
    )
}
