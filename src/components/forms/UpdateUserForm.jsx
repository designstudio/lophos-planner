import {Form, redirect, useActionData, useLoaderData} from "react-router-dom";
import Blur from "../Blur.jsx";

import {useAuth} from "../../contexts/AuthContext.jsx";
import {useState} from "react";

export const action = (AuthContext) => async ({ request }) => {

    const formData = await request.formData();
    const { updateUser } = AuthContext;
    const name = formData.get("name"),
        email = formData.get("email"),
        password = formData.get("password"),
        passwordConfirm = formData.get("confirmPassword"),
        darkMode = formData.get("dark-mode") === "on";
    if (passwordConfirm !== password) {
        return "Passwords don't match";
    }
    await updateUser(email, password, { name, darkMode })
    return redirect("/");
}

export default function UpdateUserForm() {

    const errorMessage = useActionData();

    const {currentUser} = useAuth();
    // TODO: save button must be disabled if any data isn't changed
    const [dataChanged, setDataChanged] = useState();

    function closeBlur(ev) {
        const blur = document.querySelector('[data-id="update-user-form"]');
        console.log(blur);
        blur.classList.remove("active");
    }
    return (
        <Blur type="update-user-form">
            <div className="update-user-form relative top-10 bg-[#e5d7fa] top-10 rounded-xl p-4 lg:p-8 w-[28rem]
            z-20 text-gray-600 transition-all duration-500 ease-linear"
                 onClick={ev => ev.stopPropagation()}>
                <h3 className="font-bold text-xl tracking-tight">Account</h3>

                {errorMessage && typeof errorMessage === "string" && <h3
                    className="rounded-md px-2 text-sm bg-red-500 text-black py-3 my-1">
                    {errorMessage}</h3>}
                <Form method="POST" className="relative" action="/update-user" >

                    <div className="w-full flex gap-3 items-center my-4 pb-2 px-2 border-b border-black">
                        <i className="fa-solid fa-moon text-2xl"></i>
                        <div className="flex-1">
                            <p className="font-bold text-xs">Dark Mode</p>
                            <p className="leading-4 text-sm">Switch interface to dark theme</p>
                        </div>
                        <button className={`h-4 w-10 border border-black ${currentUser?.darkMode && "active"}
                        rounded-full relative top-1 [&.active]:bg-black group/dark-mode
                        `}
                        onClick={ev => {
                            ev.currentTarget.classList.toggle("active");
                            document.getElementById("dark-mode").checked = ev.currentTarget.classList.contains("active");
                            localStorage.setItem("theme", ev.currentTarget.classList.contains("active") ? "dark" : "light");
                        }}>

                            <div className="h-4 w-4 absolute rounded-full border border-black bg-black
                         top-[-1px] left-0 group-[.active]/dark-mode:left-6 group-[.active]/dark-mode:bg-[#e5d7fa] flex justify-center items-center">

                                <i className="fa-solid fa-check text-black text-xs"></i>
                            </div>
                        </button>
                    </div>
                    <input type="checkbox" defaultChecked={ currentUser?.darkMode } name="dark-mode" id="dark-mode" className="hidden" />
                    <input type="text" defaultValue="update-user-form" name="form-id" id="form-id" className="hidden"/>
                    <input type="text" id="name" name="name" required placeholder="Name" defaultValue={currentUser?.name}
                           className="w-full my-2 py-1 border-b border-gray-600 bg-transparent indent-1 focus:outline-none"/>
                    <input type="email" id="email" name="email" required placeholder="Email" defaultValue={currentUser?.email}
                           className="w-full my-2 py-1 border-b border-gray-600 bg-transparent indent-1 focus:outline-none"/>
                    <input type="password" id="password" name="password" placeholder="Password"
                           className="w-full my-2 py-1 border-b border-gray-600 bg-transparent indent-1 focus:outline-none"/>
                    <input type="password" id="confirmPassword" name="confirmPassword" placeholder="Confirm Password"
                           className="w-full my-2 py-1 border-b border-gray-600 bg-transparent indent-1 focus:outline-none"/>

                    <div className="w-full flex justify-between items-center">
                        <button
                            className="py-1 px-4 border border-black bg-gray-700 text-gray-100 rounded-full font-bold"
                            onClick={closeBlur}
                        >Save
                        </button>
                        <button
                            className="my-2 py-1  rounded-full font-bold text-red-400"
                            onClick={ev => ev.preventDefault()}>
                            <i className="fa-regular fa-trash-can"></i> Delete account
                        </button>
                    </div>

                </Form>

            </div>
        </Blur>
    )
}
