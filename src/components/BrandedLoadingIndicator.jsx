import React from "react";
import LoadingIndicator from "./LoadingIndicator.jsx";

export default function BrandedLoadingIndicator({ size = 80, className = "" }) {
    const [LottieComponent, setLottieComponent] = React.useState(null);
    const [animationData, setAnimationData] = React.useState(null);

    React.useEffect(() => {
        let cancelled = false;

        async function loadAnimation() {
            try {
                const [{ default: NextLottie }, { default: nextAnimationData }] = await Promise.all([
                    import("lottie-react"),
                    import("../assets/todo-loading.json"),
                ]);

                if (cancelled) return;
                setLottieComponent(() => NextLottie);
                setAnimationData(nextAnimationData);
            } catch {
                if (cancelled) return;
                setLottieComponent(null);
                setAnimationData(null);
            }
        }

        loadAnimation();

        return () => {
            cancelled = true;
        };
    }, []);

    if (!LottieComponent || !animationData) {
        return <LoadingIndicator size={size} className={className} />;
    }

    return (
        <div className={`inline-flex items-center justify-center ${className}`.trim()} aria-label="Carregando" role="status">
            <LottieComponent animationData={animationData} loop style={{ width: size, height: size }} />
        </div>
    );
}
