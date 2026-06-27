export function choiceSelectHtml(choices, { itemButton = true } = {}) {
    if (!choices.length) {
        return `<p class="lms-muted">Keine passenden Bibliothekseinträge gefunden. Freie Eingabe verwenden.</p>`;
    }
    if (!itemButton) return nativeChoiceSelectHtml(choices);

    const hasProgression = choices.some((choice) => Number.isInteger(choiceProgression(choice)));
    return `
        <div class="lms-choice-field">
            <strong>Bibliothek</strong>
            ${choiceSortControlsHtml(choices)}
            <input type="hidden" name="choice" value="" />
            <span class="lms-choice-control">
                <span class="lms-choice-picker" data-lms-choice-picker>
                    <button type="button" class="lms-choice-trigger" aria-haspopup="listbox" aria-expanded="false">
                        <span class="lms-choice-trigger-label">Freie Eingabe</span>
                        <i class="fa fa-chevron-down" aria-hidden="true"></i>
                    </button>
                    <span class="lms-choice-menu" role="listbox" hidden>
                        ${choiceRowHtml({ label: "Freie Eingabe", value: "", selected: true, free: true })}
                        ${choiceRowsHtml(choices, hasProgression ? "progression" : "name")}
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
    const progression = choiceProgression(choice);
    if (!Number.isInteger(progression)) return choice?.name ?? "";
    return `${choice.name} (${choiceProgressionKind(choice)} ${progression})`;
}

export function choiceMenuPlacement({ triggerRect, boundaryRect, rowHeight = 28, maxRows = 15, gap = 2, margin = 8 }) {
    const below = Math.max(0, boundaryRect.bottom - triggerRect.bottom - gap - margin);
    const above = Math.max(0, triggerRect.top - boundaryRect.top - gap - margin);
    const targetHeight = rowHeight * maxRows;
    const direction = below >= targetHeight || below >= above ? "down" : "up";
    const available = direction === "down" ? below : above;
    const rows = Math.max(1, Math.min(maxRows, Math.floor(available / rowHeight)));
    return { direction, maxHeight: rows * rowHeight };
}

export function choiceMenuLayout({ triggerRect, boundaryRect, rowHeight = 28, maxRows = 15, gap = 2, margin = 8 }) {
    const placement = choiceMenuPlacement({ triggerRect, boundaryRect, rowHeight, maxRows, gap, margin });
    const width = Math.max(0, Math.round(triggerRect.width ?? triggerRect.right - triggerRect.left));
    const minLeft = boundaryRect.left + margin;
    const maxLeft = Math.max(minLeft, boundaryRect.right - width - margin);
    const left = Math.round(Math.min(Math.max(triggerRect.left, minLeft), maxLeft));
    const top = placement.direction === "down" ? Math.round(triggerRect.bottom + gap) : null;
    const bottom = placement.direction === "up" ? Math.round(boundaryRect.bottom - triggerRect.top + gap) : null;
    return { ...placement, left, top, bottom, width };
}

export function portalChoiceMenu(menu, portal) {
    const parent = menu?.parentNode ?? null;
    const nextSibling = menu?.nextSibling ?? null;
    if (!menu || !portal || menu.parentNode === portal) return () => {};

    portal.append(menu);
    return () => {
        if (!parent || menu.parentNode === parent) return;
        parent.insertBefore(menu, nextSibling?.parentNode === parent ? nextSibling : null);
    };
}

export function choiceMenuZIndex(style, fallback = 100) {
    const zIndex = Number.parseInt(style?.zIndex ?? "", 10);
    return (Number.isInteger(zIndex) ? zIndex : fallback) + 1;
}

function choiceSortControlsHtml(choices) {
    if (!choices.some((choice) => Number.isInteger(choiceProgression(choice)))) return "";
    const label = choiceProgressionKind(choices.find((choice) => Number.isInteger(choiceProgression(choice))));
    return `
            <span class="lms-choice-sort-controls" data-lms-choice-sort-controls aria-label="Sortierung">
                <button type="button" class="lms-choice-sort-button is-active" data-lms-choice-sort-mode="progression" aria-pressed="true" title="Nach ${escapeHtml(
                    label
                )} sortieren">${escapeHtml(label)}</button>
                <button type="button" class="lms-choice-sort-button" data-lms-choice-sort-mode="name" aria-pressed="false" title="Alphabetisch sortieren">A-Z</button>
            </span>
    `;
}

function choiceRowsHtml(choices, sortMode) {
    let activeGroup = null;
    return orderedChoiceItems(choices, sortMode)
        .map(({ choice, index, progression }) => {
            const groupLabel = Number.isInteger(progression) ? `${choiceProgressionKind(choice)} ${progression}` : "Ohne Stufe";
            const heading =
                sortMode === "progression" && activeGroup !== groupLabel
                    ? ((activeGroup = groupLabel), choiceGroupHeadingHtml(groupLabel))
                    : "";
            return (
                heading +
                choiceRowHtml({
                    label: choiceLabel(choice),
                    value: String(index),
                    index,
                    uuid: choice.uuid,
                    warning: choice.duplicateWarning,
                    progression,
                    progressionLabel: groupLabel,
                    sortName: choiceSortName(choice),
                })
            );
        })
        .join("");
}

function orderedChoiceItems(choices, sortMode) {
    const items = choices.map((choice, index) => ({
        choice,
        index,
        progression: choiceProgression(choice),
        sortName: choiceSortName(choice),
    }));
    return items.sort((left, right) => {
        if (sortMode === "progression") {
            const leftHasProgression = Number.isInteger(left.progression);
            const rightHasProgression = Number.isInteger(right.progression);
            if (leftHasProgression && rightHasProgression && left.progression !== right.progression) return left.progression - right.progression;
            if (leftHasProgression !== rightHasProgression) return leftHasProgression ? -1 : 1;
        }
        return left.sortName.localeCompare(right.sortName, "de") || left.index - right.index;
    });
}

function choiceProgression(choice) {
    return firstInteger(
        choice?.selectionProgression,
        choice?.progression,
        choice?.itemType === "spell" ? choice?.system?.skillLevel : choice?.system?.level
    );
}

function firstInteger(...values) {
    for (const value of values) {
        const number = Number.parseInt(value, 10);
        if (Number.isInteger(number)) return number;
    }
    return null;
}

function choiceProgressionKind(choice) {
    if (choice?.itemType === "spell") return "Grad";
    if (choice?.itemType === "mastery") return "Schwelle";
    return "Stufe";
}

function choiceSortName(choice) {
    return String(choice?.name ?? "").trim();
}

function choiceGroupHeadingHtml(label) {
    return `<span class="lms-choice-group-heading" role="presentation">${escapeHtml(label)}</span>`;
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

function choiceRowHtml({
    label,
    value,
    index = null,
    uuid = null,
    warning = null,
    selected = false,
    free = false,
    progression = null,
    progressionLabel = "",
    sortName = "",
}) {
    return `
        <span class="lms-choice-row ${uuid ? "lms-choice-row-has-item" : ""} ${selected ? "is-selected" : ""} ${
            warning ? "lms-duplicate-choice" : ""
        }" role="option" aria-selected="${selected ? "true" : "false"}" data-choice-value="${escapeHtml(value)}"${
            Number.isInteger(index) ? ` data-choice-index="${index}"` : ""
        }${free ? ` data-choice-free="true"` : ""}${
            Number.isInteger(progression) ? ` data-choice-progression="${progression}" data-choice-progression-label="${escapeHtml(progressionLabel)}"` : ""
        }${sortName ? ` data-choice-sort-name="${escapeHtml(sortName)}"` : ""}>
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
