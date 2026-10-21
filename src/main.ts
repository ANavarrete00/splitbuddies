import './style.css';

import { getCurrentUser, type User, } from './client/api/auth';

import { App } from './client/app/App';
import { Login } from './client/app/routes/login/Login';

const app = document.querySelector<HTMLDivElement>('#app');

if(!app) {
    throw new Error('App root element not found');
}

const appRoot = app;
let currentApplication: App | null = null;

function renderLoading(): void {
    appRoot.innerHTML = `
        <main class="loading-screen">
            <p>Loading Split Buddies...</p>
        </main>
    `;
}

function renderLogin(): void {
    currentApplication?.dispose();
    currentApplication = null;

    const login = new Login(appRoot, (user) => {
        renderApp(user);
    },);

    login.render();
}

function renderApp(user: User): void {
    currentApplication?.dispose();
    currentApplication = new App(appRoot, user, () => {
        renderLogin();
    })
    
    currentApplication.render();
}

async function initialize(): Promise<void> {
    renderLoading();

    try {
        const user = await getCurrentUser();

        if(user) {
            renderApp(user);
            return;
        }

        renderLogin();
    } 
    catch (error) {
        console.error(
            'Failed to initialize authentication:',
            error,
        );

        renderLogin();
    }
}

initialize();

if('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(() => {
            console.log('Service worker registered');
        })
            .catch((error) => {
                console.error(
                  'Service worker registration failed:',
                  error,
                );
            });
    });
}