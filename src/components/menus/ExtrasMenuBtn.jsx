export function ExtrasMenuBtn({ text, icon, onClick }) {
    return (
        <li className="w-full flex justify-between items-center text-sm px-2 py-1
        bg-white dark:bg-stone-800 hover:bg-purple-200 dark:hover:bg-stone-900 cursor-pointer"
            onClick={onClick}>
            <p>{text}</p>
            <i className={icon}></i>
        </li>
    )
}