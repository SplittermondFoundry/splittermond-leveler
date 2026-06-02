import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("styles/let-me-skill.css", "utf8");

assert.match(css, /\.lms-dialog-form \.lms-choice-menu \{[^}]*max-height:\s*var\(--lms-choice-menu-max-height, calc\(28px \* 8\)\);/s);
assert.match(css, /\.lms-dialog-form \.lms-choice-menu \{[^}]*overflow-x:\s*hidden;/s);
assert.match(css, /\.lms-dialog-form \.lms-choice-menu \{[^}]*box-sizing:\s*border-box;/s);
assert.match(css, /\.lms-dialog-form \.lms-choice-picker\.lms-choice-opens-up \.lms-choice-menu \{[^}]*bottom:\s*calc\(100% \+ 2px\);/s);
assert.match(css, /\.lms-dialog-form \.lms-choice-row \{[^}]*min-height:\s*28px;/s);
assert.match(css, /\.lms-dialog-form \.lms-choice-row \{[^}]*box-sizing:\s*border-box;/s);
assert.match(css, /\.lms-dialog-form \.lms-choice-row-select \{[^}]*height:\s*28px;/s);
assert.match(css, /\.lms-dialog-form \.lms-choice-row-select \{[^}]*box-sizing:\s*border-box;/s);
assert.match(css, /\.lms-dialog-form \.lms-choice-row-show-item,[^}]*\.lms-dialog-form \.lms-choice-show-item \{[^}]*box-sizing:\s*border-box;/s);
assert.match(css, /\.lms-dialog-form \.lms-choice-row:hover,/);
assert.match(css, /\.lms-dialog-form \.lms-choice-row:focus-within \{[^}]*background:\s*#d8ccb2;/s);
assert.match(css, /\.lms-dialog-form \.lms-choice-row:hover \.lms-choice-row-select,/);
assert.match(css, /\.lms-dialog-form \.lms-choice-row:focus-within \.lms-choice-row-select \{[^}]*color:\s*#1b130d;/s);

console.log("dropdown-css tests passed");
