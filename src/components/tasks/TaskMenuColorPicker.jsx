import TaskMenuBtn from "./TaskMenuBtn.jsx";

export const ALLOWED_COLORS = new Set([
    "ds-background-surface text-ds-text-default",
    "ds-warning-solid text-ds-text-on-accent",
    "ds-success-solid text-ds-text-inverse",
    "ds-danger-solid text-ds-text-inverse",
]);

export function TaskMenuColorPicker({ setColor }) {

    const colors = [...ALLOWED_COLORS];

    return (
        <div className="task-menu-color-picker w-20 -translate-x-[50%] rounded-xl border border-ds-border-default bg-ds-background-surface p-4 z-20 text-center"
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
