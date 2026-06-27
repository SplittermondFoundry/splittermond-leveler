import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("styles/let-me-skill.css", "utf8");

assert.match(css, /\.lms-choice-menu \{[^}]*position:\s*fixed;/s);
assert.match(css, /\.lms-choice-menu \{[^}]*z-index:\s*var\(--lms-choice-menu-z-index, 101\);/s);
assert.doesNotMatch(css, /\.lms-choice-menu \{[^}]*z-index:\s*1000;/s);
assert.match(css, /\.lms-choice-menu \{[^}]*top:\s*var\(--lms-choice-menu-top, auto\);/s);
assert.match(css, /\.lms-choice-menu \{[^}]*left:\s*var\(--lms-choice-menu-left, 0\);/s);
assert.match(css, /\.lms-choice-menu \{[^}]*width:\s*var\(--lms-choice-menu-width, 100%\);/s);
assert.match(css, /\.lms-choice-menu \{[^}]*max-height:\s*var\(--lms-choice-menu-max-height, calc\(28px \* 15\)\);/s);
assert.match(css, /\.lms-choice-menu \{[^}]*overflow-x:\s*hidden;/s);
assert.match(css, /\.lms-choice-menu \{[^}]*box-sizing:\s*border-box;/s);
assert.match(css, /\.lms-dialog-form \.lms-choice-sort-controls \{/s);
assert.match(css, /\.lms-dialog-form \.lms-choice-sort-button\.is-active \{/s);
assert.match(css, /\.lms-choice-menu \.lms-choice-group-heading \{/s);
assert.match(css, /\.lms-choice-menu\[hidden\] \{/s);
assert.match(css, /\.lms-choice-menu \.lms-choice-row \{[^}]*min-height:\s*28px;/s);
assert.match(css, /\.lms-choice-menu \.lms-choice-row \{[^}]*box-sizing:\s*border-box;/s);
assert.match(css, /\.lms-choice-menu \.lms-choice-row-select \{[^}]*height:\s*28px;/s);
assert.match(css, /\.lms-choice-menu \.lms-choice-row-select \{[^}]*box-sizing:\s*border-box;/s);
assert.match(css, /\.lms-choice-menu \.lms-choice-row-show-item,[^}]*\.lms-dialog-form \.lms-choice-show-item \{[^}]*box-sizing:\s*border-box;/s);
assert.match(css, /\.lms-choice-menu \.lms-choice-row:hover,/);
assert.match(css, /\.lms-choice-menu \.lms-choice-row:focus-within \{[^}]*background:\s*#d8ccb2;/s);
assert.match(css, /\.lms-choice-menu \.lms-choice-row:hover \.lms-choice-row-select,/);
assert.match(css, /\.lms-choice-menu \.lms-choice-row:focus-within \.lms-choice-row-select \{[^}]*color:\s*#1b130d;/s);

console.log("dropdown-css tests passed");
