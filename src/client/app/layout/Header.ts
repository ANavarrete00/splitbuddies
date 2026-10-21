export interface HeaderUser {username: string;}

export function renderHeader(user: HeaderUser): string {
    return `
        <header class="app-header">
            <div class="app-header-inner">
                <h1 class="app-header-title">
                    <img src="/favicon.svg" alt="" aria-hidden="true">
                    Split Buddies
                </h1>

                <div class="app-header-user">
                    <span>${escapeHtml(user.username)}</span>
                    <button id="logout-button" class="header-logout-button" type="button">Sign out</button>
                </div>
            </div>
    </header>
  `;
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}