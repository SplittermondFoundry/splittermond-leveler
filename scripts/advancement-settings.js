import {
    ADVANCEMENT_RULES_SETTING_KEY,
    MODULE_ID,
    defaultAdvancementRules,
    getAdvancementRules,
    normalizeAdvancementRules,
} from "./advancement-rules.js";

const hasApplicationV2 = Boolean(globalThis.foundry?.applications?.api?.ApplicationV2);
const SettingsApplicationBase = hasApplicationV2
    ? globalThis.foundry.applications.api.HandlebarsApplicationMixin(globalThis.foundry.applications.api.ApplicationV2)
    : globalThis.Application ?? class {};

export function registerAdvancementSettings() {
    const settings = globalThis.game?.settings;
    if (!settings?.register || !settings?.registerMenu) return;

    settings.register(MODULE_ID, ADVANCEMENT_RULES_SETTING_KEY, {
        name: "Kosten & Schwellen",
        hint: "Regelwerte des Splittermond Levelers wie XP-Kosten, Heldengrad-Schwellen und Gratis-Schwellen.",
        scope: "world",
        config: false,
        type: Object,
        default: defaultAdvancementRules(),
    });

    settings.registerMenu(MODULE_ID, "advancementRulesMenu", {
        name: "Kosten & Schwellen",
        label: "Konfigurieren",
        hint: "Kosten und Schwellen des Splittermond Levelers anpassen.",
        icon: "fas fa-coins",
        type: AdvancementRuleSettingsApplication,
        restricted: true,
    });
}

export class AdvancementRuleSettingsApplication extends SettingsApplicationBase {
    static DEFAULT_OPTIONS = {
        id: "splittermond-leveler-advancement-rules",
        tag: "form",
        classes: ["splittermond", "sheet", "splittermond-leveler", "lms-settings-window"],
        position: { width: 720, height: "auto" },
        window: {
            title: "Splittermond Leveler: Kosten & Schwellen",
            minimizable: true,
            resizable: true,
        },
    };

    static PARTS = {
        content: {
            template: `modules/${MODULE_ID}/templates/settings-form.hbs`,
            scrollable: [".lms-settings-form"],
        },
    };

    static get defaultOptions() {
        const options = {
            id: "splittermond-leveler-advancement-rules",
            title: "Splittermond Leveler: Kosten & Schwellen",
            classes: ["splittermond", "sheet", "splittermond-leveler", "lms-settings-window"],
            width: 720,
            height: "auto",
            resizable: true,
            minimizable: true,
        };
        return typeof globalThis.foundry?.utils?.mergeObject === "function" ? foundry.utils.mergeObject(super.defaultOptions ?? {}, options) : options;
    }

    async _prepareContext(options) {
        const context = typeof super._prepareContext === "function" ? await super._prepareContext(options) : {};
        return { ...context, content: advancementSettingsFormHtml(getAdvancementRules()) };
    }

    async _renderInner() {
        const element = document.createElement("section");
        element.innerHTML = advancementSettingsFormHtml(getAdvancementRules());
        return globalThis.$ ? $(element) : element;
    }

    activateListeners(html) {
        if (typeof super.activateListeners === "function") super.activateListeners(html);
        this.bindSettingsListeners(htmlRoot(html));
    }

    async _onRender(context, options) {
        if (typeof super._onRender === "function") await super._onRender(context, options);
        this.bindSettingsListeners(this.element instanceof HTMLElement ? this.element : null);
    }

    bindSettingsListeners(element) {
        const root = element?.querySelector?.(".lms-settings-form") ?? element;
        if (!(root instanceof HTMLElement) || root.dataset.lmsSettingsBound === "true") return;
        root.dataset.lmsSettingsBound = "true";

        root.querySelector("[data-lms-settings-save]")?.addEventListener("click", (event) => {
            event.preventDefault();
            this.saveSettings(root);
        });
        root.querySelector("[data-lms-settings-reset]")?.addEventListener("click", (event) => {
            event.preventDefault();
            fillAdvancementSettingsForm(root, defaultAdvancementRules());
        });
        root.closest("form")?.addEventListener("submit", (event) => {
            event.preventDefault();
            this.saveSettings(root);
        });
    }

    async saveSettings(root) {
        const form = root.closest("form") ?? root;
        const formData = form instanceof HTMLFormElement ? new FormData(form) : formDataFromInputs(root);
        const rules = advancementRulesFromFormData(formData);
        await game.settings.set(MODULE_ID, ADVANCEMENT_RULES_SETTING_KEY, rules);
        globalThis.ui?.notifications?.info?.("Splittermond Leveler: Kosten & Schwellen gespeichert.");
        await this.close();
    }
}

export function advancementSettingsFormHtml(rules = getAdvancementRules()) {
    const normalizedRules = normalizeAdvancementRules(rules);
    const sections = advancementSettingsSections(normalizedRules)
        .map(
            (section) => `
                <section class="lms-settings-section">
                    <h2>${escapeHtml(section.title)}</h2>
                    ${section.description ? `<p class="lms-settings-help">${escapeHtml(section.description)}</p>` : ""}
                    ${section.groups.map((group) => settingsGroupHtml(group, normalizedRules)).join("")}
                </section>
            `
        )
        .join("");

    return `
        <section class="lms-settings-form">
            ${sections}
            <footer class="lms-settings-actions">
                <button type="button" data-lms-settings-reset>Standardwerte einsetzen</button>
                <button type="button" data-lms-settings-save>Speichern</button>
            </footer>
        </section>
    `;
}

export function advancementRulesFromFormData(formData) {
    const rules = defaultAdvancementRules();
    for (const [path, value] of formData.entries()) {
        setNestedValue(rules, path, value);
    }
    return normalizeAdvancementRules(rules);
}

function advancementSettingsSections(rules) {
    return [
        {
            title: "Heldengrad und Grenzen",
            groups: [
                group("Heldengrad-Aufstieg", "Verbrauchte XP, ab denen der Leveler HG 2 bis HG 4 annimmt.", [
                    field("heroLevelXpThresholds.2", "HG 2 ab verbrauchten XP"),
                    field("heroLevelXpThresholds.3", "HG 3 ab verbrauchten XP"),
                    field("heroLevelXpThresholds.4", "HG 4 ab verbrauchten XP"),
                ]),
                group("Grenzen je Heldengrad", "Maximal erlaubte Fertigkeitspunkte und Attributsteigerungen beim Planen.", [
                    field("maxSkillPointsByHeroLevel.1", "Fertigkeitspunkte in HG 1"),
                    field("maxSkillPointsByHeroLevel.2", "Fertigkeitspunkte in HG 2"),
                    field("maxSkillPointsByHeroLevel.3", "Fertigkeitspunkte in HG 3"),
                    field("maxSkillPointsByHeroLevel.4", "Fertigkeitspunkte in HG 4"),
                    field("maxAttributeIncreasesByHeroLevel.1", "Attributsteigerungen in HG 1"),
                    field("maxAttributeIncreasesByHeroLevel.2", "Attributsteigerungen in HG 2"),
                    field("maxAttributeIncreasesByHeroLevel.3", "Attributsteigerungen in HG 3"),
                    field("maxAttributeIncreasesByHeroLevel.4", "Attributsteigerungen in HG 4"),
                ]),
            ],
        },
        {
            title: "Steigerungskosten",
            groups: [
                group("Attributkosten", "Kosten der ersten bis vierten Attributsteigerung seit Charakterstart.", [
                    field("attributeCostsByIncrease.1", "1. Steigerung"),
                    field("attributeCostsByIncrease.2", "2. Steigerung"),
                    field("attributeCostsByIncrease.3", "3. Steigerung"),
                    field("attributeCostsByIncrease.4", "4. Steigerung"),
                ]),
                group("Fertigkeitskosten", "Kosten für einen einzelnen neuen Fertigkeitspunkt in der jeweiligen Spanne.", [
                    field("skillPointCostsByHeroLevel.1", `Bis ${rules.maxSkillPointsByHeroLevel[1]} FP`),
                    field("skillPointCostsByHeroLevel.2", `Bis ${rules.maxSkillPointsByHeroLevel[2]} FP`),
                    field("skillPointCostsByHeroLevel.3", `Bis ${rules.maxSkillPointsByHeroLevel[3]} FP`),
                    field("skillPointCostsByHeroLevel.4", `Bis ${rules.maxSkillPointsByHeroLevel[4]} FP`),
                ]),
                group("Meisterschaftskosten", "Kosten einer frei gekauften Meisterschaft nach Schwelle.", [
                    field("masteryCostsByThreshold.1", "Schwelle 1"),
                    field("masteryCostsByThreshold.2", "Schwelle 2"),
                    field("masteryCostsByThreshold.3", "Schwelle 3"),
                    field("masteryCostsByThreshold.4", "Schwelle 4"),
                ]),
                group("Zauberkosten", "Kosten eines frei gekauften Zaubers nach Grad.", [
                    field("spellCostsByGrade.0", "Grad 0"),
                    field("spellCostsByGrade.1", "Grad 1"),
                    field("spellCostsByGrade.2", "Grad 2"),
                    field("spellCostsByGrade.3", "Grad 3"),
                    field("spellCostsByGrade.4", "Grad 4"),
                    field("spellCostsByGrade.5", "Grad 5"),
                ]),
            ],
        },
        {
            title: "Weitere Kosten und Grenzen",
            groups: [
                group("Stärken und Sprachen", "Kosten für Einträge, die direkt als Item geplant werden.", [
                    field("strengthCostsByLevel.1", "Stärke Stufe 1"),
                    field("strengthCostsByLevel.2", "Stärke Stufe 2"),
                    field("languageCost", "Sprache"),
                ]),
                group("Ressourcen", "Kosten pro Ressourcenpunkt und maximale Ressourcenhöhe.", [
                    field("resourceCostPerPoint", "Ressource pro Punkt"),
                    field("resourceMaximum", "Ressourcenmaximum"),
                ]),
            ],
        },
        {
            title: "Kostenfreie Auswahl beim Fertigkeitsanstieg",
            description:
                "Beim Erhöhen einer Fertigkeit prüft der Leveler diese FP-Schwellen. Wird eine Schwelle überschritten, öffnet er einen kostenfreien Auswahl-Dialog; der zweite Wert begrenzt die erlaubte Schwelle bzw. den Grad. Nutzen: Hausregeln für Bonus-Meisterschaften und Bonus-Zauber ohne manuelle Nacharbeit.",
            groups: [
                ...rules.masteryThresholdRequirements.map((requirement, index) =>
                    group(`Meisterschaft bei ${requirement.points} FP`, "Kostenfreie Meisterschaft, wenn die Fertigkeit diese Stufe erreicht.", [
                        field(`masteryThresholdRequirements.${index}.points`, "Fertigkeitspunkte-Schwelle"),
                        field(`masteryThresholdRequirements.${index}.maxThreshold`, `Gratis bis Schwelle ${requirement.maxThreshold}`),
                    ])
                ),
                ...rules.spellGradeRequirements.map((requirement, index) =>
                    group(`Zauber bei ${requirement.points} FP`, "Kostenfreier Zauber, wenn eine Magieschule diese Stufe erreicht.", [
                        field(`spellGradeRequirements.${index}.points`, "Fertigkeitspunkte-Schwelle"),
                        field(`spellGradeRequirements.${index}.maxGrade`, `Gratis bis Grad ${requirement.maxGrade}`),
                    ])
                ),
            ],
        },
    ];
}

function group(title, description, fields) {
    return { title, description, fields };
}

function field(path, label) {
    return { path, label };
}

function settingsGroupHtml(groupDefinition, rules) {
    return `
        <div class="lms-settings-subsection">
            <h3>${escapeHtml(groupDefinition.title)}</h3>
            ${groupDefinition.description ? `<p class="lms-settings-help">${escapeHtml(groupDefinition.description)}</p>` : ""}
            <div class="lms-settings-grid">
                ${groupDefinition.fields.map((fieldDefinition) => settingsFieldHtml(fieldDefinition, rules)).join("")}
            </div>
        </div>
    `;
}

function settingsFieldHtml(fieldDefinition, rules) {
    const value = nestedValue(rules, fieldDefinition.path);
    return `
        <label class="lms-settings-field">
            <span>${escapeHtml(fieldDefinition.label)}</span>
            <input type="number" name="${escapeHtml(fieldDefinition.path)}" value="${escapeHtml(value)}" min="0" step="1" />
        </label>
    `;
}

function fillAdvancementSettingsForm(root, rules) {
    const normalizedRules = normalizeAdvancementRules(rules);
    root.querySelectorAll("input[name]").forEach((input) => {
        if (input instanceof HTMLInputElement) input.value = String(nestedValue(normalizedRules, input.name));
    });
}

function formDataFromInputs(root) {
    return new Map(
        Array.from(root.querySelectorAll("input[name]"))
            .filter((input) => input instanceof HTMLInputElement)
            .map((input) => [input.name, input.value])
    );
}

function setNestedValue(object, path, value) {
    const parts = String(path).split(".");
    const last = parts.pop();
    let current = object;
    for (const part of parts) {
        const key = Array.isArray(current) ? Number.parseInt(part, 10) : part;
        current[key] = current[key] ?? {};
        current = current[key];
    }
    const key = Array.isArray(current) ? Number.parseInt(last, 10) : last;
    current[key] = value;
}

function nestedValue(object, path) {
    return String(path)
        .split(".")
        .reduce((current, part) => current?.[part], object);
}

function htmlRoot(html) {
    if (html instanceof HTMLElement) return html;
    if (html?.[0] instanceof HTMLElement) return html[0];
    return null;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
