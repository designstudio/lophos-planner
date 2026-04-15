import { Link } from "react-router-dom";
import { closeForm, setStoredWeekShift, toShortId } from "../../scripts/utils.js";
import { ALLOWED_COLORS } from "./TaskMenuColorPicker.jsx";
import { StickerSquare } from "@untitledui/icons";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { formatDayMonth, getAppLanguage } from "../../scripts/i18n.js";

export default function SearchTask({ data, date, }) {
    const MAX_TASK_NAME_LENGTH = 34;
    const { currentUser } = useAuth();
    const language = getAppLanguage(currentUser?.language);
    const dateFormat = currentUser?.dateFormat || "DD-MM";
    const weekStartsOn = currentUser?.weekStartsOn || "Monday";

    const taskDate = new Date(+date);
    const today = new Date();
    taskDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    function getStartOfWeek(refDate) {
        const start = new Date(refDate);
        const weekStartIndex = weekStartsOn === "Sunday" ? 0 : 1;
        const offset = (start.getDay() - weekStartIndex + 7) % 7;
        start.setDate(start.getDate() - offset);
        start.setHours(0, 0, 0, 0);
        return start;
    }


    const taskWeekStart = getStartOfWeek(taskDate);
    const todayWeekStart = getStartOfWeek(today);
    const weekShift = Math.round((taskWeekStart - todayWeekStart) / (7 * 24 * 60 * 60 * 1000));

    function handleClick(ev) {
        setStoredWeekShift(weekShift);
        closeForm("search-form");
        document.getElementById("search-task-name").value = "";
        document.querySelector(".clear-search").classList.add("hidden");
    }

    return (
        <Link to={`/?task=${toShortId(data.id)}`} className="group w-full border-b border-gray-300" onClick={handleClick}>
            <div className="task flex justify-between items-center h-[41px] px-0 cursor-pointer">
                <h5 className={`task-title min-w-0 flex-1 flex items-center gap-1 px-0 py-0 text-[14px] font-normal leading-[41px] bg-${ALLOWED_COLORS.has(data.color) ? data.color : "white text-black dark:text-white dark:bg-black"} ` + (data.done && "opacity-40 line-through ") || ''}
                >{ data.description && <StickerSquare className="h-4 w-4 shrink-0" /> } <span className="truncate">{data.name.slice(0, MAX_TASK_NAME_LENGTH) +
                    (data.name.length > MAX_TASK_NAME_LENGTH ? "..." : "")}</span></h5>
                <p className="text-gray-400">
                    {formatDayMonth(date, language, dateFormat)}
                </p>

            </div>
        </Link>
    )
}
