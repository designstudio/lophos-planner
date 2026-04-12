export function ExtrasMenuBtn({ text, icon: Icon, onClick }) {
    return (
        <li className="w-full flex justify-between items-center text-sm px-3 py-1.5
        bg-white dark:bg-stone-800 hover:bg-[#f2f2f2] dark:hover:bg-stone-900 cursor-pointer"
            onClick={onClick}>
            <p>{text}</p>
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                {Icon && <Icon className="h-[18px] w-[18px]" />}
            </span>
        </li>
    )
}