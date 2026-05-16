export function calculateSnappedPanelPosition(anchorRect, viewport, options = {}) {
    const width = Number(options.width ?? 304);
    const gap = Number(options.gap ?? 8);
    const margin = Number(options.margin ?? 8);
    const viewportWidth = Number(viewport.width ?? 0);
    const viewportHeight = Number(viewport.height ?? 0);

    const rightCandidate = Math.round(anchorRect.right + gap);
    const leftCandidate = Math.round(anchorRect.left - width - gap);
    const maxLeft = Math.max(margin, viewportWidth - width - margin);

    let left = rightCandidate;
    let side = "right";

    if (rightCandidate + width > viewportWidth - margin) {
        if (leftCandidate >= margin) {
            left = leftCandidate;
            side = "left";
        } else {
            left = maxLeft;
            side = "right-clamped";
        }
    }

    left = Math.min(Math.max(left, margin), maxLeft);

    const top = Math.min(Math.max(Math.round(anchorRect.top), margin), Math.max(margin, viewportHeight - margin));
    const availableHeight = Math.max(120, viewportHeight - top - margin);
    const height = Math.round(Math.min(Math.max(anchorRect.height, 120), availableHeight));

    return { left, top, height, side };
}

export function shouldResetSheetStateOnClose({ documentName, documentType, actorDocumentName, actorType, hasActorSheetClass }) {
    if (documentName) return documentName === "Actor" && documentType === "character";
    return actorDocumentName === "Actor" && actorType === "character" && hasActorSheetClass === true;
}

export function sameSnappedPanelPosition(previous, next) {
    if (!previous || !next) return false;
    return previous.left === next.left && previous.top === next.top && previous.width === next.width && previous.height === next.height;
}

export function zIndexBelowAnchor(anchorZIndex) {
    const value = Number.parseInt(anchorZIndex, 10);
    return Number.isFinite(value) ? Math.max(1, value - 1) : null;
}
