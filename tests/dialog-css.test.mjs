import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("styles/let-me-skill.css", "utf8");

assert.match(css, /\.lms-dialog-window \{[^}]*min-width:\s*360px;/s);
assert.match(css, /\.lms-dialog-window \{[^}]*min-height:\s*220px;/s);
assert.match(
    css,
    /\.lms-dialog-window:not\(form\.application\),[^}]*\.lms-planning-window:not\(form\.application\),[^}]*\.lms-settings-window:not\(form\.application\) \{/s
);
assert.match(css, /\.lms-dialog-window \.window-content \{[^}]*overflow:\s*hidden;/s);
assert.match(css, /\.lms-dialog-form \{[^}]*height:\s*100%;/s);
assert.match(css, /\.lms-dialog-buttons \{[^}]*grid-template-columns:\s*1fr 1fr;/s);
assert.match(css, /\.lms-settings-form \{[^}]*overflow-y:\s*auto;/s);
assert.match(css, /\.lms-settings-subsection \{[^}]*display:\s*grid;/s);
assert.match(css, /\.lms-settings-actions \{[^}]*grid-template-columns:\s*1fr 1fr;/s);

console.log("dialog-css tests passed");
