import React from 'react'

export default function TaskMenuBtn({icon, onClick, disabled, tooltip = null}) {
    return (
        <div
            className="inline px-1.5 py-0.5 rounded-full border border-transparent hover:border-gray-400 cursor-pointer"
            onClick={onClick}>
            <button
                className={`relative group/task-btn`}

                disabled={disabled}
            >
                <i className={`${icon} lg:text-sm ${disabled && "opacity-50"}`}></i>
                {tooltip && <p className="absolute whitespace-pre left-1/2 -translate-x-[50%] top-[120%]
            opacity-0 group-hover/task-btn:opacity-100 transition ease-linear duration-200
             text-white bg-gray-800 rounded text-xs p-1">{tooltip}</p>}
            </button>
        </div>
    )
}

 