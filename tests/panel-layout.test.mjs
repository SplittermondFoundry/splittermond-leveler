import assert from "node:assert/strict";
import {
    calculateSnappedPanelPosition,
    sameSnappedPanelPosition,
    shouldResetSheetStateOnClose,
    zIndexBelowAnchor,
} from "../scripts/panel-layout.js";

const right = calculateSnappedPanelPosition(
    { left: 100, right: 700, top: 50, height: 600 },
    { width: 1200, height: 900 },
    { width: 304, gap: 8, margin: 8 }
);
assert.deepEqual(right, { left: 708, top: 50, height: 600, side: "right" });

const left = calculateSnappedPanelPosition(
    { left: 400, right: 1000, top: 50, height: 600 },
    { width: 1200, height: 900 },
    { width: 304, gap: 8, margin: 8 }
);
assert.deepEqual(left, { left: 88, top: 50, height: 600, side: "left" });

const clamped = calculateSnappedPanelPosition(
    { left: 100, right: 500, top: -20, height: 1000 },
    { width: 700, height: 600 },
    { width: 304, gap: 8, margin: 8 }
);
assert.deepEqual(clamped, { left: 388, top: 8, height: 584, side: "right-clamped" });

assert.equal(
    shouldResetSheetStateOnClose({
        documentName: "Actor",
        documentType: "character",
        actorDocumentName: "Actor",
        actorType: "character",
        hasActorSheetClass: true,
    }),
    true
);
assert.equal(
    shouldResetSheetStateOnClose({
        documentName: "Item",
        documentType: "mastery",
        actorDocumentName: "Actor",
        actorType: "character",
        hasActorSheetClass: false,
    }),
    false
);
assert.equal(
    shouldResetSheetStateOnClose({
        documentName: null,
        documentType: null,
        actorDocumentName: "Actor",
        actorType: "character",
        hasActorSheetClass: true,
    }),
    true
);

assert.equal(sameSnappedPanelPosition({ left: 1, top: 2, width: 3, height: 4 }, { left: 1, top: 2, width: 3, height: 4 }), true);
assert.equal(sameSnappedPanelPosition({ left: 1, top: 2, width: 3, height: 4 }, { left: 1, top: 2, width: 3, height: 5 }), false);

assert.equal(zIndexBelowAnchor("120"), 119);
assert.equal(zIndexBelowAnchor("auto"), null);

console.log("panel-layout tests passed");
