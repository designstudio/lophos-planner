export function ExtrasMenuBtn({ text, icon: Icon, onClick }) {
    return (
        <li>
            <button
                type="button"
                className="ds-menu-item ds-type-body-sm w-full flex items-center gap-2 rounded-ds-lg px-3.5 py-2 text-left cursor-pointer focus:outline-none"
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
