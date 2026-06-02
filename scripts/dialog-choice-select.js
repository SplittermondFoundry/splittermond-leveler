export function choiceSelectHtml(choices, { itemButton = true } = {}) {
    if (!choices.length) {
        return `<p class="lms-muted">Keine passenden Bibliothekseinträge gefunden. Freie Eingabe verwenden.</p>`;
    }
    if (!itemButton) return nativeChoiceSelectHtml(choices);

    return `
        <div class="lms-choice-field">
            <strong>Bibliothek</strong>
            <input type="hidden" name="choice" value="" />
            <span class="lms-choice-control">
                <span class="lms-choice-picker" data-lms-choice-picker>
                    <button type="button" class="lms-choice-trigger" aria-haspopup="listbox" aria-expanded="false">
                        <span class="lms-choice-trigger-label">Freie Eingabe</span>
                        <i class="fa fa-chevron-down" aria-hidden="true"></i>
                    </button>
                    <span class="lms-choice-menu" role="listbox" hidden>
                        ${choiceRowHtml({ label: "Freie Eingabe", value: "", selected: true })}
                        ${choices
                            .map((choice, index) =>
                                choiceRowHtml({
                                    label: choiceLabel(choice),
                                    value: String(index),
                                    index,
                                    uuid: choice.uuid,
                                    warning: choice.duplicateWarning,
                                })
                            )
                            .join("")}
                    </span>
                </span>
                <button type="button" class="lms-choice-selected-show-item lms-choice-show-item" title="Ausgewähltes Item anzeigen" disabled>
                    <i class="fa fa-eye" aria-hidden="true"></i>
                </button>
            </span>
            <small class="lms-choice-warning" hidden></small>
        </div>
    `;
}

export function choiceLabel(choice) {
    if (!Number.isInteger(choice?.selectionProgression)) return choice?.name ?? "";
    const label = choice.itemType === "spell" ? "Grad" : choice.itemType === "strength" ? "Stufe" : "Schwelle";
    return `${choice.name} (${label} ${choice.selectionProgression})`;
}

export function choiceMenuPlacement({ triggerRect, boundaryRect, rowHeight = 28, maxRows = 8, gap = 2, margin = 8 }) {
    const below = Math.max(0, boundaryRect.bottom - triggerRect.bottom - gap - margin);
    const above = Math.max(0, triggerRect.top - boundaryRect.top - gap - margin);
    const direction = below >= rowHeight || below >= above ? "down" : "up";
    const available = direction === "down" ? below : above;
    const rows = Math.max(1, Math.min(maxRows, Math.floor(available / rowHeight)));
    return { direction, maxHeight: rows * rowHeight };
}

function nativeChoiceSelectHtml(choices) {
    return `
        <div class="lms-choice-field">
            <strong>Bibliothek</strong>
            <span class="lms-choice-control lms-choice-control-no-button">
                <select name="choice">
                    <option value="">Freie Eingabe</option>
                    ${choices
                        .map(
                            (choice, index) =>
                                `<option value="${index}" class="${choice.duplicateWarning ? "lms-duplicate-choice" : ""}" title="${escapeHtml(
                                    choice.duplicateWarning ?? ""
                                )}">${escapeHtml(choiceLabel(choice))}</option>`
                        )
                        .join("")}
                </select>
            </span>
            <small class="lms-choice-warning" hidden></small>
        </div>
    `;
}

function choiceRowHtml({ label, value, index = null, uuid = null, warning = null, selected = false }) {
    return `
        <span class="lms-choice-row ${uuid ? "lms-choice-row-has-item" : ""} ${selected ? "is-selected" : ""} ${warning ? "lms-duplicate-choice" : ""}" role="option" aria-selected="${selected ? "true" : "false"}" data-choice-value="${escapeHtml(value)}"${
            Number.isInteger(index) ? ` data-choice-index="${index}"` : ""
        }>
            <button type="button" class="lms-choice-row-select" data-choice-value="${escapeHtml(value)}" title="${escapeHtml(warning ?? label)}">
                <span>${escapeHtml(label)}</span>
            </button>
            ${
                uuid
                    ? `<button type="button" class="lms-choice-row-show-item" data-choice-index="${index}" data-source-uuid="${escapeHtml(uuid)}" title="Item anzeigen">
                <i class="fa fa-eye" aria-hidden="true"></i>
            </button>`
                    : ""
            }
        </span>
    `;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
