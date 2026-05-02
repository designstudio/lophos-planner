import { Hurricane02 } from "@untitledui/icons";

export default function Loading({ text }) {
    return (
        <div className="w-full dark:text-white h-screen py-20 flex flex-col justify-center items-center">
            {text ? <h2 className="text-2xl font-bold">{text}</h2> : null}
            <Hurricane02 className="h-16 w-16 animate-spin" />
        </div>
    );
}
