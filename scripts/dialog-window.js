const DIALOG_CLASSES = ["splittermond", "sheet", "actor", "splittermond-leveler", "lms-dialog-window"];

export function promptDialogOptions(width) {
    return {
        width,
        resizable: true,
        classes: [...DIALOG_CLASSES],
    };
}

export function promptDialogApplicationOptions({ title, width }) {
    return {
        id: "splittermond-leveler-dialog",
        tag: "form",
        classes: [...DIALOG_CLASSES],
        position: { width },
        window: {
            title,
            minimizable: true,
            resizable: true,
        },
    };
}

export function dialogFormHtml({ content, confirmLabel }) {
    return `
        <section class="lms-dialog-form">
            <div class="lms-dialog-body">
                ${content}
            </div>
            <footer class="lms-dialog-buttons">
                <button type="button" data-lms-dialog-confirm>${escapeHtml(confirmLabel)}</button>
                <button type="button" data-lms-dialog-cancel>Abbrechen</button>
            </footer>
        </section>
    `;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
