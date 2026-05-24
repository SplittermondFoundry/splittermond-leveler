import assert from "node:assert/strict";
import { captureScrollPositions, restoreScrollPositions } from "../scripts/sheet-scroll.js";

function fakeElement({ scrollTop = 0, scrollLeft = 0, scrollHeight = 100, clientHeight = 100, children = [], parentElement = null } = {}) {
    const element = {
        scrollTop,
        scrollLeft,
        scrollHeight,
        clientHeight,
        scrollWidth: 100,
        clientWidth: 100,
        children,
        parentElement,
        isConnected: true,
        querySelectorAll: () => children,
    };
    for (const child of children) child.parentElement = element;
    return element;
}

const skillList = fakeElement({ scrollTop: 80, scrollHeight: 500, clientHeight: 200 });
const sheetRoot = fakeElement({ children: [skillList] });
const windowContent = fakeElement({ scrollTop: 420, scrollHeight: 1200, clientHeight: 500 });
sheetRoot.parentElement = windowContent;

const snapshot = captureScrollPositions(sheetRoot);
windowContent.scrollTop = 0;
skillList.scrollTop = 0;

restoreScrollPositions(snapshot);

assert.equal(windowContent.scrollTop, 420);
assert.equal(skillList.scrollTop, 80);

const disconnected = fakeElement({ scrollTop: 150, scrollHeight: 500, clientHeight: 200 });
const disconnectedSnapshot = captureScrollPositions(disconnected);
disconnected.isConnected = false;
disconnected.scrollTop = 0;

restoreScrollPositions(disconnectedSnapshot);

assert.equal(disconnected.scrollTop, 0);

console.log("sheet-scroll tests passed");
