import React from "react";
import ReactDOM from "react-dom";
import { ChevronDown } from "@untitledui/icons";

function isSameValue(left, right) {
    return String(left) === String(right);
}

export default function OptionMenuSelect({
    value,
    options,
    onChange,
    disabled = false,
    placeholder = "-",
    wrapperClassName = "",
    triggerClassName = "",
    menuClassName = "",
    optionClassName = "",
    selectedOptionClassName = "",
    portalGap = 4,
    portalAnchorRef = null,
}) {
    const rootRef = React.useRef(null);
    const triggerRef = React.useRef(null);
    const menuRef = React.useRef(null);
    const optionRefs = React.useRef([]);
    const [isOpen, setIsOpen] = React.useState(false);
    const [menuStyle, setMenuStyle] = React.useState(null);
    const [highlightedIndex, setHighlightedIndex] = React.useState(() => {
        const selectedIndex = options.findIndex(option => isSameValue(option.value, value));
        return selectedIndex >= 0 ? selectedIndex : 0;
    });

    const selectedOption = React.useMemo(() => {
        return options.find(option => isSameValue(option.value, value)) || options[0];
    }, [options, value]);

    React.useEffect(() => {
        if (!isOpen) return;

        function handlePointerDown(ev) {
            if (!rootRef.current?.contains(ev.target) && !menuRef.current?.contains(ev.target)) {
                setIsOpen(false);
            }
        }

        function handleScroll() {
            setIsOpen(false);
        }

        function handleEscape(ev) {
            if (ev.key === "Escape") {
                setIsOpen(false);
            }
        }

        window.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("keydown", handleEscape);
        window.addEventListener("scroll", handleScroll, { passive: true, capture: true });

        return () => {
            window.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("keydown", handleEscape);
            window.removeEventListener("scroll", handleScroll, true);
        };
    }, [isOpen]);

    React.useEffect(() => {
        const selectedIndex = options.findIndex(option => isSameValue(option.value, value));
        setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }, [options, value]);

    React.useLayoutEffect(() => {
        if (!isOpen) return;

        function updateMenuPosition() {
            const triggerEl = triggerRef.current;
            const anchorEl = portalAnchorRef?.current || triggerEl;
            const menuEl = menuRef.current;
            if (!anchorEl || !menuEl) return;

            const triggerRect = anchorEl.getBoundingClientRect();
            const menuRect = menuEl.getBoundingClientRect();
            const gap = portalGap;

            let top = triggerRect.bottom + gap;
            if (top + menuRect.height > window.innerHeight - gap) {
                top = Math.max(gap, triggerRect.top - gap - menuRect.height);
            }

            const left = Math.max(
                gap,
                Math.min(triggerRect.left, window.innerWidth - menuRect.width - gap),
            );

            setMenuStyle({
                position: "fixed",
                top: `${top}px`,
                left: `${left}px`,
                minWidth: `${triggerRect.width}px`,
            });
        }

        const rafId = window.requestAnimationFrame(updateMenuPosition);
        window.addEventListener("resize", updateMenuPosition);
        window.addEventListener("scroll", updateMenuPosition, { passive: true, capture: true });

        return () => {
            window.cancelAnimationFrame(rafId);
            window.removeEventListener("resize", updateMenuPosition);
            window.removeEventListener("scroll", updateMenuPosition, true);
        };
    }, [isOpen, options.length, value]);

    React.useEffect(() => {
        if (!isOpen) return;
        optionRefs.current[highlightedIndex]?.focus?.();
    }, [highlightedIndex, isOpen]);

    function handleToggle() {
        if (disabled) return;
        if (!isOpen) {
            const triggerEl = triggerRef.current;
            const anchorEl = portalAnchorRef?.current || triggerEl;
            if (anchorEl) {
                const triggerRect = anchorEl.getBoundingClientRect();
                const gap = portalGap;
                const left = Math.max(
                    gap,
                    Math.min(triggerRect.left, window.innerWidth - triggerRect.width - gap),
                );

                setMenuStyle({
                    position: "fixed",
                    top: `${triggerRect.bottom + gap}px`,
                    left: `${left}px`,
                    minWidth: `${triggerRect.width}px`,
                });
            }
        }

        setIsOpen(prev => !prev);
    }

    function handleSelect(nextValue) {
        onChange(nextValue);
        setIsOpen(false);
        triggerRef.current?.focus();
    }

    function openMenu() {
        if (disabled) return;
        if (!isOpen) {
            const selectedIndex = options.findIndex(option => isSameValue(option.value, value));
            setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
        }
        handleToggle();
    }

    function handleTriggerKeyDown(ev) {
        if (disabled) return;

        if (ev.key === "ArrowDown" || ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            if (!isOpen) {
                openMenu();
            }
        }

        if (ev.key === "ArrowUp") {
            ev.preventDefault();
            if (!isOpen) {
                const selectedIndex = options.findIndex(option => isSameValue(option.value, value));
                setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : Math.max(options.length - 1, 0));
                handleToggle();
            }
        }
    }

    function handleOptionKeyDown(ev, index) {
        if (ev.key === "ArrowDown") {
            ev.preventDefault();
            setHighlightedIndex(prev => Math.min(prev + 1, options.length - 1));
            return;
        }

        if (ev.key === "ArrowUp") {
            ev.preventDefault();
            setHighlightedIndex(prev => Math.max(prev - 1, 0));
            return;
        }

        if (ev.key === "Home") {
            ev.preventDefault();
            setHighlightedIndex(0);
            return;
        }

        if (ev.key === "End") {
            ev.preventDefault();
            setHighlightedIndex(Math.max(options.length - 1, 0));
            return;
        }

        if (ev.key === "Escape") {
            ev.preventDefault();
            setIsOpen(false);
            triggerRef.current?.focus();
            return;
        }

        if (ev.key === "Tab") {
            setIsOpen(false);
            return;
        }

        if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            handleSelect(options[index].value);
        }
    }

    return (
        <div ref={rootRef} className={`relative ${wrapperClassName}`.trim()}>
            <button
                ref={triggerRef}
                type="button"
                className={`flex w-full items-center justify-between gap-2 ${triggerClassName}`}
                onClick={handleToggle}
                onKeyDown={handleTriggerKeyDown}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className="min-w-0 flex-1 whitespace-nowrap text-left">
                    {selectedOption?.label ?? placeholder}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-black" />
            </button>

            {isOpen && typeof document !== "undefined" && ReactDOM.createPortal(
                <div
                    ref={menuRef}
                    className={`z-[80] option-menu-surface p-1 ${menuStyle ? "opacity-100" : "opacity-0"} ${menuClassName}`}
                    style={menuStyle || undefined}
                    role="listbox"
                >
                    {options.map(option => {
                        const isSelected = isSameValue(option.value, value);
                        const optionIndex = options.findIndex(item => isSameValue(item.value, option.value));
                        const isHighlighted = optionIndex === highlightedIndex;

                        return (
                            <button
                                key={String(option.value)}
                                ref={el => {
                                    optionRefs.current[optionIndex] = el;
                                }}
                                type="button"
                                className={[
                                    "block w-full whitespace-nowrap rounded-[12px] px-4 py-2 text-left text-sm text-black transition-colors bg-transparent hover:bg-[#f2f2f2] focus-visible:outline-none focus-visible:bg-[#f2f2f2] focus-visible:ring-2 focus-visible:ring-black/10",
                                    isSelected ? `bg-[#f2f2f2] hover:bg-[#f2f2f2] ${selectedOptionClassName}` : "",
                                    isHighlighted && !isSelected ? "bg-[#f2f2f2]" : "",
                                    optionClassName,
                                ].filter(Boolean).join(" ")}
                                onClick={() => handleSelect(option.value)}
                                onKeyDown={ev => handleOptionKeyDown(ev, optionIndex)}
                                role="option"
                                aria-selected={isSelected}
                                tabIndex={isHighlighted ? 0 : -1}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>,
                document.body
            )}
        </div>
    );
}
