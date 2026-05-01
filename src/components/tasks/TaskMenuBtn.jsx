import React from 'react'

export default function TaskMenuBtn({icon: Icon, iconClassName, onClick, disabled, tooltip = null, buttonClassName = ""}) {
    const [isTooltipVisible, setIsTooltipVisible] = React.useState(false);

    return (
        <div className="inline rounded-full border border-transparent">
            <button
                type="button"
                className={`task-menu-icon-btn relative ${buttonClassName}`}
                onClick={ev => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    onClick?.(ev);
                }}
                onMouseEnter={() => setIsTooltipVisible(true)}
                onMouseLeave={() => setIsTooltipVisible(false)}
                onFocus={() => setIsTooltipVisible(false)}
                onBlur={() => setIsTooltipVisible(false)}
                disabled={disabled}
            >
                {Icon ? (
                    <Icon className={`h-4 w-4 lg:h-[18px] lg:w-[18px] ${disabled ? "opacity-50" : ""}`} />
                ) : (
                    <span className={`${iconClassName} ${disabled ? "opacity-50" : ""}`}></span>
                )}
                {tooltip && (
                    <p
                        className={`pointer-events-none absolute left-1/2 top-[120%] -translate-x-[50%] whitespace-pre rounded bg-gray-800 p-1 text-xs text-white transition ease-linear duration-150 ${
                            isTooltipVisible ? "opacity-100" : "opacity-0"
                        }`}
                    >
                        {tooltip}
                    </p>
                )}
            </button>
        </div>
    )
}

 
