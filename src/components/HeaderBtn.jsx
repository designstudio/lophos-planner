import React from 'react'

export function HeaderBtn({textColor, bgColor, icon: Icon, onClick, tooltip=null, style, className=""}) {
  return (
    <button
        className={`${bgColor} ${className} app-button-hover header-menu-btn rounded-full flex justify-center
        items-center w-8 h-8 lg:w-10 lg:h-10 flex-1 relative group`}
        onClick={onClick}
        style={style}
        >
        {Icon && <Icon className={`h-4 w-4 lg:h-5 lg:w-5 ${textColor}`} />}
        { tooltip && <p className="absolute left-1/2 top-[120%] -translate-x-[50%]
        whitespace-nowrap opacity-0 group-hover:opacity-100 transition ease-linear duration-200
         text-white tooltip-surface rounded text-xs p-1 pointer-events-none z-50">{tooltip}</p> }
    </button>
  )
}

export default HeaderBtn;

