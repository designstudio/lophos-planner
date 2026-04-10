import { Form, redirect, useSearchParams } from "react-router-dom";
import Blur from "../Blur.jsx";
import { formTransition } from "../../scripts/utils.js";

export const action = (AuthContext) => async ({ request }) => {
    const formData = await request.formData();

    const { signup } = AuthContext;
    const name = formData.get("name");
    const email = formData.get("email");
    const passwordConfirm = formData.get("confirmPassword");
    const password = formData.get("password");

    if (password && password.length < 6) {
        return redirect("/?errorMessage=Password must be at least 6 characters");
    }

    if (passwordConfirm !== password) {
        return redirect("/?errorMessage=Passwords don't match");
    }

    const result = await signup({ email, password, name });

    if (result?.type === "error") {
        return redirect(`/?errorMessage=${encodeURIComponent(result.errorMessage)}`);
    }

    return redirect("/");
};

export default function SignUpForm() {
    const [searchParams] = useSearchParams();
    const errorMessage = searchParams.get("errorMessage");

    return (
        <Blur type="signup-form">
            <div
                className="signup-form relative top-10 bg-[#f8e8e2] rounded-xl p-4 lg:p-8 w-[28rem] max-w-screen-sm
                z-20 text-gray-600 transition-all duration-500 ease-linear"
                onClick={ev => ev.stopPropagation()}
            >
                <div className="w-full flex justify-between items-center mb-12">
                    <h3 className="font-bold text-lg">Hello, nice to meet you!</h3>
                    <button
                        type="button"
                        className="border rounded-full border-gray-700 px-3 py-1 font-bold text-sm"
                        onClick={() => formTransition("signup-form", "login-form")}
                    >
                        Log in
                    </button>
                </div>

                {errorMessage && (
                    <h3 className="rounded-md px-2 text-sm bg-red-500 text-black py-3 my-1">
                        {errorMessage}
                    </h3>
                )}

                <Form method="POST" className="relative" action="/signup">
                    <input type="text" defaultValue="signup-form" name="form-id" id="form-id" className="hidden" />

                    <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        placeholder="Name"
                        className="w-full my-2 py-1 border-b border-gray-600 bg-transparent indent-1 focus:outline-none"
                    />

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

                    <input
                        type="password"
                        id="confirmPassword"
                        name="confirmPassword"
                        required
                        placeholder="Confirm Password"
                        className="w-full my-2 py-1 border-b border-gray-600 bg-transparent indent-1 focus:outline-none"
                    />

                    <p className="text-xs text-gray-400">
                        By proceeding, you agree to the Terms and Conditions & Privacy and Cookies Policy.
                        (I don't have ones so you don't have to ;) )
                    </p>

                    <button
                        type="submit"
                        className="w-full my-2 py-1 border border-black bg-gray-700 text-gray-100 rounded-full font-bold"
                    >
                        Create account
                    </button>
                </Form>
            </div>
        </Blur>
    );
}
