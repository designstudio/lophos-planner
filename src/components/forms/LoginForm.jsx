import { Form, redirect, useSearchParams } from "react-router-dom";
import Blur from "../Blur.jsx";
import { formTransition } from "../../scripts/utils.js";

export const action = (AuthContext) => async ({ request }) => {
    const formData = await request.formData();

    const { login } = AuthContext;
    const email = formData.get("email");
    const password = formData.get("password");

    const res = await login(email, password);

    if (res?.type === "error") {
        return redirect(`/?errorMessage=${encodeURIComponent(res.errorMessage)}`);
    }

    return redirect("/");
};

export default function LoginForm() {
    const [searchParams] = useSearchParams();
    const errorMessage = searchParams.get("errorMessage");

    return (
        <Blur type="login-form">
            <div
                className="login-form relative top-10 bg-[#f8e8e2] rounded-xl p-4 lg:p-8 w-[28rem]
                z-20 text-gray-600 transition-all duration-500 ease-linear"
                onClick={ev => ev.stopPropagation()}
            >
                <div className="w-full flex justify-between items-center mb-12">
                    <h3 className="font-bold text-xl tracking-tight">Hello, welcome back!</h3>
                    <button
                        type="button"
                        className="border rounded-full border-gray-700 px-3 py-1 font-bold text-sm"
                        onClick={() => formTransition("login-form", "signup-form")}
                    >
                        Sign Up
                    </button>
                </div>

                {errorMessage && (
                    <h3 className="rounded-md px-2 text-sm bg-red-500 text-black py-3 my-1">
                        {errorMessage}
                    </h3>
                )}

                <Form method="POST" action="/login" className="relative">
                    <input type="text" defaultValue="login-form" name="form-id" id="form-id" className="hidden" />

                    <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        placeholder="Email"
                        className="w-full my-2 py-1 border-b border-gray-600 bg-transparent indent-1 focus:outline-none"
                    />

                    <input
                        type="password"
                        id="password"
                        name="password"
                        required
                        placeholder="Password"
                        className="w-full my-2 py-1 border-b border-gray-600 bg-transparent indent-1 focus:outline-none"
                    />

                    <button
                        type="button"
                        className="text-gray-400 w-full text-right"
                        onClick={() => formTransition("login-form", "reset-password-form")}
                    >
                        Forgot password?
                    </button>

                    <button
                        type="submit"
                        className="w-full my-2 py-1 border border-black bg-gray-700 text-gray-100 rounded-full font-bold"
                    >
                        Let me in
                    </button>
                </Form>
            </div>
        </Blur>
    );
}
