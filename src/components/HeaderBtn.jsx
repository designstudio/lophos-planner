import React from 'react'

export function HeaderBtn({textColor, bgColor, icon: Icon, onClick, tooltip=null, style}) {
  return (
    <button
        className={`${bgColor} app-button-hover rounded-full flex justify-center
        items-center w-8 h-8 lg:w-10 lg:h-10 flex-1 relative group`}
        onClick={onClick}
        style={style}
        >
        {Icon && <Icon className={`h-4 w-4 lg:h-5 lg:w-5 ${textColor}`} />}
        { tooltip && <p className="absolute left-1/2 -translate-x-[50%] top-[120%]
        opacity-0 group-hover:opacity-100 transition ease-linear duration-200
         text-white bg-gray-800 rounded text-xs p-1">{tooltip}</p> }
    </button>
  )
}

export default HeaderBtn;

