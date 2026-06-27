import assert from "node:assert/strict";
import { defaultAdvancementRules } from "../scripts/advancement-rules.js";
import {
    advancementRulesFromFormData,
    advancementSettingsFormHtml,
    registerAdvancementSettings,
} from "../scripts/advancement-settings.js";

const html = advancementSettingsFormHtml(defaultAdvancementRules());

assert.match(html, /class="lms-settings-form"/);
assert.match(html, /class="lms-settings-subsection"/);
assert.match(html, /Heldengrad-Aufstieg/);
assert.match(html, /Grenzen je Heldengrad/);
assert.match(html, /Attributkosten/);
assert.match(html, /Fertigkeitskosten/);
assert.match(html, /name="heroLevelXpThresholds\.2"/);
assert.match(html, /name="maxSkillPointsByHeroLevel\.4"/);
assert.match(html, /name="attributeCostsByIncrease\.1"/);
assert.match(html, /name="skillPointCostsByHeroLevel\.3"/);
assert.match(html, /name="masteryCostsByThreshold\.4"/);
assert.match(html, /name="spellCostsByGrade\.5"/);
assert.match(html, /name="strengthCostsByLevel\.2"/);
assert.match(html, /name="languageCost"/);
assert.match(html, /name="resourceCostPerPoint"/);
assert.match(html, /name="resourceMaximum"/);
assert.match(html, /name="masteryThresholdRequirements\.0\.points"/);
assert.match(html, /name="spellGradeRequirements\.5\.maxGrade"/);
assert.match(html, /Kostenfreie Auswahl beim Fertigkeitsanstieg/);
assert.match(html, /Beim Erh(?:ö|&ouml;)hen einer Fertigkeit/);
assert.match(html, /Meisterschaft bei 6 FP/);
assert.match(html, /Kostenfreie Meisterschaft, wenn die Fertigkeit diese Stufe erreicht/);
assert.match(html, /Gratis bis Schwelle 1/);
assert.match(html, /Zauber bei 1 FP/);
assert.match(html, /Kostenfreier Zauber, wenn eine Magieschule diese Stufe erreicht/);
assert.match(html, /Gratis bis Grad 0/);
assert.doesNotMatch(html, /wenn die Fertigkeit diese Punktzahl erreicht/);
assert.doesNotMatch(html, /wenn eine Magieschule diese Punktzahl erreicht/);
assert.doesNotMatch(html, /Ausl(?:ö|&ouml;)ser 1/);
assert.match(html, /data-lms-settings-save/);
assert.match(html, /data-lms-settings-reset/);

const rulesFromForm = advancementRulesFromFormData(
    new Map([
        ["heroLevelXpThresholds.2", "80"],
        ["skillPointCostsByHeroLevel.2", "6"],
        ["resourceCostPerPoint", "9"],
        ["masteryThresholdRequirements.0.points", "5"],
        ["masteryThresholdRequirements.0.maxThreshold", "2"],
        ["spellGradeRequirements.5.points", "18"],
        ["spellGradeRequirements.5.maxGrade", "5"],
    ])
);

assert.equal(rulesFromForm.heroLevelXpThresholds[2], 80);
assert.equal(rulesFromForm.heroLevelXpThresholds[3], 300);
assert.equal(rulesFromForm.skillPointCostsByHeroLevel[2], 6);
assert.equal(rulesFromForm.resourceCostPerPoint, 9);
assert.deepEqual(rulesFromForm.masteryThresholdRequirements[0], { points: 5, maxThreshold: 2 });
assert.deepEqual(rulesFromForm.spellGradeRequirements[5], { points: 18, maxGrade: 5 });

const calls = [];
const originalGame = globalThis.game;
globalThis.game = {
    settings: {
        register: (...args) => calls.push(["register", args]),
        registerMenu: (...args) => calls.push(["registerMenu", args]),
    },
};

registerAdvancementSettings();

assert.equal(calls.length, 2);
assert.equal(calls[0][0], "register");
assert.equal(calls[0][1][0], "splittermond-leveler");
assert.equal(calls[0][1][1], "advancementRules");
assert.equal(calls[0][1][2].scope, "world");
assert.equal(calls[0][1][2].config, false);
assert.equal(calls[1][0], "registerMenu");
assert.equal(calls[1][1][0], "splittermond-leveler");
assert.equal(calls[1][1][1], "advancementRulesMenu");
assert.equal(calls[1][1][2].restricted, true);
assert.equal(typeof calls[1][1][2].type, "function");

globalThis.game = originalGame;

console.log("advancement-settings tests passed");
