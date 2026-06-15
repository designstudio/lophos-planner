import React from "react";

function normalizeHex(value) {
    const raw = String(value || "").trim().replace(/^#/, "");
    if (!/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(raw)) return null;

    if (raw.length === 3) {
        return `#${raw.split("").map(char => char + char).join("").toLowerCase()}`;
    }

    return `#${raw.toLowerCase()}`;
}

function rgbToHex(red, green, blue) {
    return `#${[red, green, blue].map(channel => channel.toString(16).padStart(2, "0")).join("")}`;
}

function resolveColorToHex(colorValue, fallback = "#919603") {
    const normalized = normalizeHex(colorValue);
    if (normalized) return normalized;

    if (typeof window === "undefined" || !colorValue) return fallback;

    const temp = document.createElement("span");
    temp.style.color = colorValue;
    temp.style.position = "absolute";
    temp.style.opacity = "0";
    temp.style.pointerEvents = "none";
    document.body.appendChild(temp);

    const resolved = window.getComputedStyle(temp).color;
    document.body.removeChild(temp);

    const match = resolved.match(/\d+/g);
    if (!match || match.length < 3) return fallback;

    return rgbToHex(Number(match[0]), Number(match[1]), Number(match[2]));
}

export default function AgendaColorHexInput({
    value,
    onChange,
    ariaLabel,
}) {
    const [inputValue, setInputValue] = React.useState(() => resolveColorToHex(value));

    React.useEffect(() => {
        setInputValue(resolveColorToHex(value));
    }, [value]);

    function handleChange(event) {
        const nextValue = event.target.value;
        setInputValue(nextValue);

        const normalized = normalizeHex(nextValue);
        if (normalized) {
            onChange(normalized);
        }
    }

    function handleBlur() {
        const normalized = normalizeHex(inputValue);
        setInputValue(normalized || resolveColorToHex(value));
    }

    return (
        <div className="flex items-center gap-2 rounded-full border border-ds-border-default bg-ds-background-surface px-3 py-2">
            <span
                className="h-7 w-7 shrink-0 rounded-full"
                style={{ backgroundColor: resolveColorToHex(value) }}
            />
            <input
                type="text"
                value={inputValue}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="#000000"
                className="ds-type-body-sm w-20 bg-transparent text-ds-text-default placeholder:text-ds-text-subtle focus:outline-none"
                aria-label={ariaLabel}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
            />
        </div>
    );
}
