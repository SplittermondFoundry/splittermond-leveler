import assert from "node:assert/strict";

globalThis.Application = class {};
globalThis.Hooks = {
    once() {},
    on() {},
};
globalThis.game = { user: { id: "viewer", isGM: false } };

const leveler = await import("../scripts/let-me-skill.js");

assert.equal(typeof leveler.renderUndoChatContentV2, "function");

const advancementEntries = [
    { id: "skill-1", summary: "Handgemenge +1", note: "3 XP", cost: 3, undone: false },
    { id: "attribute-1", summary: "Staerke +1", note: "10 XP", cost: 10, undone: false },
];

function renderFor(actor, user = { id: "viewer", isGM: false }) {
    globalThis.game.user = user;
    return leveler.renderUndoChatContentV2(actor, advancementEntries);
}

const readonlyActor = {
    name: "Cederion",
    isOwner: false,
    canUserModify: (_user, action) => action === "update" && false,
};

const readonlyHtml = renderFor(readonlyActor);
assert.match(readonlyHtml, /Cederion/);
assert.match(readonlyHtml, /Handgemenge \+1/);
assert.doesNotMatch(readonlyHtml, /data-lms-undo-entry/);
assert.doesNotMatch(readonlyHtml, /data-lms-undo-all/);
assert.doesNotMatch(readonlyHtml, /<button\b/);

let permissionCheck = null;
const writableActor = {
    name: "Cederion",
    isOwner: false,
    canUserModify: (user, action) => {
        permissionCheck = { user, action };
        return action === "update";
    },
};

const writableHtml = renderFor(writableActor);
assert.equal(permissionCheck?.user.id, "viewer");
assert.equal(permissionCheck?.action, "update");
assert.equal((writableHtml.match(/data-lms-undo-entry/g) ?? []).length, 2);
assert.match(writableHtml, /data-lms-undo-all/);

const ownedActor = {
    name: "Cederion",
    isOwner: true,
    canUserModify: (_user, action) => action === "update",
};

const ownedHtml = renderFor(ownedActor);
assert.equal((ownedHtml.match(/data-lms-undo-entry/g) ?? []).length, 2);
assert.match(ownedHtml, /data-lms-undo-all/);

const gmHtml = renderFor(readonlyActor, { id: "gm", isGM: true });
assert.equal((gmHtml.match(/data-lms-undo-entry/g) ?? []).length, 2);
assert.match(gmHtml, /data-lms-undo-all/);

console.log("undo-chat-buttons tests passed");
