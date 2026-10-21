import {
    login,
    register,
    type User,
} from '../../../api/auth';

export class Login {
    private readonly root: HTMLDivElement;

    private readonly onAuthenticated: (
        user: User,
    ) => void;

    constructor(root: HTMLDivElement, onAuthenticated: (user: User) => void) {
        this.root = root;
        this.onAuthenticated = onAuthenticated;
    }

    render(): void {
        this.root.innerHTML = `
            <main class="auth-container">
                <div class="auth-card">
                    <h1>Split Buddies</h1>

                    <p id="auth-mode-text">Sign in to your account.</p>

                    <form id="auth-form">
                        <div class="form-field" id="username-field">
                            <label for="username">Username</label>
                            <input id="username" name="username" type="text" autocomplete="username" required/>
                        </div>

                        <div class="form-field">
                            <label for="email">Email</label>
                            <input id="email" name="email" type="email" autocomplete="email" required/>
                        </div>

                        <div class="form-field">
                            <label for="password">Password</label>
                            <input id="password" name="password" type="password" autocomplete="current-password" required/>
                        </div>

                        <p id="auth-error" class="form-error" role="alert" hidden></p>

                        <button id="auth-submit" type="submit" class="action-button">Sign in</button>
                    </form>

                    <button id="auth-toggle" type="button">Create an account</button>
                </div>
            </main>
        `;

        const form = this.root.querySelector<HTMLFormElement>('#auth-form')!;

        const usernameField = this.root.querySelector<HTMLDivElement>('#username-field')!;

        const usernameInput = this.root.querySelector<HTMLInputElement>('#username')!;

        const emailInput = this.root.querySelector<HTMLInputElement>('#email')!;

        const passwordInput = this.root.querySelector<HTMLInputElement>('#password')!;

        const submitButton = this.root.querySelector<HTMLButtonElement>('#auth-submit')!;

        const toggleButton = this.root.querySelector<HTMLButtonElement>('#auth-toggle')!;

        const modeText = this.root.querySelector<HTMLParagraphElement>('#auth-mode-text')!;

        const errorElement = this.root.querySelector<HTMLParagraphElement>('#auth-error')!;

        let isRegisterMode = false;

        const updateMode = (): void => {
            usernameField.hidden = !isRegisterMode;
            usernameField.style.display = isRegisterMode ? '' : 'none';
            usernameInput.required = isRegisterMode;
            usernameInput.value = '';
            passwordInput.value = '';

            modeText.textContent = isRegisterMode
                ? 'Create a new account.'
                : 'Sign in to your account.';

            submitButton.textContent = isRegisterMode
                ? 'Create account'
                : 'Sign in';

            toggleButton.textContent = isRegisterMode
                ? 'Already have an account? Sign in'
                : 'Create an account';

            errorElement.hidden = true;
            errorElement.textContent = '';
        };

        toggleButton.addEventListener('click', () => {
            isRegisterMode = !isRegisterMode;
            updateMode();
        });

        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            errorElement.hidden = true;
            errorElement.textContent = '';

            submitButton.disabled = true;

            try {
                let user: User;

                if(isRegisterMode) {
                    user = await register(
                        usernameInput.value.trim(),
                        emailInput.value.trim(),
                        passwordInput.value,
                    );
                } 
                else {
                    user = await login(
                        emailInput.value.trim(),
                        passwordInput.value,
                    );
                }

                this.onAuthenticated(user);
            } 
            catch (error) {
                errorElement.textContent = error instanceof Error
                    ? error.message
                    : 'Authentication failed.';

                errorElement.hidden = false;
                submitButton.disabled = false;
            }
        });

        updateMode();
    }
}