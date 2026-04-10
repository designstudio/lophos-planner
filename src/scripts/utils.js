export function formDate(date) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

export const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const formBlurDict = {
    "login-form": "login-form",
    "task-menu": "task-menu",
    "update-user-form": "update-user-form",
    "signup-form": "signup-form",
}

export function formTransition(from, to) {
    closeForm(from);
    openForm(to);
}

export function openForm(formBlurId) {
    const formBlur = document.querySelector(`[data-id='${formBlurId}']`);
    if (!formBlur) return;

    formBlur.classList.add('active');

    const formElement = formBlur.querySelector(`.${formBlurId}`);
    if (!formElement) return;

    formElement.animate(
        [
            {
                top: "6rem",
                opacity: 0.5,
            },
            {
                top: "3.5rem",
                opacity: 1,
            },
        ],
        {
            duration: 300,
            fill: "forwards",
        }
    );
}

export function closeForm(formBlurId) {
    const fromForm = document.querySelector(`.blur-bg[data-id="${formBlurId}"]`);
    if (!fromForm) return;

    fromForm.classList.remove("active");
}
