import React from "react";

export default function CompletedTaskCheckIcon({ className = "", ...props }) {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            {...props}
        >
            <path
                d="M12 1C5.95 1 1 5.95 1 12C1 18.05 5.95 23 12 23C18.05 23 23 18.05 23 12C23 5.95 18.05 1 12 1ZM16.62 10.13L11.34 15.41C10.9 15.85 10.24 15.85 9.8 15.41L7.38 12.99C6.94 12.55 6.94 11.89 7.38 11.45C7.82 11.01 8.48 11.01 8.92 11.45L10.57 13.1L15.08 8.59C15.52 8.15 16.18 8.15 16.62 8.59C17.06 9.03 17.06 9.69 16.62 10.13Z"
                fill="currentColor"
            />
        </svg>
    );
}
