import React from 'react'

export default function HeaderBtn({textColor, bgColor, icon, onClick, tooltip=null}) {
  return (
    <button
        className={`bg-${bgColor} rounded-full flex justify-center
        items-center w-8 h-8 lg:w-10 lg:h-10 flex-1 hover:shadow-lg relative group`}
        onClick={onClick}
        >
        <i className={`${icon} lg:text-lg text-${textColor}`}></i>
        { tooltip && <p className="absolute left-1/2 -translate-x-[50%] top-[120%]
        opacity-0 group-hover:opacity-100 transition ease-linear duration-200
         text-white bg-gray-800 rounded text-xs p-1">{tooltip}</p> }
    </button>
  )
}

