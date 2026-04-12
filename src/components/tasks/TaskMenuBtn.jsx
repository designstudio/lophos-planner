import React from 'react'

export default function TaskMenuBtn({icon: Icon, iconClassName, onClick, disabled, tooltip = null}) {
    return (
        <div className="inline rounded-full border border-transparent cursor-pointer">
            <button
                type="button"
                className={`task-menu-icon-btn relative group/task-btn`}
                onClick={ev => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    onClick?.(ev);
                }}

                disabled={disabled}
            >
                {Icon ? (
                    <Icon className={`h-4 w-4 lg:h-[18px] lg:w-[18px] ${disabled ? "opacity-50" : ""}`} />
                ) : (
                    <span className={`${iconClassName} ${disabled ? "opacity-50" : ""}`}></span>
                )}
                {tooltip && <p className="absolute whitespace-pre left-1/2 -translate-x-[50%] top-[120%]
            opacity-0 group-hover/task-btn:opacity-100 transition ease-linear duration-200
             text-white bg-gray-800 rounded text-xs p-1">{tooltip}</p>}
            </button>
        </div>
    )
}

 
