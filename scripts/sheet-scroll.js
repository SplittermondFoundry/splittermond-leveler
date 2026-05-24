export function captureScrollPositions(root) {
    return scrollPositionElements(root).map((element) => ({
        element,
        top: numberValue(element.scrollTop),
        left: numberValue(element.scrollLeft),
    }));
}

export function restoreScrollPositions(snapshot) {
    for (const entry of snapshot ?? []) {
        const element = entry?.element;
        if (!isElementLike(element) || element.isConnected === false) continue;
        element.scrollTop = numberValue(entry.top);
        element.scrollLeft = numberValue(entry.left);
    }
}

function scrollPositionElements(root) {
    const elements = [];
    const seen = new Set();
    const add = (element) => {
        if (!isElementLike(element) || seen.has(element) || !hasScrollableState(element)) return;
        seen.add(element);
        elements.push(element);
    };

    for (let element = root; element; element = element.parentElement) add(element);

    if (typeof root?.querySelectorAll === "function") {
        for (const element of root.querySelectorAll("*")) add(element);
    }

    return elements;
}

function hasScrollableState(element) {
    return (
        numberValue(element.scrollTop) !== 0 ||
        numberValue(element.scrollLeft) !== 0 ||
        numberValue(element.scrollHeight) > numberValue(element.clientHeight) ||
        numberValue(element.scrollWidth) > numberValue(element.clientWidth)
    );
}

function isElementLike(value) {
    return value && typeof value === "object" && "scrollTop" in value && "scrollLeft" in value;
}

function numberValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}
