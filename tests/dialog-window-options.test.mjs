import assert from "node:assert/strict";
import { dialogFormHtml, promptDialogApplicationOptions, promptDialogOptions } from "../scripts/dialog-window.js";

const options = promptDialogOptions(540);

assert.equal(options.width, 540);
assert.equal(options.resizable, true);
assert.deepEqual(options.classes, ["splittermond", "sheet", "actor", "splittermond-leveler", "lms-dialog-window"]);

options.classes.push("mutated");
assert.deepEqual(promptDialogOptions(520).classes, ["splittermond", "sheet", "actor", "splittermond-leveler", "lms-dialog-window"]);

const applicationOptions = promptDialogApplicationOptions({ title: "Meisterschaft lernen", width: 540 });

assert.equal(applicationOptions.tag, "form");
assert.equal(applicationOptions.window.title, "Meisterschaft lernen");
assert.equal(applicationOptions.window.resizable, true);
assert.equal(applicationOptions.window.minimizable, true);
assert.equal(applicationOptions.position.width, 540);
assert.deepEqual(applicationOptions.classes, ["splittermond", "sheet", "actor", "splittermond-leveler", "lms-dialog-window"]);

const html = dialogFormHtml({
    content: '<div class="lms-dialog-grid"><label>Name<input name="name" /></label></div>',
    confirmLabel: "Übernehmen",
});

assert.match(html, /class="lms-dialog-form"/);
assert.match(html, /class="lms-dialog-body"/);
assert.match(html, /data-lms-dialog-confirm/);
assert.match(html, /data-lms-dialog-cancel/);

console.log("dialog-window-options tests passed");
