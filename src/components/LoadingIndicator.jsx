export default function LoadingIndicator({ size = 80, className = "" }) {
    return (
        <div
            className={`inline-flex items-center justify-center ${className}`.trim()}
            aria-label="Carregando"
            role="status"
        >
            <span
                className="block animate-spin rounded-ds-full border-4 border-ds-border-default border-t-ds-text-default"
                style={{ width: size, height: size }}
                aria-hidden="true"
            />
        </div>
    );
}
