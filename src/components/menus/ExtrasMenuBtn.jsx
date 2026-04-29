export function ExtrasMenuBtn({ text, icon: Icon, onClick }) {
    return (
        <li className="w-full flex justify-between items-center rounded-[12px] px-3.5 py-2 text-sm bg-transparent hover:bg-[#f2f2f2] dark:hover:bg-stone-900 cursor-pointer transition-colors"
            onClick={onClick}>
            <p>{text}</p>
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                {Icon && <Icon className="h-[18px] w-[18px]" />}
            </span>
        </li>
    )
}
