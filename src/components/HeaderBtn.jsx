import React from 'react'

export function HeaderBtn({textColor, iconColor, bgColor, backgroundColor, icon: Icon, onClick, tooltip=null, style, className="", ariaLabel}) {
  const buttonStyle = {
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(style || {}),
  };

  const iconStyle = iconColor ? { color: iconColor } : undefined;

  return (
    <button
        type="button"
        className={`${bgColor} ${className} app-button-hover header-menu-btn flex justify-center
        items-center w-10 h-10 flex-1 relative group`}
        onClick={onClick}
        style={buttonStyle}
        aria-label={ariaLabel || tooltip || undefined}
        >
        {Icon && <Icon className={`h-4 w-4 lg:h-5 lg:w-5 ${textColor}`} style={iconStyle} />}
        { tooltip && <p className="absolute left-1/2 top-[120%] -translate-x-[50%]
        whitespace-nowrap opacity-0 group-hover:opacity-100 transition ease-linear duration-200
         text-ds-text-inverse tooltip-surface ds-type-caption p-1 pointer-events-none z-50">{tooltip}</p> }
    </button>
  )
}

export default HeaderBtn;

