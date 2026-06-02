import assert from "node:assert/strict";
import { choiceMenuPlacement, choiceSelectHtml } from "../scripts/dialog-choice-select.js";

const html = choiceSelectHtml(
    [
        { uuid: "Compendium.splittermond.masteries.a", itemType: "mastery", name: "Herausforderung", selectionProgression: 1 },
        { uuid: "Compendium.splittermond.masteries.b", itemType: "mastery", name: "Koordinator", selectionProgression: 1 },
        { itemType: "mastery", name: "Freier Eintrag", selectionProgression: 1 },
    ],
    { itemButton: true }
);

assert.match(html, /name="choice"/);
assert.match(html, /class="lms-choice-menu"/);
assert.equal((html.match(/class="lms-choice-selected-show-item/g) ?? []).length, 1);
assert.match(html, /class="lms-choice-selected-show-item lms-choice-show-item" title="Ausgewähltes Item anzeigen" disabled/);
assert.equal((html.match(/class="lms-choice-row-show-item"/g) ?? []).length, 2);
assert.match(html, /data-choice-index="0"/);
assert.match(html, /data-choice-index="1"/);
assert.doesNotMatch(html, /data-choice-index="2"[^]*lms-choice-row-show-item/);
assert.match(html, /data-source-uuid="Compendium\.splittermond\.masteries\.a"/);
assert.match(html, /data-source-uuid="Compendium\.splittermond\.masteries\.b"/);

const nativeHtml = choiceSelectHtml([{ uuid: "Compendium.splittermond.languages.a", itemType: "language", name: "Dragoreisch" }], {
    itemButton: false,
});
assert.match(nativeHtml, /<select name="choice">/);
assert.doesNotMatch(nativeHtml, /lms-choice-row-show-item/);

assert.deepEqual(
    choiceMenuPlacement({
        triggerRect: { top: 80, bottom: 108 },
        boundaryRect: { top: 40, bottom: 318 },
    }),
    { direction: "down", maxHeight: 196 }
);

assert.deepEqual(
    choiceMenuPlacement({
        triggerRect: { top: 260, bottom: 288 },
        boundaryRect: { top: 40, bottom: 318 },
    }),
    { direction: "up", maxHeight: 196 }
);

console.log("dialog-choice-select tests passed");
