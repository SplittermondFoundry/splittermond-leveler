import assert from "node:assert/strict";
import {
    choiceMenuLayout,
    choiceMenuPlacement,
    choiceMenuZIndex,
    choiceSelectHtml,
    portalChoiceMenu,
    watchChoiceMenuOwner,
} from "../scripts/dialog-choice-select.js";

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
assert.doesNotMatch(html, /class="lms-choice-row-show-item" data-choice-index="2"/);
assert.match(html, /data-source-uuid="Compendium\.splittermond\.masteries\.a"/);
assert.match(html, /data-source-uuid="Compendium\.splittermond\.masteries\.b"/);

const nativeHtml = choiceSelectHtml([{ uuid: "Compendium.splittermond.languages.a", itemType: "language", name: "Dragoreisch" }], {
    itemButton: false,
});
assert.match(nativeHtml, /<select name="choice">/);
assert.doesNotMatch(nativeHtml, /lms-choice-row-show-item/);

const groupedHtml = choiceSelectHtml(
    [
        { uuid: "Compendium.splittermond.spells.wind", itemType: "spell", name: "Windlauf", selectionProgression: 2 },
        { uuid: "Compendium.splittermond.spells.armor", itemType: "spell", name: "Arkane Rüstung", selectionProgression: 1 },
        { uuid: "Compendium.splittermond.spells.fire", itemType: "spell", name: "Feuerstrahl", selectionProgression: 1 },
    ],
    { itemButton: true }
);
assert.match(groupedHtml, /data-lms-choice-sort-controls/);
assert.match(groupedHtml, /data-lms-choice-sort-mode="progression"[^>]*aria-pressed="true"/);
assert.match(groupedHtml, /data-lms-choice-sort-mode="name"[^>]*aria-pressed="false"/);
assert.match(groupedHtml, /class="lms-choice-group-heading"[^>]*>Grad 1</);
assert.match(groupedHtml, /class="lms-choice-group-heading"[^>]*>Grad 2</);
assert.ok(
    groupedHtml.indexOf("Grad 1") < groupedHtml.indexOf("Arkane Rüstung") &&
        groupedHtml.indexOf("Arkane Rüstung") < groupedHtml.indexOf("Feuerstrahl") &&
        groupedHtml.indexOf("Feuerstrahl") < groupedHtml.indexOf("Grad 2") &&
        groupedHtml.indexOf("Grad 2") < groupedHtml.indexOf("Windlauf")
);

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

assert.deepEqual(
    choiceMenuPlacement({
        triggerRect: { top: 80, bottom: 108 },
        boundaryRect: { top: 40, bottom: 700 },
    }),
    { direction: "down", maxHeight: 420 }
);

assert.deepEqual(
    choiceMenuLayout({
        triggerRect: { left: 120, right: 520, top: 220, bottom: 248, width: 400 },
        boundaryRect: { left: 0, right: 1000, top: 0, bottom: 900 },
    }),
    { direction: "down", maxHeight: 420, left: 120, top: 250, bottom: null, width: 400 }
);

assert.deepEqual(
    choiceMenuLayout({
        triggerRect: { left: 900, right: 1220, top: 760, bottom: 788, width: 320 },
        boundaryRect: { left: 0, right: 1000, top: 0, bottom: 900 },
    }),
    { direction: "up", maxHeight: 420, left: 672, top: null, bottom: 142, width: 320 }
);

assert.equal(choiceMenuZIndex({ zIndex: "123" }), 124);
assert.equal(choiceMenuZIndex({ zIndex: "auto" }), 101);
assert.equal(choiceMenuZIndex(null), 101);

const originalParent = fakeNode("picker");
const portalParent = fakeNode("body");
const beforeMenu = fakeNode("trigger");
const menuNode = fakeNode("menu");
const afterMenu = fakeNode("show-button");
originalParent.append(beforeMenu);
originalParent.append(menuNode);
originalParent.append(afterMenu);

const restoreMenu = portalChoiceMenu(menuNode, portalParent);

assert.deepEqual(originalParent.children.map((child) => child.name), ["trigger", "show-button"]);
assert.deepEqual(portalParent.children.map((child) => child.name), ["menu"]);
assert.equal(menuNode.parentNode, portalParent);

restoreMenu();

assert.deepEqual(originalParent.children.map((child) => child.name), ["trigger", "menu", "show-button"]);
assert.deepEqual(portalParent.children.map((child) => child.name), []);
assert.equal(menuNode.parentNode, originalParent);

const ownerDocument = { body: fakeNode("document-body") };
const ownerWindow = fakeNode("window");
ownerWindow.ownerDocument = ownerDocument;
ownerWindow.isConnected = true;
let activeObserver = null;
let disconnectedCount = 0;
class FakeMutationObserver {
    constructor(callback) {
        this.callback = callback;
        this.disconnected = false;
        activeObserver = this;
    }

    observe(target, options) {
        this.target = target;
        this.options = options;
    }

    disconnect() {
        this.disconnected = true;
    }
}

watchChoiceMenuOwner(ownerWindow, () => {
    disconnectedCount += 1;
}, FakeMutationObserver);

assert.equal(activeObserver.target, ownerDocument.body);
assert.deepEqual(activeObserver.options, { childList: true, subtree: true });
ownerWindow.isConnected = false;
activeObserver.callback();
assert.equal(disconnectedCount, 1);
assert.equal(activeObserver.disconnected, true);

console.log("dialog-choice-select tests passed");

function fakeNode(name) {
    return {
        name,
        children: [],
        parentNode: null,
        get nextSibling() {
            if (!this.parentNode) return null;
            const index = this.parentNode.children.indexOf(this);
            return this.parentNode.children[index + 1] ?? null;
        },
        append(child) {
            child.parentNode?.removeChild(child);
            this.children.push(child);
            child.parentNode = this;
        },
        insertBefore(child, nextSibling) {
            child.parentNode?.removeChild(child);
            const index = nextSibling ? this.children.indexOf(nextSibling) : -1;
            this.children.splice(index >= 0 ? index : this.children.length, 0, child);
            child.parentNode = this;
        },
        removeChild(child) {
            const index = this.children.indexOf(child);
            if (index >= 0) this.children.splice(index, 1);
            child.parentNode = null;
        },
    };
}
