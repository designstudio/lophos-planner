import TaskMenuBtn from "./TaskMenuBtn.jsx";

export const ALLOWED_COLORS = new Set([
    "white text-black dark:text-white dark:bg-black",
    "amber-500 text-black",
    "green-500 text-white",
    "red-500 text-white",
]);

export function TaskMenuColorPicker({ setColor }) {

    const colors = [...ALLOWED_COLORS];

    return (
        <div className="task-menu-color-picker bg-[#dfe2ff] border border-[#aeb5dd] rounded-xl w-20 py-4 z-20 -translate-x-[50%] text-center"
             onClick={ev => ev.stopPropagation()}>
            <div className="flex gap-2 flex-wrap justify-center">
                {
                    colors.map((color, ind) => {
                        return (
                            <TaskMenuBtn key={ind} iconClassName={`inline-block rounded-full w-3 h-3 bg-${color}`} disabled={false}
                                         onClick={() => setColor(color)} />
                        )
                    })
                }
            </div>
        </div>
    )
}
