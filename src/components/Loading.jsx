export default function Loading({ text }) {
    return (
        <div className="w-full dark:text-white h-screen py-20 flex flex-col justify-center items-center">
            <h2 className="text-2xl font-bold">Loading {text}...</h2>
            <i className="fa-solid fa-hurricane fa-spin text-6xl"></i>
        </div>
    );
}
