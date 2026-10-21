export interface ModalOptions {
    title: string;
    content: string;
    closeLabel?: string;
}

export class Modal {
    private readonly root: HTMLDivElement;

    constructor(root: HTMLDivElement) {
        this.root = root;
    }

    render(options: ModalOptions): string {
        return `
            <div class="modal-backdrop" data-modal-backdrop>
                <section
                    class="modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modal-title"
                >
                    <div class="modal-header">
                        <h2 id="modal-title">
                            ${escapeHtml(options.title)}
                        </h2>

                        <button
                            type="button"
                            class="modal-close"
                            data-modal-close
                            aria-label="${escapeHtml(options.closeLabel ?? 'Close')}"
                        >
                            ×
                        </button>
                    </div>

                    <div class="modal-content">
                        ${options.content}
                    </div>
                </section>
            </div>
        `;
    }

    attachEvents(onClose: () => void): void {
        const backdrop = this.root.querySelector<HTMLElement>(
            '[data-modal-backdrop]',
        );

        const closeButton = this.root.querySelector<HTMLButtonElement>(
            '[data-modal-close]',
        );

        closeButton?.addEventListener('click', () => {
            onClose();
        });

        backdrop?.addEventListener('click', (event) => {
            if(event.target === backdrop) {
                onClose();
            }
        });
    }
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}