import {Form, redirect, useSearchParams} from "react-router-dom";
import Blur from "../Blur.jsx";
import {formTransition} from "../../scripts/utils.js";
import {useAuth} from "../../contexts/AuthContext.jsx";

export const action = (AuthContext) => async ({ request }) => {

    const formData = await request.formData();

    const { login } = AuthContext;
    const email = formData.get("email"),
        password = formData.get("password");
    console.log(email, password, request.url);
    const res = await login(email, password);
    if (res?.type !== "error") {
        localStorage.theme = res.darkMode ? "dark" : "light";
    }
    return redirect(`/?${res.type === "error" && ("errorMessage=" + res.errorMessage)}`);
}

export default function LoginForm() {

    function closeLoginForm() {
        const loginBlur = document.querySelector('[data-id="login-form"]');
        if (!loginBlur) {
            return;
        }
        loginBlur.classList.remove("active");
    }
    const [searchParams, setSearchParams] = useSearchParams();
    const errorMessage = searchParams.get("errorMessage");

    const { currentUser, googleSignIn, } = useAuth();
    if (currentUser) {
        closeLoginForm();
    }
    return (
        <Blur type="login-form">
            <div className="login-form relative top-10 bg-[#f8e8e2] rounded-xl p-4 lg:p-8 w-[28rem]
            z-20 text-gray-600 transition-all duration-500 ease-linear"
                 onClick={ev => ev.stopPropagation()}>
                <div className="w-full flex justify-between items-center mb-12">
                    <h3 className="font-bold text-xl tracking-tight">Hello, welcome back!</h3>
                    <button className="border rounded-full border-gray-700 px-3 py-1 font-bold text-sm"
                            onClick={() => formTransition("login-form", "signup-form")}>Sign Up
                    </button>
                </div>

                {errorMessage && <h3
                    className="rounded-md px-2 text-sm bg-red-500 text-black py-3 my-1">
                    {errorMessage}</h3>}
                <Form method="POST" action="/login" className="relative">
                    <input type="text" defaultValue="login-form" name="form-id" id="form-id" className="hidden"/>
                    <input type="email" id="email" name="email" required placeholder="Email"
                           className="w-full my-2 py-1 border-b border-gray-600 bg-transparent indent-1 focus:outline-none"/>
                    <input type="password" id="password" name="password" required placeholder="Password"
                           className="w-full my-2 py-1 border-b border-gray-600 bg-transparent indent-1 focus:outline-none"/>
                    <button className="text-gray-400 w-full text-right"
                            onClick={ev => {
                                ev.preventDefault()
                                formTransition("login-form", "reset-password-form");
                            }}
                    >Forgot password?
                    </button>

                    <button
                        className="w-full my-2 py-1 border border-black bg-gray-700 text-gray-100 rounded-full  font-bold "
                    >Let me in
                    </button>
                    <button
                        className="w-full my-2 py-1 border border-black rounded-full bg-white"
                        onClick={async ev => {
                            ev.preventDefault();
                            await googleSignIn();
                        }}>
                        <i className="fa-brands fa-google"></i> Log in with Google
                    </button>
                </Form>

            </div>
        </Blur>
    )
}
