export default function LoadingIndicator({ size = 80, className = "" }) {
    return (
        <div
            className={`inline-flex items-center justify-center ${className}`.trim()}
            aria-label="Carregando"
            role="status"
        >
            <span
                className="block animate-spin rounded-full border-[4px] border-black/10 border-t-black"
                style={{ width: size, height: size }}
                aria-hidden="true"
            />
        </div>
    );
}
