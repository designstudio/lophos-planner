import {Form, redirect, useActionData, useLoaderData} from "react-router-dom";
import Blur from "../Blur.jsx";
import { formTransition } from "../../scripts/utils.js";

export const action = (AuthContext) => async ({ request }) => {
    const { resetPassword } = AuthContext;

    const formData = await request.formData();
    const email = formData.get("email");
    await resetPassword(email);
    return redirect("/");
}

export default function ResetPasswordForm() {

    const errorMessage = useActionData();

    return (
        <Blur type="reset-password-form">
            <div className="task-menu relative top-26 bg-[#f8e8e2] rounded-xl p-4 lg:p-8 w-[28rem]
            z-20 text-gray-600 transition-all duration-500 ease-linear"
                 onClick={ev => ev.stopPropagation()}>
                <div className="w-full flex justify-between items-center mb-3">
                    <h3 className="font-bold text-xl tracking-tight">Forgot password?</h3>
                    <button className="border rounded-full border-gray-700 px-3 py-1 font-bold text-sm"
                            onClick={() => formTransition("reset-password-form", "login-form")}>Log in</button>
                </div>
                <p className="mb-4 text-sm">Please enter your email to receive instructions on how to reset your password.</p>
                { errorMessage && typeof errorMessage === "string" && <h3
                    className="rounded-md px-2 text-sm bg-red-500 text-black py-3 my-1">
                    {errorMessage}</h3>}
                <Form method="POST" className="relative" action="/reset-password">
                    <input type="text" defaultValue="login-form" name="form-id" id="form-id" className="hidden" />
                    <input type="email" id="email" name="email" required placeholder="Email"
                           className="w-full my-2 py-1 border-b border-gray-600 bg-transparent indent-1 focus:outline-none"/>
                    <button
                        className="py-1 px-4 border border-black bg-gray-700 text-gray-100 rounded-full font-bold"
                        onClick={() => formTransition("reset-password-form", "login-form")}
                    >Send
                    </button>
                </Form>

            </div>
        </Blur>
    )
}
