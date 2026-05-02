export function ExtrasMenuBtn({ text, icon: Icon, onClick }) {
    return (
        <li>
            <button
                type="button"
                className="w-full flex items-center gap-2 rounded-[12px] px-3.5 py-2 text-left text-sm bg-transparent hover:bg-[#f2f2f2] dark:hover:bg-stone-900 cursor-pointer transition-colors focus:outline-none focus-visible:bg-[#f2f2f2]"
                onClick={onClick}
            >
                {Icon && (
                    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                        <Icon className="h-[18px] w-[18px]" />
                    </span>
                )}
                <span>{text}</span>
            </button>
        </li>
    )
}
