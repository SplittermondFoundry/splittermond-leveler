import {
    ATTRIBUTE_DEFS,
    attributeCostForIncrease,
    buildPlannedItemData,
    choiceProgressionForSkill,
    createXpAdjustmentEntry,
    duplicateSelectionState,
    MAGIC_SCHOOLS,
    heldengradForSpent,
    heldengradLabel,
    itemAllowsMultipleSelection,
    itemChoiceMatchesSkill,
    languageCost,
    masteryCost,
    masteryThresholdRequirements,
    maxAttributeIncreasesForHeldengrad,
    maxMasteryThresholdForPoints,
    maxSkillPointsForHeldengrad,
    maxSpellGradeForPoints,
    mergeProgressionEntry,
    mergeResourceEntry,
    normalize,
    planCost,
    projectedFree,
    projectedHeldengrad,
    projectedSpent,
    resourceCostPerPoint,
    resourceMaximum,
    skillCostForPoint,
    skillDefById,
    skillHeldengradRequirement,
    spellCost,
    spellGradeRequirements,
    strengthCost,
} from "./advancement-rules.js";
import { registerAdvancementSettings } from "./advancement-settings.js";
import { choiceMenuLayout, choiceMenuZIndex, choiceSelectHtml as dialogChoiceSelectHtml, portalChoiceMenu } from "./dialog-choice-select.js";
import { dialogFormHtml, promptDialogApplicationOptions, promptDialogOptions } from "./dialog-window.js";
import { calculateSnappedPanelPosition, sameSnappedPanelPosition, shouldResetSheetStateOnClose, zIndexBelowAnchor } from "./panel-layout.js";
import { captureScrollPositions, restoreScrollPositions } from "./sheet-scroll.js";

const MODULE_ID = "splittermond-leveler";
const MODULE_VERSION = "0.1.20";
const FLAG_SCOPE = "splittermond-leveler";
const FLAG_KEY = "advancementUndo";
const ACTOR_UNDO_STATE_KEY = "advancementUndoState";
const sheetStates = new Map();
const itemChoiceCache = new Map();
const packIndexCache = new Map();
const ITEM_CHOICE_INDEX_FIELDS = [
    "system.skill",
    "system.level",
    "system.skillLevel",
    "system.availableIn",
    "system.multiSelectable",
];
const hasApplicationV2 = Boolean(globalThis.foundry?.applications?.api?.ApplicationV2);
const PlanningApplicationBase = hasApplicationV2
    ? globalThis.foundry.applications.api.HandlebarsApplicationMixin(globalThis.foundry.applications.api.ApplicationV2)
    : Application;

Hooks.once("init", () => {
    console.log("Leveler | init");
    registerAdvancementSettings();
});

Hooks.once("ready", () => {
    registerUndoHandler();
});

Hooks.on("renderApplicationV2", enhanceIfSplittermondCharacterSheet);
Hooks.on("renderActorSheet", enhanceIfSplittermondCharacterSheet);
Hooks.on("renderSplittermondCharacterSheet", enhanceIfSplittermondCharacterSheet);
Hooks.on("renderChatMessageHTML", refreshUndoChatMessageDisplay);
Hooks.on("renderChatMessage", refreshUndoChatMessageDisplay);
Hooks.on("updateActor", refreshUndoChatCardsForActor);
Hooks.on("closeApplicationV2", resetSheetStateIfClosed);
Hooks.on("closeApplication", resetSheetStateIfClosed);
Hooks.on("closeActorSheet", resetSheetStateIfClosed);
Hooks.on("closeSplittermondCharacterSheet", resetSheetStateIfClosed);

function enhanceIfSplittermondCharacterSheet(app, html) {
    const root = htmlRoot(html);
    const actor = app?.actor ?? app?.document ?? null;
    if (!root || !actor || actor.documentName !== "Actor" || actor.type !== "character") return;

    const container = root.classList?.contains("splittermond") ? root : root.querySelector?.(".splittermond");
    const sheetRoot = container ?? root;
    if (!sheetRoot.querySelector?.(".experience")) return;

    enhanceSheet(app, actor, sheetRoot);
}

function htmlRoot(html) {
    if (html instanceof HTMLElement) return html;
    if (html?.[0] instanceof HTMLElement) return html[0];
    return null;
}

function enhanceSheet(app, actor, root) {
    const state = getSheetState(actor);
    state.app = app;
    bindCloseReset(app, actor, state);
    bindTabRefresh(app, actor, root);

    injectXpButtons(app, actor, root);
    clearGenerated(root, app, actor);
    root.classList.toggle("lms-advancement-active", state.active);
    root.closest(".application, .app, .window-app")?.classList.toggle("lms-advancement-window", state.active);

    if (!state.active) {
        closePlanningWindow(actor);
        return;
    }

    const actorState = buildActorState(actor);
    injectSectionButtons(app, actorState, state, root);
    injectAttributeControls(app, actorState, state, root);
    injectResourceControls(app, actorState, state, root);
    injectSkillControls(app, actorState, state, root);
    injectMasteryListControls(app, actorState, state, root);
    injectSpellTabControls(app, actorState, state, root);
    renderPlanningPanel(app, actorState, state, root);
}

function sheetStateKey(actor) {
    return actor?.uuid ?? actor?.id ?? "";
}

function getSheetState(actor) {
    const key = actor.uuid ?? actor.id;
    if (!sheetStates.has(key)) {
        sheetStates.set(key, {
            active: false,
            plan: [],
            nextId: 1,
            originalWidth: null,
            app: null,
            planningWindow: null,
        });
    }
    return sheetStates.get(key);
}

class AdvancementPlanningWindow extends PlanningApplicationBase {
    constructor(actor, sheetState) {
        super(
            hasApplicationV2
                ? {
                      id: `splittermond-leveler-planning-${actor.id}`,
                      window: {
                          title: `Steigerungsplanung v${MODULE_VERSION}`,
                          minimizable: true,
                          resizable: true,
                      },
                      position: { width: 320, height: 600 },
                  }
                : { id: `splittermond-leveler-planning-${actor.id}` }
        );
        this.actor = actor;
        this.sheetState = sheetState;
        this.sheetApp = null;
        this.sheetRoot = null;
        this.positionInterval = null;
        this.lastSnappedPosition = null;
        this.suppressStateUpdate = false;
    }

    static DEFAULT_OPTIONS = {
        id: "splittermond-leveler-planning",
        tag: "form",
        classes: ["splittermond", "sheet", "actor", "splittermond-leveler", "lms-planning-window"],
        position: { width: 320, height: 600 },
        window: {
            title: `Steigerungsplanung v${MODULE_VERSION}`,
            minimizable: true,
            resizable: true,
        },
    };

    static PARTS = {
        content: {
            template: `modules/${MODULE_ID}/templates/planning-panel.hbs`,
            scrollable: [".lms-planning-panel"],
        },
    };

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions ?? {}, {
            id: "splittermond-leveler-planning",
            title: `Steigerungsplanung v${MODULE_VERSION}`,
            classes: ["splittermond", "sheet", "actor", "splittermond-leveler", "lms-planning-window"],
            width: 320,
            height: 600,
            resizable: true,
            minimizable: true,
        });
    }

    updateContext(sheetApp, sheetRoot) {
        this.sheetApp = sheetApp;
        this.sheetRoot = sheetRoot;
    }

    async _prepareContext(options) {
        const context = typeof super._prepareContext === "function" ? await super._prepareContext(options) : {};
        const actorState = buildActorState(this.actor);
        return {
            ...context,
            content: planningPanelHtml(actorState, this.sheetState),
        };
    }

    async _renderInner() {
        const actorState = buildActorState(this.actor);
        const element = document.createElement("section");
        element.className = "lms-planning-panel";
        element.innerHTML = planningPanelHtml(actorState, this.sheetState);
        return $(element);
    }

    activateListeners(html) {
        super.activateListeners(html);
        const root = htmlRoot(html);
        if (!root) return;
        bindPlanningPanelListeners(root, this.sheetApp, this.actor, this.sheetState);
    }

    async _onRender(context, options) {
        if (typeof super._onRender === "function") await super._onRender(context, options);
        const root = this.element instanceof HTMLElement ? this.element.querySelector(".lms-planning-panel") : null;
        if (root) bindPlanningPanelListeners(root, this.sheetApp, this.actor, this.sheetState);
        this.startPositionTracking();
        this.snapToSheet();
    }

    async render(force = false, options = {}) {
        const result = hasApplicationV2 ? await super.render(typeof force === "object" ? force : { force, ...options }) : await super.render(force, options);
        this.startPositionTracking();
        this.snapToSheet();
        return result;
    }

    startPositionTracking() {
        if (this.positionInterval) return;
        this.positionInterval = window.setInterval(() => {
            if (!this.rendered || !this.sheetState.active) {
                this.stopPositionTracking();
                return;
            }
            this.snapToSheet();
        }, 160);
    }

    stopPositionTracking() {
        if (!this.positionInterval) return;
        window.clearInterval(this.positionInterval);
        this.positionInterval = null;
    }

    snapToSheet() {
        const anchor = this.sheetApp?.element instanceof HTMLElement ? this.sheetApp.element : this.sheetRoot?.closest?.(".application, .app, .window-app");
        const element = this.element instanceof HTMLElement ? this.element : this.element?.[0];
        if (!(anchor instanceof HTMLElement) || !(element instanceof HTMLElement)) return;

        const width = this.position?.width ?? this.options.width ?? 320;
        const position = calculateSnappedPanelPosition(
            anchor.getBoundingClientRect(),
            { width: window.innerWidth, height: window.innerHeight },
            { width, gap: 8, margin: 8 }
        );
        syncPlanningWindowDepth(element, anchor);

        const nextPosition = { left: position.left, top: position.top, width, height: position.height };
        if (sameSnappedPanelPosition(this.lastSnappedPosition, nextPosition)) return;
        this.lastSnappedPosition = nextPosition;
        this.setPosition(nextPosition);
        syncPlanningWindowDepth(element, anchor);
    }

    async close(options = {}) {
        this.stopPositionTracking();
        const shouldUpdateState = !this.suppressStateUpdate;
        this.suppressStateUpdate = false;
        if (this.sheetState?.planningWindow === this) this.sheetState.planningWindow = null;
        if (shouldUpdateState && this.sheetState?.active) {
            this.sheetState.active = false;
            rerenderSheet(this.sheetApp, this.actor);
        }
        return super.close(options);
    }
}

class LevelerPromptWindow extends PlanningApplicationBase {
    constructor({ title, content, confirmLabel, width, render, resolve }) {
        super(promptDialogApplicationOptions({ title, width }));
        this.dialogContent = content;
        this.confirmLabel = confirmLabel;
        this.renderCallback = render;
        this.resolvePrompt = resolve;
        this.resolved = false;
    }

    static DEFAULT_OPTIONS = promptDialogApplicationOptions({ title: "", width: 480 });

    static PARTS = {
        content: {
            template: `modules/${MODULE_ID}/templates/dialog-form.hbs`,
            scrollable: [".lms-dialog-body"],
        },
    };

    async _prepareContext(options) {
        const context = typeof super._prepareContext === "function" ? await super._prepareContext(options) : {};
        return {
            ...context,
            content: dialogFormHtml({ content: this.dialogContent, confirmLabel: this.confirmLabel }),
        };
    }

    async _renderInner() {
        const element = document.createElement("section");
        element.innerHTML = dialogFormHtml({ content: this.dialogContent, confirmLabel: this.confirmLabel });
        return $(element);
    }

    activateListeners(html) {
        super.activateListeners(html);
        this.bindPromptListeners(htmlRoot(html));
    }

    async _onRender(context, options) {
        if (typeof super._onRender === "function") await super._onRender(context, options);
        this.bindPromptListeners(this.element instanceof HTMLElement ? this.element : null);
    }

    bindPromptListeners(element) {
        const root = element?.querySelector?.(".lms-dialog-form");
        if (!root) return;
        if (root.dataset.lmsPromptBound === "true") return;
        root.dataset.lmsPromptBound = "true";
        root.querySelector("[data-lms-dialog-confirm]")?.addEventListener("click", () => this.confirm());
        root.querySelector("[data-lms-dialog-cancel]")?.addEventListener("click", () => this.cancel());
        if (this.renderCallback) this.renderCallback(root);
    }

    confirm() {
        const form = this.element instanceof HTMLFormElement ? this.element : this.element?.closest?.("form") ?? null;
        this.finish(form ? Object.fromEntries(new FormData(form).entries()) : null);
        this.close();
    }

    cancel() {
        this.finish(null);
        this.close();
    }

    finish(value) {
        if (this.resolved) return;
        this.resolved = true;
        this.resolvePrompt(value);
    }

    async close(options = {}) {
        this.finish(null);
        return super.close(options);
    }
}

function clearGenerated(root, app = null, actor = null) {
    root.querySelectorAll(".lms-generated").forEach((element) => element.remove());
    app?.element?.querySelectorAll?.(".lms-generated").forEach((element) => element.remove());
    cleanupGeneratedState(root);
    if (app?.element instanceof HTMLElement && app.element !== root) cleanupGeneratedState(app.element);
    removeFloatingPanels(actor);
}

function cleanupGeneratedState(root) {
    if (!(root instanceof HTMLElement)) return;
    root.querySelectorAll(".lms-has-inline-controls").forEach((element) => element.classList.remove("lms-has-inline-controls"));
    root.querySelectorAll(".lms-skill-name-cell").forEach((element) => element.classList.remove("lms-skill-name-cell"));
    root.querySelectorAll(".lms-mastery-list-action").forEach(restoreMasteryListButton);
}

function storeMasteryListButtonState(button) {
    if (button.dataset.lmsOriginalDisabled !== undefined) return;
    button.dataset.lmsOriginalDisabled = button.disabled ? "true" : "false";
    button.dataset.lmsHadOriginalTitle = button.hasAttribute("title") ? "true" : "false";
    button.dataset.lmsOriginalTitle = button.getAttribute("title") ?? "";
}

function restoreMasteryListButton(button) {
    if (!(button instanceof HTMLButtonElement)) return;
    button.classList.remove("lms-mastery-list-action");
    if (button.dataset.lmsOriginalDisabled !== undefined) {
        button.disabled = button.dataset.lmsOriginalDisabled === "true";
    }
    if (button.dataset.lmsHadOriginalTitle === "true") {
        button.setAttribute("title", button.dataset.lmsOriginalTitle ?? "");
    } else {
        button.removeAttribute("title");
    }
}

function removeFloatingPanels(actor = null) {
    const actorKey = sheetStateKey(actor);
    document.querySelectorAll(".lms-planning-panel.lms-generated").forEach((element) => {
        if (!actorKey || element.dataset.lmsActorKey === actorKey) element.remove();
    });
}

function closePlanningWindow(actor) {
    const state = actor ? getSheetState(actor) : null;
    const planningWindow = state?.planningWindow;
    if (!planningWindow) return;
    state.planningWindow = null;
    planningWindow.suppressStateUpdate = true;
    planningWindow.close();
}

function injectXpButtons(app, actor, root) {
    const experienceValue = root.querySelector(".experience .experience-value");
    if (!experienceValue || experienceValue.querySelector(".lms-xp-actions")) return;

    const actions = document.createElement("span");
    actions.className = "lms-xp-actions";
    actions.innerHTML = `
        <button type="button" class="button-inline lms-xp-spend" title="Erfahrungspunkte ausgeben">
            <i class="fa fa-shopping-basket" aria-hidden="true"></i>
        </button>
        <button type="button" class="button-inline lms-xp-add" title="Erfahrungspunkte hinzufügen">
            <i class="fa fa-plus" aria-hidden="true"></i>
        </button>
    `;
    experienceValue.prepend(actions);

    actions.querySelector(".lms-xp-add")?.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await runSafely(async () => {
            await addFreeXp(actor);
            rerenderSheet(app, actor);
        });
    });

    actions.querySelector(".lms-xp-spend")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleAdvancementMode(app, actor);
    });
}

async function addFreeXp(actor) {
    const data = await promptForm({
        title: "Erfahrungspunkte hinzufügen",
        content: `
            <div class="lms-dialog-grid">
                <label><strong>XP</strong></label>
                <div class="lms-number-stepper">
                    <button type="button" data-lms-number-step="-5" title="5 XP reduzieren">-5</button>
                    <button type="button" data-lms-number-step="-3" title="3 XP reduzieren">-3</button>
                    <button type="button" data-lms-number-step="-1" title="1 XP reduzieren">-</button>
                    <input type="number" name="xp" value="1" min="1" step="1" />
                    <button type="button" data-lms-number-step="1" title="1 XP erhöhen">+</button>
                    <button type="button" data-lms-number-step="3" title="3 XP erhöhen">+3</button>
                    <button type="button" data-lms-number-step="5" title="5 XP erhöhen">+5</button>
                </div>
            </div>
        `,
        confirmLabel: "Hinzufügen",
        width: 360,
        render: bindNumberStepper,
    });
    if (!data) return;

    const xp = Number.parseInt(data.xp, 10);
    if (!Number.isInteger(xp) || xp <= 0) throwUserError("Bitte gib eine positive ganze Zahl ein.");

    const current = numberValue(getPropertySafe(actor.system, "experience.free"), 0);
    await actor.update({ "system.experience.free": current + xp });
    await createXpAdjustmentChatMessage(actor, xp);
    notifyInfo(`${xp} freie XP hinzugefügt.`);
}

function toggleAdvancementMode(app, actor) {
    const state = getSheetState(actor);
    state.active = !state.active;
    state.originalWidth = null;
    if (!state.active) closePlanningWindow(actor);
    rerenderSheet(app, actor);
}

function resetSheetStateIfClosed(app) {
    const actor = app?.document?.documentName === "Actor" ? app.document : app?.actor ?? null;
    const shouldReset = shouldResetSheetStateOnClose({
        documentName: app?.document?.documentName ?? null,
        documentType: app?.document?.type ?? null,
        actorDocumentName: app?.actor?.documentName ?? null,
        actorType: app?.actor?.type ?? null,
        hasActorSheetClass: appHasClass(app, "actor"),
    });
    if (!actor || !shouldReset) return;
    resetActorSheetState(actor);
}

function appHasClass(app, className) {
    if (app?.classList?.contains?.(className)) return true;
    if (Array.isArray(app?.options?.classes) && app.options.classes.includes(className)) return true;
    const element = app?.element instanceof HTMLElement ? app.element : app?.element?.[0];
    return element?.classList?.contains?.(className) ?? false;
}

function bindCloseReset(app, actor, state) {
    if (!app?.addEventListener || state.closeResetBoundTo === app) return;
    state.closeResetBoundTo = app;
    app.addEventListener("close", () => resetActorSheetState(actor));
}

function bindTabRefresh(app, actor, root) {
    if (root.dataset.lmsTabRefreshBound === "1") return;
    root.dataset.lmsTabRefreshBound = "1";
    root.addEventListener("click", (event) => {
        const tab = event.target?.closest?.("[data-tab]");
        if (!tab || !root.contains(tab) || tab.matches("section.tab[data-tab], section[data-tab]")) return;
        if (!getSheetState(actor).active) return;
        window.setTimeout(() => rerenderSheet(app, actor), 0);
    });
}

function syncPlanningWindowDepth(element, anchor) {
    const zIndex = zIndexBelowAnchor(window.getComputedStyle(anchor).zIndex);
    if (zIndex === null) return;
    element.style.zIndex = String(zIndex);
}

function resetActorSheetState(actor) {
    const state = getSheetState(actor);
    state.active = false;
    state.plan = [];
    state.originalWidth = null;
    removeFloatingPanels(actor);
    closePlanningWindow(actor);
}

function buildActorState(actor) {
    const xp = {
        free: numberValue(getPropertySafe(actor.system, "experience.free"), 0),
        spent: numberValue(getPropertySafe(actor.system, "experience.spent"), 0),
        heroLevel: numberValue(getPropertySafe(actor.system, "experience.heroLevel"), null),
    };
    xp.heroLevel = xp.heroLevel ?? heldengradForSpent(xp.spent);

    const attributes = {};
    for (const def of ATTRIBUTE_DEFS) {
        const initial = numberValue(getPropertySafe(actor.system, `attributes.${def.id}.initial`), 0);
        const species = numberValue(getPropertySafe(actor.system, `attributes.${def.id}.species`), 0);
        const advances = numberValue(getPropertySafe(actor.system, `attributes.${def.id}.advances`), 0);
        const start = initial + species;
        const current = numberValue(getPropertySafe(actor.system, `attributes.${def.id}.value`), start + advances);
        attributes[def.id] = {
            id: def.id,
            label: def.label(),
            short: def.short(),
            initial,
            species,
            start,
            advances,
            current,
        };
    }

    const skills = {};
    for (const def of [...skillDefinitionsInActor(actor)]) {
        const points = numberValue(getPropertySafe(actor.system, `skills.${def.id}.points`), 0);
        skills[def.id] = {
            id: def.id,
            label: def.label(),
            type: def.type,
            points,
        };
    }

    return { actor, xp, attributes, skills };
}

function skillDefinitionsInActor(actor) {
    const defs = [];
    for (const [id] of Object.entries(actor.system?.skills ?? {})) {
        const def = skillDefById(id);
        if (def) defs.push(def);
    }
    return defs;
}

function injectSectionButtons(app, actorState, sheetState, root) {
    const sections = [
        {
            selector: 'section[data-tab="general"] .list[data-item-type="strength"] .list-header',
            label: "St\u00e4rke Erwerben",
            action: () => addStrengthEntry(app, actorState, sheetState),
        },
        {
            selector: 'section[data-tab="general"] .list[data-item-type="resource"] .list-header',
            label: "neue Resourcen",
            action: () => addResourceEntry(app, actorState, sheetState, null),
        },
        {
            selector: 'section[data-tab="general"] .list[data-item-type="language"] .list-header',
            label: "Sprache lernen",
            action: () => addLanguageEntry(app, actorState, sheetState),
        },
    ];

    for (const section of sections) {
        const header = root.querySelector(section.selector);
        if (!header) continue;
        const controls = document.createElement("div");
        controls.className = "lms-section-controls lms-generated";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "button-inline lms-section-action lms-generated";
        button.title = section.label;
        button.innerHTML = `<i class="fa fa-graduation-cap" aria-hidden="true"></i><span>${section.label}</span>`;
        button.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await runSafely(section.action);
        });
        controls.append(button);
        header.after(controls);
    }
}

function injectAttributeControls(app, actorState, sheetState, root) {
    root.querySelectorAll('section[data-tab="general"] .list-attributes .list-item.attribute').forEach((row) => {
        const input = row.querySelector('input[name^="system.attributes."][name$=".value"]');
        const match = input?.name?.match(/^system\.attributes\.([^.]+)\.value$/);
        const attributeId = match?.[1];
        if (!attributeId || !actorState.attributes[attributeId]) return;

        row.classList.add("lms-has-inline-controls");
        attachInlineControls(
            row,
            ".value",
            makeInlineControls({
                kind: "attribute",
                label: "Steigern",
                value: plannedAttributeDelta(sheetState.plan, attributeId),
                canIncrease: canAddAttribute(actorState, sheetState.plan, attributeId).ok,
                onIncrease: () => addAttributeStep(app, actorState, sheetState, attributeId),
                onDecrease: () => removeLatestEntry(app, actorState.actor, sheetState, (entry) => entry.type === "attribute" && entry.attributeId === attributeId),
            })
        );
    });
}

function injectResourceControls(app, actorState, sheetState, root) {
    root.querySelectorAll('section[data-tab="general"] .list[data-item-type="resource"] .list-item[data-item-id]').forEach((row) => {
        const itemId = row.getAttribute("data-item-id");
        const item = getActorItemById(actorState.actor, itemId);
        if (!item || item.type !== "resource") return;

        row.classList.add("lms-has-inline-controls");
        attachInlineControls(
            row,
            ".value",
            makeInlineControls({
                kind: "resource",
                label: "Steigern",
                value: plannedResourceDelta(sheetState.plan, item.id),
                canIncrease: canAddResource(actorState, sheetState.plan, item).ok,
                onIncrease: () => addResourceEntry(app, actorState, sheetState, item),
                onDecrease: () => decreaseResourceStep(app, actorState, sheetState, item),
            })
        );
    });
}

function injectSkillControls(app, actorState, sheetState, root) {
    root.querySelectorAll('section[data-tab="skills"] .list.skills .list-item[data-skill]').forEach((row) => {
        const skillId = row.getAttribute("data-skill");
        const skill = actorState.skills[skillId];
        if (!skill) return;
        const labelCell = row.querySelector("label");
        if (!(labelCell instanceof HTMLElement) || !labelCell.textContent.trim()) return;

        row.classList.add("lms-has-inline-controls");
        labelCell.classList.add("lms-skill-name-cell");
        const controls = makeInlineControls({
            kind: "skill",
            label: "Steigern",
            value: plannedSkillDelta(sheetState.plan, skillId),
            canIncrease: canAddSkill(actorState, sheetState.plan, skillId).ok,
            onIncrease: () => addSkillStep(app, actorState, sheetState, skillId),
            onDecrease: () => decreaseSkillStep(app, actorState, sheetState, skillId),
        });
        attachInlineControls(row, ".points", controls);

        const actionRow = document.createElement("div");
        actionRow.className = "lms-row-actions lms-generated";

        const masteryValidation = canAddMastery(actorState, sheetState.plan, skillId);
        actionRow.append(
            makeActionButton({
                label: "Meisterschaft lernen",
                icon: "fa-certificate",
                disabled: !masteryValidation.ok,
                title: masteryValidation.reason ?? "Meisterschaft lernen",
                onClick: () => addMasteryEntry(app, actorState, sheetState, skillId, { free: false }),
            })
        );

        if (skill.type === "magic") {
            const spellValidation = canAddSpell(actorState, sheetState.plan, skillId);
            actionRow.append(
                makeActionButton({
                    label: "Zauber lernen",
                    icon: "fa-magic",
                    disabled: !spellValidation.ok,
                    title: spellValidation.reason ?? "Zauber lernen",
                    onClick: () => addSpellEntry(app, actorState, sheetState, skillId, { free: false }),
                })
            );
        }

        labelCell.append(actionRow);
    });
}

function injectMasteryListControls(app, actorState, sheetState, root) {
    root.querySelectorAll('section[data-tab="skills"] .list.masteries .list-item[data-skill]').forEach((row) => {
        const skillId = row.getAttribute("data-skill");
        if (!skillId || !actorState.skills[skillId]) return;

        const button = row.querySelector('.taglist-actions button[data-action="add-item"]');
        if (!(button instanceof HTMLButtonElement)) return;

        const validation = canAddMastery(actorState, sheetState.plan, skillId);
        storeMasteryListButtonState(button);
        button.classList.add("lms-mastery-list-action");
        button.disabled = !validation.ok;
        button.title = validation.reason ?? "Meisterschaft lernen";

        if (button.dataset.lmsMasteryBound === "true") return;
        button.dataset.lmsMasteryBound = "true";
        button.addEventListener(
            "click",
            async (event) => {
                if (!button.classList.contains("lms-mastery-list-action")) return;
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                if (button.disabled) return;
                await runSafely(() => addMasteryEntry(app, actorState, sheetState, skillId, { free: false }));
            },
            { capture: true }
        );
    });
}

function injectSpellTabControls(app, actorState, sheetState, root) {
    const searchRoot = app?.element instanceof HTMLElement ? app.element : root;
    searchRoot
        .querySelectorAll('section[data-tab="spells"] .list.spells > .list-header, section[data-tab="spells"] .list[data-item-type="spell"] > .list-header')
        .forEach((header) => {
            const labelText = header.querySelector("h3")?.textContent ?? "";
            const skillId = magicSkillIdFromHeader(actorState, labelText);
            if (!skillId) return;

            const skill = actorState.skills[skillId] ?? {
                id: skillId,
                label: skillDefById(skillId)?.label?.() ?? labelText.replace(/\([^)]*\)\s*$/, "").trim(),
                type: "magic",
                points: 0,
            };
            const validation = canAddSpell(actorState, sheetState.plan, skillId);
            const action = makeActionButton({
                label: "Neuen Zauber lernen",
                icon: "fa-magic",
                disabled: !validation.ok,
                title: validation.reason ?? `Neuen Zauber für ${skill.label} erwerben`,
                onClick: () => addSpellEntry(app, actorState, sheetState, skillId, { free: false }),
            });
            action.classList.add("lms-generated", "lms-spell-header-action");
            const controls = document.createElement("div");
            controls.className = "lms-spell-school-controls lms-generated";
            controls.append(action);
            header.after(controls);
        });
}

function magicSkillIdFromHeader(actorState, headerText) {
    const label = String(headerText ?? "").replace(/\([^)]*\)\s*$/, "").trim();
    const normalized = normalize(label);
    const byActorSkill = Object.values(actorState.skills).find(
        (skill) => skill.type === "magic" && normalize(skill.label) === normalized
    );
    if (byActorSkill) return byActorSkill.id;
    return MAGIC_SCHOOLS.find((skill) => normalize(skill.label()) === normalized)?.id ?? null;
}

function makeInlineControls({ kind, label, value, canIncrease, onIncrease, onDecrease }) {
    const controls = document.createElement("div");
    controls.className = `lms-inline-controls lms-generated lms-${kind}-controls`;
    controls.setAttribute("aria-label", label);
    controls.innerHTML = `
        <button type="button" class="button-inline lms-step-minus" title="Geplante Steigerung reduzieren">
            <i class="fa fa-minus" aria-hidden="true"></i>
        </button>
        <span class="lms-planned-value">+${value}</span>
        <button type="button" class="button-inline lms-step-plus" title="${label}">
            <i class="fa fa-plus" aria-hidden="true"></i>
        </button>
    `;
    const minus = controls.querySelector(".lms-step-minus");
    const plus = controls.querySelector(".lms-step-plus");
    minus.disabled = value <= 0;
    plus.disabled = !canIncrease;

    minus.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await runSafely(onDecrease);
    });
    plus.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await runSafely(onIncrease);
    });
    return controls;
}

function attachInlineControls(row, selector, controls) {
    const target = row.querySelector(selector);
    if (target instanceof HTMLElement) {
        target.append(controls);
    } else {
        row.append(controls);
    }
}

function makeActionButton({ label, icon, disabled, title, onClick }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button-inline lms-action-button";
    button.disabled = disabled;
    button.title = title;
    button.innerHTML = `<i class="fa ${icon}" aria-hidden="true"></i><span>${label}</span>`;
    button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) return;
        await runSafely(onClick);
    });
    return button;
}

function renderPlanningPanel(app, actorState, sheetState, root) {
    if (!sheetState.planningWindow) {
        sheetState.planningWindow = new AdvancementPlanningWindow(actorState.actor, sheetState);
    }
    sheetState.planningWindow.updateContext(app, root);
    sheetState.planningWindow.render(true);
}

function planningPanelHtml(actorState, sheetState) {
    const spent = projectedSpent(actorState, sheetState.plan);
    const free = projectedFree(actorState, sheetState.plan);
    const planned = planCost(sheetState.plan);
    const heldengrad = heldengradForSpent(spent);

    return `
        <div class="lms-panel-actor">${escapeHtml(actorState.actor.name)}</div>
        <div class="lms-stat-grid">
            ${statCard("Freie XP", actorState.xp.free)}
            ${statCard("Verbrauchte XP", actorState.xp.spent)}
            ${statCard("Geplant", planned)}
            ${statCard("Verbleibend", free, free < 0 ? "danger" : "ok")}
        </div>
        <div class="lms-heldengrad">Nach dem Anwenden: Heldengrad ${heldengrad} (${escapeHtml(heldengradLabel(heldengrad))})</div>
        <section class="lms-plan-list">
            <h3>Geplante Steigerungen</h3>
            ${
                sheetState.plan.length
                    ? `<ol>${sheetState.plan
                          .map((entry) => {
                              const duplicateState = duplicatePlanEntryState(actorState, sheetState.plan, entry);
                              return `
                    <li data-entry-id="${entry.id}">
                        <div class="lms-plan-entry-main">
                            <strong>${escapeHtml(entry.summary)}</strong>
                            <span>${entry.cost > 0 ? `${entry.cost} XP` : "kostenfrei"}</span>
                            ${
                                duplicateState.warning
                                    ? `<small class="lms-duplicate-warning"><i class="fa fa-exclamation-triangle" aria-hidden="true"></i>${escapeHtml(duplicateState.warning)}</small>`
                                    : ""
                            }
                        </div>
                        <div class="lms-plan-entry-actions">
                            ${
                                entry.sourceUuid
                                    ? `<button type="button" class="button-inline lms-show-plan-item" data-source-uuid="${escapeHtml(entry.sourceUuid)}" title="Item anzeigen">
                                <i class="fa fa-eye" aria-hidden="true"></i>
                            </button>`
                                    : ""
                            }
                            <button type="button" class="button-inline lms-remove-entry" title="Eintrag entfernen">
                                <i class="fa fa-trash" aria-hidden="true"></i>
                            </button>
                        </div>
                    </li>
                `;
                          })
                          .join("")}</ol>`
                    : `<p>Noch keine geplanten Steigerungen.</p>`
            }
        </section>
        <footer class="lms-panel-actions">
            <button type="button" class="lms-clear-plan" ${sheetState.plan.length ? "" : "disabled"}>Alle löschen</button>
            <button type="button" class="lms-apply-plan" ${sheetState.plan.length && free >= 0 ? "" : "disabled"}>Anwenden</button>
        </footer>
    `;
}

function bindPlanningPanelListeners(root, app, actor, sheetState) {
    root.querySelector(".lms-clear-plan")?.addEventListener("click", (event) => {
        event.preventDefault();
        if (!sheetState.plan.length) return;
        sheetState.plan = [];
        rerenderSheet(app, actor);
    });
    root.querySelector(".lms-apply-plan")?.addEventListener("click", async (event) => {
        event.preventDefault();
        await runSafely(() => applyPlan(app, buildActorState(actor), sheetState));
    });
    root.querySelectorAll(".lms-remove-entry").forEach((button) => {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            const entryId = button.closest("li")?.getAttribute("data-entry-id");
            removeEntryAndChildren(sheetState, entryId);
            rerenderSheet(app, actor);
        });
    });
    root.querySelectorAll(".lms-show-plan-item").forEach((button) => {
        button.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const uuid = button.getAttribute("data-source-uuid");
            await runSafely(() => openItemDocument(uuid));
        });
    });
}

function trackPlanningPanel(panel, app, actor, root) {
    positionPlanningPanel(panel, app, root);
    const intervalId = window.setInterval(() => {
        if (!panel.isConnected || !getSheetState(actor).active) {
            window.clearInterval(intervalId);
            return;
        }
        positionPlanningPanel(panel, app, root);
    }, 120);
}

function positionPlanningPanel(panel, app, root) {
    const anchor = app?.element instanceof HTMLElement ? app.element : root.closest?.(".application, .app, .window-app") ?? root;
    if (!(anchor instanceof HTMLElement)) return;

    const position = calculateSnappedPanelPosition(
        anchor.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight },
        { width: 304, gap: 8, margin: 8 }
    );
    const zIndex = Number.parseInt(window.getComputedStyle(anchor).zIndex, 10);

    panel.dataset.lmsSide = position.side;
    panel.style.left = `${position.left}px`;
    panel.style.top = `${position.top}px`;
    panel.style.width = "304px";
    panel.style.height = `${position.height}px`;
    panel.style.zIndex = String(Number.isFinite(zIndex) ? zIndex + 1 : 120);
}

function statCard(label, value, variant = "") {
    return `
        <div class="lms-stat-card ${variant ? `lms-${variant}` : ""}">
            <span>${label}</span>
            <strong>${value}</strong>
        </div>
    `;
}

function canAddAttribute(actorState, plan, attributeId) {
    const attribute = actorState.attributes[attributeId];
    if (!attribute) return { ok: false, reason: "Attribut nicht gefunden." };
    const current = projectedAttributeCurrent(actorState, plan, attributeId);
    const nextIncrease = current - attribute.start + 1;
    const cost = attributeCostForIncrease(nextIncrease);
    if (cost == null) return { ok: false, reason: "Dieses Attribut kann nicht weiter gesteigert werden." };

    const heldengradAfter = projectedHeldengrad(actorState, plan);
    if (heldengradAfter < nextIncrease || nextIncrease > maxAttributeIncreasesForHeldengrad(heldengradAfter)) {
        return { ok: false, reason: `Für diese Steigerung wird Heldengrad ${nextIncrease} benötigt.` };
    }
    if (projectedFree(actorState, plan) < cost) return { ok: false, reason: "Nicht genug freie XP." };
    return { ok: true, cost, current, next: current + 1 };
}

function canAddSkill(actorState, plan, skillId) {
    const skill = actorState.skills[skillId];
    if (!skill) return { ok: false, reason: "Fertigkeit nicht gefunden." };

    const target = projectedSkillPoints(actorState, plan, skillId) + 1;
    const cost = skillCostForPoint(target);
    const heldengradAfter = projectedHeldengrad(actorState, plan);
    const required = skillHeldengradRequirement(target);
    if (heldengradAfter < required || target > maxSkillPointsForHeldengrad(heldengradAfter)) {
        return { ok: false, reason: `Für ${target} Punkte wird Heldengrad ${required} benötigt.` };
    }
    if (projectedFree(actorState, plan) < cost) return { ok: false, reason: "Nicht genug freie XP." };
    return { ok: true, cost, target };
}

function canAddResource(actorState, plan, item) {
    const current = projectedResourceLevel(actorState, plan, item.name, item.id);
    const maximum = resourceMaximum();
    const cost = resourceCostPerPoint();
    if (current >= maximum) return { ok: false, reason: "Ressource ist bereits auf Maximum." };
    if (projectedFree(actorState, plan) < cost) return { ok: false, reason: "Nicht genug freie XP." };
    return { ok: true, cost };
}

function canAddMastery(actorState, plan, skillId) {
    const points = projectedSkillPoints(actorState, plan, skillId);
    const maxThreshold = maxMasteryThresholdForPoints(points);
    if (maxThreshold < 1) return { ok: false, reason: "Meisterschaften sind ab 6 Fertigkeitspunkten möglich." };
    if (projectedFree(actorState, plan) < masteryCost(1)) return { ok: false, reason: "Nicht genug freie XP." };
    return { ok: true, maxThreshold };
}

function canAddSpell(actorState, plan, skillId) {
    const skill = actorState.skills[skillId];
    if (!skill || skill.type !== "magic") return { ok: false, reason: "Nur Magieschulen können Zauber lernen." };
    const maxGrade = maxSpellGradeForPoints(projectedSkillPoints(actorState, plan, skillId));
    if (maxGrade < 0) return { ok: false, reason: "Zauber sind ab 1 Fertigkeitspunkt möglich." };

    const affordable = Array.from({ length: maxGrade + 1 }, (_, grade) => grade).some(
        (grade) => spellCost(grade) <= projectedFree(actorState, plan)
    );
    if (!affordable) return { ok: false, reason: "Nicht genug freie XP." };
    return { ok: true, maxGrade };
}

async function addAttributeStep(app, actorState, sheetState, attributeId) {
    const validation = canAddAttribute(actorState, sheetState.plan, attributeId);
    if (!validation.ok) return notifyError(validation.reason);

    const attribute = actorState.attributes[attributeId];
    sheetState.plan.push({
        id: nextEntryId(sheetState),
        type: "attribute",
        attributeId,
        delta: 1,
        cost: validation.cost,
        summary: `${attribute.label} +1 (${validation.current} -> ${validation.next})`,
    });
    rerenderSheet(app, actorState.actor);
}

async function addSkillStep(app, actorState, sheetState, skillId) {
    const validation = canAddSkill(actorState, sheetState.plan, skillId);
    if (!validation.ok) return notifyError(validation.reason);

    const skill = actorState.skills[skillId];
    const fromPoints = projectedSkillPoints(actorState, sheetState.plan, skillId);
    const toPoints = fromPoints + 1;
    const existingEntry = sheetState.plan.find((entry) => entry.type === "skill" && entry.skillId === skillId && !entry.parentId);
    const parentId = existingEntry?.id ?? nextEntryId(sheetState);
    const entry = existingEntry
        ? { ...existingEntry, delta: existingEntry.delta + 1, cost: existingEntry.cost + validation.cost, to: toPoints }
        : {
        id: parentId,
        type: "skill",
        skillId,
        skillType: skill.type,
        subjectLabel: skill.label,
        delta: 1,
        cost: validation.cost,
        from: fromPoints,
        to: toPoints,
        summary: `${skill.label} +1 (${fromPoints} -> ${toPoints})`,
    };

    const freeEntries = await collectFreeThresholdRewards(app, actorState, sheetState, skillId, fromPoints, toPoints, parentId, entry);
    if (freeEntries === null) return;

    if (existingEntry) {
        mergeProgressionEntry(existingEntry, { delta: 1, cost: validation.cost, to: toPoints });
    } else {
        sheetState.plan.push(entry);
    }
    sheetState.plan.push(...freeEntries);
    rerenderSheet(app, actorState.actor);
}

async function decreaseSkillStep(app, actorState, sheetState, skillId) {
    const index = sheetState.plan.findIndex((entry) => entry.type === "skill" && entry.skillId === skillId && !entry.parentId);
    if (index < 0) return;

    const entry = sheetState.plan[index];
    if (entry.delta <= 1) {
        removeEntryAndChildren(sheetState, entry.id);
        rerenderSheet(app, actorState.actor);
        return;
    }

    const removedTargetPoint = entry.to;
    entry.delta -= 1;
    entry.cost -= skillCostForPoint(removedTargetPoint);
    entry.to -= 1;
    entry.summary = `${entry.subjectLabel} +${entry.delta} (${entry.from} -> ${entry.to})`;
    sheetState.plan = sheetState.plan.filter((candidate) => candidate.parentId !== entry.id);
    rerenderSheet(app, actorState.actor);
}

async function collectFreeThresholdRewards(app, actorState, sheetState, skillId, fromPoints, toPoints, parentId, pendingEntry) {
    const skill = actorState.skills[skillId];
    const provisionalPlan = [...sheetState.plan, pendingEntry];
    const entries = [];

    if (skill.type === "magic") {
        for (const requirement of spellGradeRequirements()) {
            if (fromPoints < requirement.points && toPoints >= requirement.points) {
                const entry = await promptSpellEntry(actorState, provisionalPlan.concat(entries), skillId, {
                    free: true,
                    parentId,
                    fixedMaxGrade: requirement.maxGrade,
                    title: `Kostenfreier Zauber für ${skill.label} ${requirement.points} FP`,
                });
                if (!entry) return null;
                entries.push(entry);
            }
        }
    }

    for (const requirement of masteryThresholdRequirements()) {
        if (fromPoints < requirement.points && toPoints >= requirement.points) {
            const entry = await promptMasteryEntry(actorState, provisionalPlan.concat(entries), skillId, {
                free: true,
                parentId,
                fixedMaxThreshold: requirement.maxThreshold,
                title: `Kostenfreie Meisterschaft für ${skill.label} ${requirement.points} FP`,
            });
            if (!entry) return null;
            entries.push(entry);
        }
    }

    return entries;
}

async function addStrengthEntry(app, actorState, sheetState) {
    const entry = await promptStrengthEntry(actorState, sheetState.plan);
    if (!entry) return;
    if (projectedFree(actorState, sheetState.plan) < entry.cost) return notifyError("Nicht genug freie XP.");
    sheetState.plan.push(entry);
    rerenderSheet(app, actorState.actor);
}

async function addLanguageEntry(app, actorState, sheetState) {
    const entry = await promptLanguageEntry();
    if (!entry) return;
    if (projectedFree(actorState, sheetState.plan) < entry.cost) return notifyError("Nicht genug freie XP.");
    sheetState.plan.push(entry);
    rerenderSheet(app, actorState.actor);
}

async function addResourceEntry(app, actorState, sheetState, item) {
    const entry = item ? buildExistingResourceEntry(actorState, sheetState.plan, item) : await promptResourceEntry(actorState, sheetState.plan);
    if (!entry) return;
    if (projectedFree(actorState, sheetState.plan) < entry.cost) return notifyError("Nicht genug freie XP.");
    const existingEntry = findPlannedResourceEntry(sheetState.plan, entry);
    if (existingEntry) {
        mergeResourceEntry(existingEntry, entry);
    } else {
        sheetState.plan.push(entry);
    }
    rerenderSheet(app, actorState.actor);
}

async function addMasteryEntry(app, actorState, sheetState, skillId, options) {
    const entry = await promptMasteryEntry(actorState, sheetState.plan, skillId, options);
    if (!entry) return;
    if (projectedFree(actorState, sheetState.plan) < entry.cost) return notifyError("Nicht genug freie XP.");
    sheetState.plan.push(entry);
    rerenderSheet(app, actorState.actor);
}

async function addSpellEntry(app, actorState, sheetState, skillId, options) {
    const entry = await promptSpellEntry(actorState, sheetState.plan, skillId, options);
    if (!entry) return;
    if (projectedFree(actorState, sheetState.plan) < entry.cost) return notifyError("Nicht genug freie XP.");
    sheetState.plan.push(entry);
    rerenderSheet(app, actorState.actor);
}

async function promptStrengthEntry(actorState, plan) {
    const choices = annotateDuplicateChoices(await collectItemChoices("strength"), actorState, plan, "strength");
    const data = await promptForm({
        title: "St\u00e4rke erwerben",
        content: `
            <div class="lms-dialog-grid">
                ${dialogChoiceSelectHtml(choices, { itemButton: true })}
                <label><strong>Name</strong><input type="text" name="name" /></label>
                <label><strong>Stufe</strong><select name="level"><option value="1">1</option><option value="2">2</option></select></label>
            </div>
        `,
        confirmLabel: "Übernehmen",
        width: 520,
        render: (root) => bindChoiceSelect(root, choices),
    });
    if (!data) return null;

    const choice = choices[Number.parseInt(data.choice, 10)] ?? null;
    const name = choice?.name ?? String(data.name ?? "").trim();
    const level = Number.parseInt(choice?.system?.level ?? data.level, 10);
    if (!name) return notifyError("Bitte gib einen Namen ein."), null;
    if (![1, 2].includes(level)) return notifyError("Stärken dürfen Stufe 1 oder 2 haben."), null;

    return {
        id: nextEntryId(getSheetState(actorState.actor)),
        type: "item",
        itemType: "strength",
        name,
        cost: strengthCost(level),
        sourceUuid: choice?.uuid ?? null,
        multiSelectable: itemAllowsMultipleSelection({ itemType: "strength", system: choice?.system }),
        itemData: choice ? await itemDataFromChoice(choice) : null,
        fallbackSystem: { level, quantity: 1 },
        summary: `St\u00e4rke ${name} (Stufe ${level})`,
    };
}

async function promptLanguageEntry() {
    const choices = await collectItemChoices("language");
    const data = await promptForm({
        title: "Sprache erwerben",
        content: `
            <div class="lms-dialog-grid">
                ${dialogChoiceSelectHtml(choices, { itemButton: false })}
                <label><strong>Name</strong><input type="text" name="name" /></label>
            </div>
        `,
        confirmLabel: "Übernehmen",
        width: 500,
        render: (root) => bindChoiceSelect(root, choices),
    });
    if (!data) return null;

    const choice = choices[Number.parseInt(data.choice, 10)] ?? null;
    const name = choice?.name ?? String(data.name ?? "").trim();
    if (!name) return notifyError("Bitte gib einen Namen ein."), null;
    return {
        id: cryptoRandomId(),
        type: "item",
        itemType: "language",
        name,
        cost: languageCost(),
        sourceUuid: choice?.uuid ?? null,
        itemData: choice ? await itemDataFromChoice(choice) : null,
        fallbackSystem: {},
        summary: `Sprache ${name}`,
    };
}

function buildExistingResourceEntry(actorState, plan, item) {
    const current = projectedResourceLevel(actorState, plan, item.name, item.id);
    if (current >= resourceMaximum()) return notifyError("Diese Ressource ist bereits auf Maximum."), null;
    return {
        id: cryptoRandomId(),
        type: "resource",
        itemType: "resource",
        name: item.name,
        resourceItemId: item.id,
        resourcePoints: 1,
        cost: resourceCostPerPoint(),
        from: current,
        to: current + 1,
        summary: `Ressource ${item.name} +1 (${current} -> ${current + 1})`,
    };
}

async function promptResourceEntry(actorState, plan) {
    const resourceItems = actorState.actor.items.filter((item) => item.type === "resource");
    const maximum = resourceMaximum();
    const options = resourceItems
        .map((item, index) => {
            const current = projectedResourceLevel(actorState, plan, item.name, item.id);
            return `<option value="${index}" ${current >= maximum ? "disabled" : ""}>${escapeHtml(item.name)} (${current}/${maximum})</option>`;
        })
        .join("");
    const data = await promptForm({
        title: "Ressource erwerben / steigern",
        content: `
            <div class="lms-dialog-grid">
                <label>
                    <strong>Vorhandene Ressource</strong>
                    <select name="existing"><option value="">Neue Ressource</option>${options}</select>
                </label>
                <label><strong>Name neuer Ressource</strong><input type="text" name="name" /></label>
                <label><strong>Punkte</strong><input type="number" name="points" value="1" min="1" max="${maximum}" /></label>
            </div>
        `,
        confirmLabel: "Übernehmen",
        width: 520,
    });
    if (!data) return null;

    const existing = resourceItems[Number.parseInt(data.existing, 10)] ?? null;
    const points = Number.parseInt(data.points, 10);
    if (!Number.isInteger(points) || points < 1) return notifyError("Bitte gib mindestens 1 Punkt ein."), null;

    const name = existing?.name ?? String(data.name ?? "").trim();
    if (!name) return notifyError("Bitte gib einen Namen ein."), null;

    const current = projectedResourceLevel(actorState, plan, name, existing?.id ?? null);
    if (current + points > maximum) {
        return notifyError(`Ressourcen dürfen maximal ${maximum} Punkte haben.`), null;
    }

    return {
        id: cryptoRandomId(),
        type: "resource",
        itemType: "resource",
        name,
        resourceItemId: existing?.id ?? null,
        resourcePoints: points,
        cost: points * resourceCostPerPoint(),
        from: current,
        to: current + points,
        summary: `Ressource ${name} +${points} (${current} -> ${current + points})`,
    };
}

async function promptMasteryEntry(actorState, plan, skillId, options = {}) {
    const skill = actorState.skills[skillId];
    const maxThreshold = options.fixedMaxThreshold ?? maxMasteryThresholdForPoints(projectedSkillPoints(actorState, plan, skillId));
    const choices = annotateDuplicateChoices(
        choicesForSkillProgression(
            await collectItemChoices("mastery", (choice) => itemMatchesSkill(choice, skillId)),
            "mastery",
            skillId,
            skill.label,
            maxThreshold,
            (threshold) => options.free || masteryCost(threshold) <= projectedFree(actorState, plan)
        ),
        actorState,
        plan,
        "mastery",
        skillId
    );
    const thresholdOptions = Array.from({ length: maxThreshold }, (_, index) => index + 1)
        .map((threshold) => `<option value="${threshold}">${threshold}</option>`)
        .join("");

    const data = await promptForm({
        title: options.title ?? "Meisterschaft lernen",
        content: `
            <div class="lms-dialog-grid">
                <p>${escapeHtml(skill.label)}: maximal Schwelle ${maxThreshold}</p>
                ${dialogChoiceSelectHtml(choices, { itemButton: true })}
                <label><strong>Name</strong><input type="text" name="name" /></label>
                <label><strong>Schwelle</strong><select name="threshold">${thresholdOptions}</select></label>
            </div>
        `,
        confirmLabel: "Übernehmen",
        width: 540,
        render: (root) => bindChoiceSelect(root, choices),
    });
    if (!data) return null;

    const choice = choices[Number.parseInt(data.choice, 10)] ?? null;
    const name = choice?.name ?? String(data.name ?? "").trim();
    const threshold = Number.parseInt(choice?.selectionProgression ?? data.threshold, 10);
    if (!name) return notifyError("Bitte gib einen Namen ein."), null;
    if (!Number.isInteger(threshold) || threshold < 1 || threshold > maxThreshold) {
        return notifyError(`Die Meisterschaft darf höchstens Schwelle ${maxThreshold} haben.`), null;
    }

    const cost = options.free ? 0 : masteryCost(threshold);
    const systemOverrides = { skill: skillId, level: threshold, availableIn: skill.label };
    return {
        id: cryptoRandomId(),
        parentId: options.parentId ?? null,
        type: "item",
        itemType: "mastery",
        name,
        skillId,
        level: threshold,
        cost,
        sourceUuid: choice?.uuid ?? null,
        multiSelectable: itemAllowsMultipleSelection({ itemType: "mastery", system: choice?.system }),
        itemData: choice ? await itemDataFromChoice(choice) : null,
        fallbackSystem: systemOverrides,
        systemOverrides,
        summary: `${options.free ? "Kostenfreie Meisterschaft" : "Meisterschaft"} ${name} (${skill.label}, Schwelle ${threshold})`,
    };
}

async function promptSpellEntry(actorState, plan, skillId, options = {}) {
    const skill = actorState.skills[skillId];
    const maxGrade = options.fixedMaxGrade ?? maxSpellGradeForPoints(projectedSkillPoints(actorState, plan, skillId));
    const choices = annotateDuplicateChoices(
        choicesForSkillProgression(
            await collectItemChoices("spell", (choice) => itemMatchesSkill(choice, skillId)),
            "spell",
            skillId,
            skill.label,
            maxGrade,
            (grade) => options.free || spellCost(grade) <= projectedFree(actorState, plan)
        ),
        actorState,
        plan,
        "spell",
        skillId
    );
    const gradeOptions = Array.from({ length: maxGrade + 1 }, (_, grade) => grade)
        .filter((grade) => options.free || spellCost(grade) <= projectedFree(actorState, plan))
        .map((grade) => `<option value="${grade}">${grade}</option>`)
        .join("");

    const data = await promptForm({
        title: options.title ?? "Zauber lernen",
        content: `
            <div class="lms-dialog-grid">
                <p>${escapeHtml(skill.label)}: maximal Grad ${maxGrade}</p>
                ${dialogChoiceSelectHtml(choices, { itemButton: true })}
                <label><strong>Name</strong><input type="text" name="name" /></label>
                <label><strong>Grad</strong><select name="grade">${gradeOptions}</select></label>
            </div>
        `,
        confirmLabel: "Übernehmen",
        width: 540,
        render: (root) => bindChoiceSelect(root, choices),
    });
    if (!data) return null;

    const choice = choices[Number.parseInt(data.choice, 10)] ?? null;
    const name = choice?.name ?? String(data.name ?? "").trim();
    const grade = Number.parseInt(choice?.selectionProgression ?? data.grade, 10);
    if (!name) return notifyError("Bitte gib einen Namen ein."), null;
    if (!Number.isInteger(grade) || grade < 0 || grade > maxGrade) {
        return notifyError(`Der Zauber darf höchstens Grad ${maxGrade} haben.`), null;
    }

    const cost = options.free ? 0 : spellCost(grade);
    const systemOverrides = { skill: skillId, skillLevel: grade, availableIn: skill.label };
    return {
        id: cryptoRandomId(),
        parentId: options.parentId ?? null,
        type: "item",
        itemType: "spell",
        name,
        skillId,
        level: grade,
        cost,
        sourceUuid: choice?.uuid ?? null,
        multiSelectable: itemAllowsMultipleSelection({ itemType: "spell", system: choice?.system }),
        itemData: choice ? await itemDataFromChoice(choice) : null,
        fallbackSystem: {
            ...systemOverrides,
            costs: "",
            difficulty: "",
            range: "",
            effectDuration: "",
            effectArea: "",
            spellType: "",
            enhancementDescription: "",
            enhancementCosts: "",
            damage: { stringInput: null },
            features: { internalFeatureList: [] },
            castDuration: { value: 1, unit: "T" },
            degreeOfSuccessOptions: {
                castDuration: false,
                consumedFocus: false,
                exhaustedFocus: false,
                channelizedFocus: false,
                effectDuration: false,
                damage: false,
                range: false,
                effectArea: false,
            },
        },
        systemOverrides,
        summary: `${options.free ? "Kostenfreier Zauber" : "Zauber"} ${name} (${skill.label}, Grad ${grade})`,
    };
}

function bindChoiceSelect(root, choices) {
    const select = root.querySelector('select[name="choice"]');
    const hiddenInput = root.querySelector('input[name="choice"]');
    const nameInput = root.querySelector('input[name="name"]');
    const picker = root.querySelector("[data-lms-choice-picker]");
    const trigger = picker?.querySelector(".lms-choice-trigger");
    const triggerLabel = picker?.querySelector(".lms-choice-trigger-label");
    const menu = picker?.querySelector(".lms-choice-menu");
    const selectedShowButton = root.querySelector(".lms-choice-selected-show-item");
    const warning = root.querySelector(".lms-choice-warning");
    const sortControls = root.querySelector("[data-lms-choice-sort-controls]");
    const sortButtons = Array.from(root.querySelectorAll("[data-lms-choice-sort-mode]"));
    if (!(nameInput instanceof HTMLInputElement)) return;

    let restoreChoiceMenu = null;
    const choiceByValue = (value) => choices[Number.parseInt(value, 10)] ?? null;
    const currentValue = () => {
        if (select instanceof HTMLSelectElement) return select.value;
        if (hiddenInput instanceof HTMLInputElement) return hiddenInput.value;
        return "";
    };
    const selectedChoice = () => choiceByValue(currentValue());
    const refreshChoiceControls = () => {
        const value = currentValue();
        const choice = selectedChoice();
        if (triggerLabel instanceof HTMLElement && menu instanceof HTMLElement) {
            const selectedRow = Array.from(menu.querySelectorAll(".lms-choice-row")).find(
                (row) => row.getAttribute("data-choice-value") === value
            );
            triggerLabel.textContent = selectedRow?.querySelector(".lms-choice-row-select span")?.textContent ?? "Freie Eingabe";
        }
        if (selectedShowButton instanceof HTMLButtonElement) {
            selectedShowButton.disabled = !choice?.uuid;
            selectedShowButton.toggleAttribute("data-source-uuid", Boolean(choice?.uuid));
            if (choice?.uuid) {
                selectedShowButton.setAttribute("data-source-uuid", choice.uuid);
                selectedShowButton.title = `Item anzeigen: ${choice.name}`;
            } else {
                selectedShowButton.title = "Ausgew\u00e4hltes Item anzeigen";
            }
        }
        if (warning instanceof HTMLElement) {
            warning.hidden = !choice?.duplicateWarning;
            warning.textContent = choice?.duplicateWarning ?? "";
        }
        menu?.querySelectorAll?.(".lms-choice-row").forEach((row) => {
            const selected = row.getAttribute("data-choice-value") === value;
            row.classList.toggle("is-selected", selected);
            row.setAttribute("aria-selected", selected ? "true" : "false");
        });
    };
    const setValue = (value, { updateName = false } = {}) => {
        if (select instanceof HTMLSelectElement) select.value = value;
        if (hiddenInput instanceof HTMLInputElement) hiddenInput.value = value;
        const choice = choiceByValue(value);
        if (updateName && choice) nameInput.value = choice.name;
        refreshChoiceControls();
    };
    const handleDocumentClick = (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target || picker?.contains?.(target) || menu?.contains?.(target)) return;
        setOpen(false);
    };
    const handleDocumentKeydown = (event) => {
        if (event.key === "Escape") setOpen(false);
    };
    const setOpen = (open) => {
        if (!(trigger instanceof HTMLButtonElement) || !(menu instanceof HTMLElement)) return;
        if (open) {
            restoreChoiceMenu = restoreChoiceMenu ?? portalChoiceMenu(menu, document.body);
            positionChoiceMenu(root, picker, trigger, menu);
        }
        menu.hidden = !open;
        trigger.setAttribute("aria-expanded", open ? "true" : "false");
        document.removeEventListener("click", handleDocumentClick);
        document.removeEventListener("keydown", handleDocumentKeydown);
        if (open) {
            document.addEventListener("click", handleDocumentClick);
            document.addEventListener("keydown", handleDocumentKeydown);
        }
        if (!open) {
            restoreChoiceMenu?.();
            restoreChoiceMenu = null;
        }
    };
    const setSortMode = (mode) => {
        if (!(menu instanceof HTMLElement)) return;
        applyChoiceMenuSort(menu, mode);
        sortButtons.forEach((button) => {
            const active = button.getAttribute("data-lms-choice-sort-mode") === mode;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-pressed", active ? "true" : "false");
        });
        refreshChoiceControls();
    };

    select?.addEventListener("change", () => {
        setValue(select.value, { updateName: true });
    });
    sortControls?.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const button = target?.closest?.("[data-lms-choice-sort-mode]");
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        setSortMode(button.getAttribute("data-lms-choice-sort-mode") === "name" ? "name" : "progression");
    });
    trigger?.addEventListener("click", (event) => {
        event.preventDefault();
        setOpen(menu?.hidden ?? true);
    });
    trigger?.addEventListener("keydown", (event) => {
        if (event.key === "Escape") setOpen(false);
    });
    selectedShowButton?.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!(selectedShowButton instanceof HTMLButtonElement) || selectedShowButton.disabled) return;
        await runSafely(() => openItemDocument(selectedShowButton.getAttribute("data-source-uuid")));
    });
    menu?.addEventListener("click", async (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const showButton = target?.closest?.(".lms-choice-row-show-item");
        if (showButton) {
            event.preventDefault();
            event.stopPropagation();
            await runSafely(() => openItemDocument(showButton.getAttribute("data-source-uuid")));
            return;
        }

        const selectButton = target?.closest?.(".lms-choice-row-select");
        if (!selectButton) return;
        event.preventDefault();
        setValue(selectButton.getAttribute("data-choice-value") ?? "", { updateName: true });
        setOpen(false);
    });
    root.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!picker?.contains?.(target)) setOpen(false);
    });
    root.addEventListener("keydown", (event) => {
        if (event.key === "Escape") setOpen(false);
    });
    setValue(currentValue());
}

function applyChoiceMenuSort(menu, mode) {
    const normalizedMode = mode === "name" ? "name" : "progression";
    menu.querySelectorAll(".lms-choice-group-heading").forEach((heading) => heading.remove());

    const freeRows = Array.from(menu.querySelectorAll('.lms-choice-row[data-choice-free="true"]'));
    const rows = Array.from(menu.querySelectorAll('.lms-choice-row:not([data-choice-free="true"])'));
    rows.sort((left, right) => compareChoiceRows(left, right, normalizedMode));

    freeRows.forEach((row) => menu.append(row));

    let activeGroup = null;
    rows.forEach((row) => {
        if (normalizedMode === "progression") {
            const groupLabel = row.getAttribute("data-choice-progression-label") || "Ohne Stufe";
            if (groupLabel !== activeGroup) {
                activeGroup = groupLabel;
                menu.append(choiceGroupHeadingElement(groupLabel));
            }
        }
        menu.append(row);
    });
}

function compareChoiceRows(left, right, mode) {
    if (mode === "progression") {
        const leftProgression = choiceRowProgression(left);
        const rightProgression = choiceRowProgression(right);
        const leftHasProgression = Number.isInteger(leftProgression);
        const rightHasProgression = Number.isInteger(rightProgression);
        if (leftHasProgression && rightHasProgression && leftProgression !== rightProgression) return leftProgression - rightProgression;
        if (leftHasProgression !== rightHasProgression) return leftHasProgression ? -1 : 1;
    }
    return choiceRowName(left).localeCompare(choiceRowName(right), "de") || choiceRowIndex(left) - choiceRowIndex(right);
}

function choiceRowProgression(row) {
    const progression = Number.parseInt(row.getAttribute("data-choice-progression") ?? "", 10);
    return Number.isInteger(progression) ? progression : null;
}

function choiceRowName(row) {
    return row.getAttribute("data-choice-sort-name") ?? row.querySelector(".lms-choice-row-select span")?.textContent ?? "";
}

function choiceRowIndex(row) {
    const index = Number.parseInt(row.getAttribute("data-choice-index") ?? row.getAttribute("data-choice-value") ?? "", 10);
    return Number.isInteger(index) ? index : 0;
}

function choiceGroupHeadingElement(label) {
    const heading = document.createElement("span");
    heading.className = "lms-choice-group-heading";
    heading.setAttribute("role", "presentation");
    heading.textContent = label;
    return heading;
}

function positionChoiceMenu(root, picker, trigger, menu) {
    if (!(picker instanceof HTMLElement) || !(trigger instanceof HTMLElement) || !(menu instanceof HTMLElement)) return;
    const ownerWindow = root.closest?.(".application, .app, .window-app, .dialog") ?? root;
    const viewport = document.documentElement;
    const viewportRect = viewport.getBoundingClientRect();
    const boundaryRect = {
        left: 0,
        top: 0,
        right: window.innerWidth || viewport.clientWidth || viewportRect.right,
        bottom: window.innerHeight || viewport.clientHeight || viewportRect.bottom,
    };
    const placement = choiceMenuLayout({
        triggerRect: trigger.getBoundingClientRect(),
        boundaryRect,
    });
    picker.classList.toggle("lms-choice-opens-up", placement.direction === "up");
    menu.style.setProperty("--lms-choice-menu-left", `${placement.left}px`);
    menu.style.setProperty("--lms-choice-menu-width", `${placement.width}px`);
    menu.style.setProperty("--lms-choice-menu-top", placement.top === null ? "auto" : `${placement.top}px`);
    menu.style.setProperty("--lms-choice-menu-bottom", placement.bottom === null ? "auto" : `${placement.bottom}px`);
    menu.style.setProperty("--lms-choice-menu-max-height", `${placement.maxHeight}px`);
    menu.style.setProperty("--lms-choice-menu-z-index", String(choiceMenuZIndex(ownerWindow instanceof Element ? getComputedStyle(ownerWindow) : null)));
}

async function collectItemChoices(itemType, filter = null) {
    const cacheKey = `${itemType}:all`;
    if (!itemChoiceCache.has(cacheKey)) {
        itemChoiceCache.set(cacheKey, await collectAllItemChoices(itemType));
    }
    const allChoices = itemChoiceCache.get(cacheKey) ?? [];
    const choices = filter ? allChoices.filter(filter) : [...allChoices];
    choices.sort((left, right) => left.name.localeCompare(right.name, "de"));
    return choices;
}

async function collectAllItemChoices(itemType) {
    const choices = [];
    const seen = new Set();
    const addChoice = (choice) => {
        if (!choice || choice.type !== itemType || !choice.name) return;
        const key = choice.uuid || `${normalize(choice.name)}|${choice.type}|${normalize(choice.availability)}|${normalize(choice.skill)}`;
        if (seen.has(key)) return;
        seen.add(key);
        choices.push(choice);
    };

    for (const item of game.items?.filter?.((candidate) => candidate.type === itemType) ?? []) {
        addChoice(choiceFromItem(item, itemType));
    }

    for (const pack of game.packs ?? []) {
        if (!isItemPack(pack)) continue;
        let index;
        try {
            index = await getCachedPackIndex(pack);
        } catch (error) {
            console.warn("Leveler | pack index failed", pack.collection, error);
            continue;
        }
        for (const row of packIndexRows(index).filter((item) => item.type === itemType)) {
            let choice = choiceFromIndexRow(pack, row, itemType);
            const rowId = row._id ?? row.id;
            if (choiceNeedsDocument(choice, itemType) && rowId && typeof pack.getDocument === "function") {
                try {
                    choice = choiceFromItem(await pack.getDocument(rowId), itemType);
                } catch (error) {
                    console.warn("Leveler | pack document failed", pack.collection, rowId, error);
                }
            }
            addChoice(choice);
        }
    }
    return choices;
}

function itemMatchesSkill(choice, skillId) {
    const skill = skillDefById(skillId);
    return itemChoiceMatchesSkill(choice, skillId, skill?.label?.() ?? "");
}

function annotateDuplicateChoices(choices, actorState, plan, itemType, skillId = null) {
    const existingItems = actorItems(actorState.actor);
    return choices.map((choice) => {
        const target = {
            ...choice,
            itemType,
            skillId,
            sourceUuid: choice.uuid ?? null,
        };
        const duplicateState = duplicateSelectionState(target, existingItems, plan);
        return {
            ...choice,
            itemType,
            skillId,
            sourceUuid: choice.uuid ?? null,
            duplicateWarning: duplicateState.warning,
            duplicateKnown: duplicateState.known,
            duplicatePlanned: duplicateState.planned,
        };
    });
}

function duplicatePlanEntryState(actorState, plan, entry) {
    return duplicateSelectionState(entry, actorItems(actorState.actor), plan, { ignoreEntryId: entry.id });
}

function choicesForSkillProgression(choices, itemType, skillId, skillLabel, maxValue, canAfford = null) {
    const minValue = itemType === "spell" ? 0 : 1;
    const seen = new Set();
    return choices
        .map((choice) => ({
            ...choice,
            itemType,
            selectionProgression: choiceProgressionForSkill(choice, itemType, skillId, skillLabel),
        }))
        .filter((choice) => Number.isInteger(choice.selectionProgression))
        .filter((choice) => choice.selectionProgression >= minValue && choice.selectionProgression <= maxValue)
        .filter((choice) => !canAfford || canAfford(choice.selectionProgression))
        .filter((choice) => {
            const key = `${normalize(choice.name)}|${choice.selectionProgression}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((left, right) => left.name.localeCompare(right.name, "de") || left.selectionProgression - right.selectionProgression);
}

function isItemPack(pack) {
    return (pack.documentName ?? pack.metadata?.type ?? pack.metadata?.documentName) === "Item";
}

async function getCachedPackIndex(pack) {
    const cacheKey = pack.collection ?? pack.metadata?.id ?? pack.metadata?.label ?? String(pack);
    if (packIndexCache.has(cacheKey)) return packIndexCache.get(cacheKey);
    const index = typeof pack.getIndex === "function" ? await pack.getIndex({ fields: ITEM_CHOICE_INDEX_FIELDS }) : pack.index;
    packIndexCache.set(cacheKey, index);
    return index;
}

function packIndexRows(index) {
    if (typeof index?.filter === "function") return index.filter(() => true);
    return Array.from(index?.values?.() ?? index ?? []);
}

function choiceFromItem(item, itemType) {
    const system = {
        skill: getPropertySafe(item.system, "skill"),
        level: getPropertySafe(item.system, "level"),
        skillLevel: getPropertySafe(item.system, "skillLevel"),
        availableIn: getPropertySafe(item.system, "availableIn"),
        multiSelectable: getPropertySafe(item.system, "multiSelectable"),
    };
    return {
        uuid: item.uuid,
        name: item.name,
        type: item.type,
        system,
        skill: String(system.skill ?? ""),
        availability: String(system.availableIn ?? ""),
        progression: progressionFromSystem(system, itemType),
    };
}

function choiceFromIndexRow(pack, row, itemType) {
    const system = {
        skill: getPropertySafe(row.system, "skill") ?? row["system.skill"],
        level: getPropertySafe(row.system, "level") ?? row["system.level"],
        skillLevel: getPropertySafe(row.system, "skillLevel") ?? row["system.skillLevel"],
        availableIn: getPropertySafe(row.system, "availableIn") ?? row["system.availableIn"],
        multiSelectable: getPropertySafe(row.system, "multiSelectable") ?? row["system.multiSelectable"],
    };
    return {
        uuid: row.uuid ?? `Compendium.${pack.collection}.${row._id ?? row.id}`,
        name: row.name,
        type: row.type,
        system,
        skill: String(system.skill ?? ""),
        availability: String(system.availableIn ?? ""),
        progression: progressionFromSystem(system, itemType),
    };
}

function choiceNeedsDocument(choice, itemType) {
    if (!choice) return true;
    if (itemType === "language") return false;
    return !choice.skill && !choice.availability && !Number.isInteger(choice.progression);
}

function progressionFromSystem(system, itemType) {
    const value = itemType === "spell" ? system.skillLevel : system.level;
    const number = Number.parseInt(value, 10);
    return Number.isInteger(number) ? number : null;
}

async function itemDataFromChoice(choice) {
    if (!choice?.uuid || typeof fromUuid !== "function") return null;
    const item = await fromUuid(choice.uuid);
    if (!item) return null;
    const data = item.toObject();
    delete data._id;
    delete data.folder;
    delete data.sort;
    return data;
}

async function openItemDocument(uuid) {
    if (!uuid || typeof fromUuid !== "function") return notifyError("Item nicht gefunden.");
    const item = await fromUuid(uuid);
    if (!item) return notifyError("Item nicht gefunden.");
    if (typeof item.sheet?.render === "function") {
        item.sheet.render(true);
        return;
    }
    if (typeof item.render === "function") {
        item.render(true);
        return;
    }
    notifyError("Item kann nicht angezeigt werden.");
}

async function applyPlan(app, actorState, sheetState) {
    const actor = actorState.actor;
    if (!sheetState.plan.length) return;
    if (projectedFree(actorState, sheetState.plan) < 0) return notifyError("Nicht genug freie XP.");

    const undoEntries = [];
    const actorDeltas = new Map();
    actorDeltas.set("system.experience.free", -planCost(sheetState.plan));
    actorDeltas.set("system.experience.spent", planCost(sheetState.plan));

    for (const entry of sheetState.plan) {
        if (entry.type === "attribute") {
            accumulate(actorDeltas, `system.attributes.${entry.attributeId}.advances`, entry.delta);
            undoEntries.push({ ...baseUndoEntry(entry), actorDeltas: [{ path: `system.attributes.${entry.attributeId}.advances`, delta: entry.delta }] });
        } else if (entry.type === "skill") {
            accumulate(actorDeltas, `system.skills.${entry.skillId}.points`, entry.delta);
            undoEntries.push({ ...baseUndoEntry(entry), actorDeltas: [{ path: `system.skills.${entry.skillId}.points`, delta: entry.delta }] });
        }
    }

    const actorUpdate = {};
    for (const [path, delta] of actorDeltas.entries()) {
        setPropertySafe(actorUpdate, path, numberValue(getPropertySafe(actor, path), 0) + delta);
    }
    if (Object.keys(actorUpdate).length) await actor.update(actorUpdate);

    for (const entry of sheetState.plan) {
        if (entry.type === "resource") {
            const undoEntry = baseUndoEntry(entry);
            if (entry.resourceItemId) {
                const item = getActorItemById(actor, entry.resourceItemId);
                if (!item) continue;
                const current = numberValue(getPropertySafe(item.system, "value"), 0);
                await item.update({ "system.value": current + entry.resourcePoints });
                undoEntry.itemDeltas = [{ itemId: item.id, path: "system.value", delta: entry.resourcePoints }];
            } else {
                const created = await actor.createEmbeddedDocuments("Item", [
                    { name: entry.name, type: "resource", system: { value: entry.resourcePoints } },
                ]);
                undoEntry.createdItemIds = created.map((item) => item.id);
            }
            undoEntries.push(undoEntry);
        } else if (entry.type === "item") {
            const created = await actor.createEmbeddedDocuments("Item", [buildItemData(entry)]);
            undoEntries.push({ ...baseUndoEntry(entry), createdItemIds: created.map((item) => item.id) });
        }
    }

    for (const undoEntry of undoEntries) {
        const cost = undoEntry.cost ?? 0;
        undoEntry.actorDeltas = [
            ...(undoEntry.actorDeltas ?? []),
            { path: "system.experience.free", delta: -cost },
            { path: "system.experience.spent", delta: cost },
        ];
    }

    await createAdvancementChatMessage(actor, undoEntries);
    sheetState.plan = [];
    sheetState.active = false;
    notifyInfo("Steigerungen angewendet.");
    rerenderSheet(app, actor);
}

function buildItemData(entry) {
    return buildPlannedItemData(entry, { clone: foundry.utils.deepClone, flagScope: FLAG_SCOPE });
}

function baseUndoEntry(entry) {
    return {
        id: entry.id,
        parentId: entry.parentId ?? null,
        summary: entry.summary,
        cost: entry.cost ?? 0,
        undone: false,
    };
}

async function createAdvancementChatMessage(actor, entries) {
    const content = renderUndoChatContentV2(actor, entries);
    await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content,
        flags: {
            [FLAG_SCOPE]: {
                [FLAG_KEY]: {
                    actorUuid: actor.uuid,
                    actorId: actor.id,
                    actorName: actor.name,
                    entries,
                },
            },
        },
    });
}

async function createXpAdjustmentChatMessage(actor, amount) {
    const entry = createXpAdjustmentEntry({ id: cryptoRandomId(), amount });
    await createAdvancementChatMessage(actor, [entry]);
}

function renderUndoChatContent(actor, entries) {
    const activeEntries = entries.filter((entry) => !entry.undone);
    const isXpAdjustment = entries.every((entry) => entry.type === "xp-adjustment");
    const title = isXpAdjustment ? "XP hinzugefügt" : "Steigerungen";
    const lines = entries
        .map(
            (entry) => `
                <li class="${entry.undone ? "lms-chat-undone" : ""}">
                    <span><strong>${escapeHtml(entry.summary)}</strong><small>${escapeHtml(entry.note ?? (entry.cost > 0 ? `${entry.cost} XP` : "kostenfrei"))}</small></span>
                    ${
                        entry.undone
                            ? `<em>rückgängig</em>`
                            : isXpAdjustment
                              ? ""
                              : `<button type="button" data-lms-undo-entry="${escapeHtml(entry.id)}">Rückgängig</button>`
                    }
                </li>
            `
        )
        .join("");
    return `
        <section class="lms-chat-summary">
            <header><strong>${escapeHtml(actor.name)}</strong><span>${title}</span></header>
            <ol>${lines}</ol>
            ${
                activeEntries.length
                    ? `<button type="button" data-lms-undo-all="true">${isXpAdjustment ? "Rückgängig machen" : "Alle verbleibenden Positionen rückgängig machen"}</button>`
                    : `<p><em>Alle Positionen wurden rückgängig gemacht.</em></p>`
            }
        </section>
    `;
}

function renderUndoChatContentV2(actor, entries) {
    const activeEntries = entries.filter((entry) => !entry.undone);
    const isXpAdjustment = entries.every((entry) => entry.type === "xp-adjustment");
    const title = isXpAdjustment ? "XP hinzugefügt" : "Steigerungen";
    const canUndo = canUndoActorChanges(actor);
    const lines = entries
        .map(
            (entry) => `
                <li class="${entry.undone ? "lms-chat-undone" : ""}">
                    <span><strong>${escapeHtml(entry.summary)}</strong><small>${escapeHtml(entry.note ?? (entry.cost > 0 ? `${entry.cost} XP` : "kostenfrei"))}</small></span>
                    ${renderUndoEntryAction(entry, isXpAdjustment, canUndo)}
                </li>
            `
        )
        .join("");
    return `
        <section class="lms-chat-summary">
            <header><strong>${escapeHtml(actor.name)}</strong><span>${title}</span></header>
            <ol>${lines}</ol>
            ${renderUndoSummaryAction(activeEntries.length > 0, isXpAdjustment, canUndo)}
        </section>
    `;
}

function renderUndoEntryAction(entry, isXpAdjustment, canUndo) {
    if (!canUndo || isXpAdjustment) return "";
    if (entry.undone) return `<button type="button" disabled>Rückgängig</button>`;
    return `<button type="button" data-lms-undo-entry="${escapeHtml(entry.id)}">Rückgängig</button>`;
}

function renderUndoSummaryAction(hasActiveEntries, isXpAdjustment, canUndo) {
    const doneLabel = isXpAdjustment ? "Bereits rückgängig gemacht" : "Alle Positionen rückgängig gemacht";
    if (hasActiveEntries) {
        if (!canUndo) return "";
        const label = isXpAdjustment ? "Rückgängig machen" : "Alle verbleibenden Positionen rückgängig machen";
        return `<button type="button" data-lms-undo-all="true">${label}</button>`;
    }
    if (canUndo) return `<button type="button" disabled>${doneLabel}</button>`;
    return `<p><em>${doneLabel}</em></p>`;
}

function canUndoActorChanges(actor, user = globalThis.game?.user) {
    if (!actor || !user) return false;
    if (user.isGM) return true;
    if (typeof actor.canUserModify === "function") return actor.canUserModify(user, "update");
    return Boolean(actor.isOwner);
}

function refreshUndoChatMessageDisplay(app, html, data) {
    const root = htmlRoot(html);
    const message = chatMessageDocumentFromRender(app, data);
    const messageId = chatMessageId(message, data);
    const undoData = chatMessageUndoData(message, data);
    if (!root || !messageId || !undoData?.entries?.length) return;

    resolveUndoActor(undoData).then((actor) => {
        if (!actor) return;
        applyActorUndoState(actor, messageId, undoData.entries);
        updateChatMessageElement(root, renderUndoChatContentV2(actor, undoData.entries));
    });
}

function chatMessageDocumentFromRender(app, data = {}) {
    if (app?.documentName === "ChatMessage") return app;
    if (app?.document?.documentName === "ChatMessage") return app.document;

    const id = app?.id ?? app?.document?.id ?? data?.message?._id ?? data?.message?.id;
    return id ? game.messages?.get?.(id) ?? null : null;
}

function chatMessageId(message, data = {}) {
    return message?.id ?? data?.message?._id ?? data?.message?.id ?? null;
}

function chatMessageUndoData(message, data = {}) {
    const flag = message?.getFlag?.(FLAG_SCOPE, FLAG_KEY) ?? message?.flags?.[FLAG_SCOPE]?.[FLAG_KEY] ?? data?.message?.flags?.[FLAG_SCOPE]?.[FLAG_KEY];
    return flag ? foundry.utils.deepClone(flag) : null;
}

function refreshUndoChatCardsForActor(actor, changed = {}) {
    if (!actor || !foundry.utils.hasProperty(changed, `flags.${FLAG_SCOPE}.${ACTOR_UNDO_STATE_KEY}`)) return;
    document.querySelectorAll(".lms-chat-summary").forEach((card) => {
        const messageElement = card.closest("[data-message-id]");
        const messageId = messageElement?.dataset?.messageId;
        const message = messageId ? game.messages?.get?.(messageId) : null;
        const undoData = chatMessageUndoData(message);
        if (!messageId || !undoData?.entries?.length || !undoDataReferencesActor(undoData, actor)) return;

        applyActorUndoState(actor, messageId, undoData.entries);
        updateChatMessageElement(messageElement, renderUndoChatContentV2(actor, undoData.entries));
    });
}

function undoDataReferencesActor(undoData, actor) {
    return undoData.actorUuid === actor.uuid || undoData.actorId === actor.id;
}

async function resolveUndoActor(undoData) {
    if (undoData.actorUuid && typeof fromUuid === "function") return fromUuid(undoData.actorUuid);
    return game.actors.get(undoData.actorId);
}

function updateChatMessageElement(root, content) {
    const target = root.querySelector?.(".message-content") ?? root;
    if (target instanceof HTMLElement) target.innerHTML = content;
}

function registerUndoHandler() {
    if (game[MODULE_ID]?.undoRegistered) return;
    game[MODULE_ID] = { ...(game[MODULE_ID] ?? {}), undoRegistered: true };
    document.addEventListener(
        "click",
        async (event) => {
            const target = event.target instanceof Element ? event.target : null;
            const button = target?.closest?.("[data-lms-undo-entry], [data-lms-undo-all]");
            if (!button) return;

            const messageElement = button.closest("[data-message-id]");
            const messageId = messageElement?.dataset?.messageId;
            if (!messageId) return;

            event.preventDefault();
            event.stopImmediatePropagation();

            const entryId = button.getAttribute("data-lms-undo-entry");
            await undoFromMessage(messageId, entryId);
        },
        true
    );
}

async function undoFromMessage(messageId, entryId = null) {
    const message = game.messages.get(messageId);
    const undoData = foundry.utils.deepClone(message?.getFlag(FLAG_SCOPE, FLAG_KEY));
    if (!message || !undoData) return notifyError("Rückgängig-Daten nicht gefunden.");

    const actor = typeof fromUuid === "function" ? await fromUuid(undoData.actorUuid) : game.actors.get(undoData.actorId);
    if (!actor) return notifyError("Charakter nicht gefunden.");
    if (!canUndoActorChanges(actor)) return notifyError("Dir fehlen die Rechte für diese Änderung.");

    applyActorUndoState(actor, messageId, undoData.entries);

    const targetIds = new Set();
    if (entryId) {
        targetIds.add(entryId);
        for (const entry of undoData.entries) {
            if (entry.parentId === entryId) targetIds.add(entry.id);
        }
    } else {
        undoData.entries.filter((entry) => !entry.undone).forEach((entry) => targetIds.add(entry.id));
    }

    const entries = undoData.entries.filter((entry) => targetIds.has(entry.id) && !entry.undone);
    if (!entries.length) return notifyError("Diese Position wurde bereits rückgängig gemacht.");

    const actorDeltas = new Map();
    for (const entry of entries) {
        for (const delta of entry.actorDeltas ?? []) {
            accumulate(actorDeltas, delta.path, -(delta.delta ?? 0));
        }
    }
    const actorUpdate = {};
    for (const [path, delta] of actorDeltas.entries()) {
        setPropertySafe(actorUpdate, path, numberValue(getPropertySafe(actor, path), 0) + delta);
    }
    if (Object.keys(actorUpdate).length) await actor.update(actorUpdate);

    for (const entry of entries) {
        for (const delta of entry.itemDeltas ?? []) {
            const item = getActorItemById(actor, delta.itemId);
            if (!item) continue;
            const current = numberValue(getPropertySafe(item, delta.path), 0);
            await item.update({ [delta.path]: current - (delta.delta ?? 0) });
        }
        const ids = (entry.createdItemIds ?? []).filter((id) => actor.items.get(id));
        if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
        entry.undone = true;
    }

    for (const entry of undoData.entries) {
        if (targetIds.has(entry.id)) entry.undone = true;
    }

    await markActorUndoState(actor, messageId, entries);
    await updateUndoChatMessageIfAllowed(message, actor, undoData);
    actor.sheet?.render?.(true);
    notifyInfo("Steigerung rückgängig gemacht.");
}

function applyActorUndoState(actor, messageId, entries) {
    const state = actor.getFlag?.(FLAG_SCOPE, ACTOR_UNDO_STATE_KEY) ?? {};
    for (const entry of entries ?? []) {
        if (state[actorUndoStateEntryKey(messageId, entry.id)]) entry.undone = true;
    }
}

async function markActorUndoState(actor, messageId, entries) {
    const state = foundry.utils.deepClone(actor.getFlag?.(FLAG_SCOPE, ACTOR_UNDO_STATE_KEY) ?? {});
    for (const entry of entries ?? []) {
        state[actorUndoStateEntryKey(messageId, entry.id)] = true;
    }
    await actor.setFlag(FLAG_SCOPE, ACTOR_UNDO_STATE_KEY, state);
}

function actorUndoStateEntryKey(messageId, entryId) {
    return `${messageId}:${entryId}`;
}

async function updateUndoChatMessageIfAllowed(message, actor, undoData) {
    const content = renderUndoChatContentV2(actor, undoData.entries);
    if (canUpdateChatMessage(message)) {
        try {
            await message.update({
                [`flags.${FLAG_SCOPE}.${FLAG_KEY}`]: undoData,
                content,
            });
            return;
        } catch (error) {
            console.warn("Leveler | ChatMessage konnte nicht aktualisiert werden.", error);
        }
    }
    updateRenderedChatMessage(message.id, content);
}

function canUpdateChatMessage(message) {
    if (game.user.isGM) return true;
    if (typeof message.canUserModify === "function") return message.canUserModify(game.user, "update");
    return Boolean(message.isOwner);
}

function updateRenderedChatMessage(messageId, content) {
    const selector = `[data-message-id="${cssEscape(messageId)}"] .message-content`;
    document.querySelectorAll(selector).forEach((element) => {
        element.innerHTML = content;
    });
}

function cssEscape(value) {
    if (globalThis.CSS?.escape) return CSS.escape(String(value));
    return String(value).replace(/["\\]/g, "\\$&");
}

function projectedAttributeCurrent(actorState, plan, attributeId) {
    return (actorState.attributes[attributeId]?.current ?? 0) + plannedAttributeDelta(plan, attributeId);
}

function projectedSkillPoints(actorState, plan, skillId) {
    return (actorState.skills[skillId]?.points ?? 0) + plannedSkillDelta(plan, skillId);
}

function projectedResourceLevel(actorState, plan, name, itemId = null) {
    const item = itemId ? getActorItemById(actorState.actor, itemId) : findResourceItem(actorState.actor, name);
    const base = item ? numberValue(getPropertySafe(item.system, "value"), 0) : 0;
    return base + plannedResourceDelta(plan, item?.id ?? null, name);
}

function plannedAttributeDelta(plan, attributeId) {
    return plan.filter((entry) => entry.type === "attribute" && entry.attributeId === attributeId).reduce((sum, entry) => sum + entry.delta, 0);
}

function plannedSkillDelta(plan, skillId) {
    return plan.filter((entry) => entry.type === "skill" && entry.skillId === skillId).reduce((sum, entry) => sum + entry.delta, 0);
}

function plannedResourceDelta(plan, itemId, name = null) {
    return plan
        .filter((entry) => entry.type === "resource" && (itemId ? entry.resourceItemId === itemId : normalize(entry.name) === normalize(name)))
        .reduce((sum, entry) => sum + entry.resourcePoints, 0);
}

function findPlannedResourceEntry(plan, entry) {
    if (!entry || entry.type !== "resource") return null;
    return (
        plan.find((candidate) => {
            if (candidate.type !== "resource") return false;
            if (entry.resourceItemId && candidate.resourceItemId === entry.resourceItemId) return true;
            return !entry.resourceItemId && !candidate.resourceItemId && normalize(candidate.name) === normalize(entry.name);
        }) ?? null
    );
}

async function decreaseResourceStep(app, actorState, sheetState, item) {
    const entry = sheetState.plan.find((candidate) => candidate.type === "resource" && candidate.resourceItemId === item.id);
    if (!entry) return;

    if (entry.resourcePoints <= 1) {
        sheetState.plan = sheetState.plan.filter((candidate) => candidate !== entry);
    } else {
        entry.resourcePoints -= 1;
        entry.cost -= resourceCostPerPoint();
        entry.to -= 1;
        entry.summary = `Ressource ${entry.name} +${entry.resourcePoints} (${entry.from} -> ${entry.to})`;
    }
    rerenderSheet(app, actorState.actor);
}

async function removeLatestEntry(app, actor, sheetState, predicate) {
    const index = sheetState.plan.findLastIndex(predicate);
    if (index < 0) return;
    const [entry] = sheetState.plan.splice(index, 1);
    sheetState.plan = sheetState.plan.filter((candidate) => candidate.parentId !== entry.id);
    rerenderSheet(app, actor);
}

function removeEntryAndChildren(sheetState, entryId) {
    if (!entryId) return;
    const ids = new Set([entryId]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const entry of sheetState.plan) {
            if (entry.parentId && ids.has(entry.parentId) && !ids.has(entry.id)) {
                ids.add(entry.id);
                changed = true;
            }
        }
    }
    sheetState.plan = sheetState.plan.filter((entry) => !ids.has(entry.id));
}

function nextEntryId(sheetState) {
    const id = `lms-${Date.now()}-${sheetState.nextId}`;
    sheetState.nextId += 1;
    return id;
}

function cryptoRandomId() {
    return globalThis.crypto?.randomUUID?.() ?? `lms-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getActorItemById(actor, itemId) {
    if (!actor?.items || !itemId) return null;
    return actor.items.get?.(itemId) ?? actor.items.find?.((item) => item.id === itemId) ?? null;
}

function actorItems(actor) {
    if (!actor?.items) return [];
    if (typeof actor.items.filter === "function") return actor.items.filter(() => true);
    if (typeof actor.items.values === "function") return Array.from(actor.items.values());
    return Array.isArray(actor.items) ? actor.items : [];
}

function findResourceItem(actor, name) {
    const normalizedName = normalize(name);
    return actor?.items?.find?.((item) => item.type === "resource" && normalize(item.name) === normalizedName) ?? null;
}

function getPropertySafe(object, path) {
    if (!object || !path) return undefined;
    if (typeof foundry?.utils?.getProperty === "function") return foundry.utils.getProperty(object, path);
    return String(path)
        .split(".")
        .reduce((current, segment) => current?.[segment], object);
}

function setPropertySafe(object, path, value) {
    if (typeof foundry?.utils?.setProperty === "function") return foundry.utils.setProperty(object, path, value);
    const parts = String(path).split(".");
    const last = parts.pop();
    let current = object;
    for (const part of parts) {
        current[part] = current[part] ?? {};
        current = current[part];
    }
    current[last] = value;
    return true;
}

function numberValue(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function accumulate(map, key, value) {
    map.set(key, (map.get(key) ?? 0) + value);
}

function rerenderSheet(app, actor) {
    const root = getRenderedSheetRoot(app) ?? getRenderedSheetRoot(actor?.sheet);
    if (!root) return;
    const scrollSnapshot = captureScrollPositions(root);
    syncXpInputs(root, actor);
    enhanceSheet(app ?? actor.sheet, actor, root);
    restoreScrollPositions(scrollSnapshot);
    if (typeof globalThis.window?.requestAnimationFrame === "function") {
        globalThis.window.requestAnimationFrame(() => restoreScrollPositions(scrollSnapshot));
    } else if (typeof globalThis.window?.setTimeout === "function") {
        globalThis.window.setTimeout(() => restoreScrollPositions(scrollSnapshot), 0);
    }
}

function getRenderedSheetRoot(app) {
    const element = app?.element instanceof HTMLElement ? app.element : null;
    if (!element?.isConnected) return null;
    if (element.classList.contains("splittermond") && element.querySelector(".experience")) return element;
    return element.querySelector?.(".splittermond") ?? null;
}

function syncXpInputs(root, actor) {
    const freeInput = root.querySelector('input[name="system.experience.free"]');
    if (freeInput instanceof HTMLInputElement) {
        freeInput.value = String(numberValue(getPropertySafe(actor.system, "experience.free"), 0));
    }
    const spentInput = root.querySelector('input[name="system.experience.spent"]');
    if (spentInput instanceof HTMLInputElement) {
        spentInput.value = String(numberValue(getPropertySafe(actor.system, "experience.spent"), 0));
    }
}

function notifyError(message) {
    ui.notifications?.error(message);
}

function notifyInfo(message) {
    ui.notifications?.info(message);
}

async function runSafely(action) {
    try {
        await action();
    } catch (error) {
        notifyError(error?.message ?? String(error));
        console.error(error);
    }
}

function bindNumberStepper(root) {
    const input = root.querySelector('input[name="xp"]');
    if (!(input instanceof HTMLInputElement)) return;
    root.querySelectorAll("[data-lms-number-step]").forEach((button) => {
        button.addEventListener("click", () => {
            const step = Number.parseInt(button.getAttribute("data-lms-number-step") ?? "0", 10);
            const current = Number.parseInt(input.value, 10) || 1;
            const min = Number.parseInt(input.min, 10) || 1;
            input.value = String(Math.max(min, current + step));
            input.dispatchEvent(new Event("input", { bubbles: true }));
        });
    });
}

function throwUserError(message) {
    notifyError(message);
    throw new Error(message);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function promptForm({ title, content, confirmLabel = "Übernehmen", width = 480, render = null }) {
    if (hasApplicationV2) {
        return new Promise((resolve) => {
            new LevelerPromptWindow({ title, content, confirmLabel, width, render, resolve }).render(true);
        });
    }

    return new Promise((resolve) => {
        let resolved = false;
        const finish = (value) => {
            if (resolved) return;
            resolved = true;
            resolve(value);
        };
        new Dialog(
            {
                title,
                content: `<form class="lms-dialog-form">${content}</form>`,
                buttons: {
                    confirm: {
                        label: confirmLabel,
                        callback: (html) => {
                            const root = htmlRoot(html);
                            const form = root?.querySelector("form");
                            finish(form ? Object.fromEntries(new FormData(form).entries()) : null);
                        },
                    },
                    cancel: {
                        label: "Abbrechen",
                        callback: () => finish(null),
                    },
                },
                default: "confirm",
                render: (html) => {
                    const root = htmlRoot(html);
                    if (root && render) render(root);
                },
                close: () => finish(null),
            },
            promptDialogOptions(width)
        ).render(true);
    });
}

export { renderUndoChatContentV2 };
