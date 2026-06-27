import assert from "node:assert/strict";
import {
    ATTRIBUTE_COSTS,
    attributeCostForIncrease,
    buildPlannedItemData,
    duplicateSelectionState,
    defaultAdvancementRules,
    heldengradForSpent,
    itemAllowsMultipleSelection,
    itemsDuplicate,
    languageCost,
    masteryCost,
    masteryThresholdRequirements,
    maxMasteryThresholdForPoints,
    maxSkillPointsForHeldengrad,
    maxSpellGradeForPoints,
    normalizeAdvancementRules,
    projectedHeldengrad,
    createXpAdjustmentEntry,
    choiceProgressionForSkill,
    itemChoiceMatchesSkill,
    mergeProgressionEntry,
    mergeResourceEntry,
    resourceCostPerPoint,
    resourceMaximum,
    skillCostForPoint,
    skillHeldengradRequirement,
    spellCost,
    spellGradeRequirements,
    strengthCost,
} from "../scripts/advancement-rules.js";

assert.equal(heldengradForSpent(0), 1);
assert.equal(heldengradForSpent(99), 1);
assert.equal(heldengradForSpent(100), 2);
assert.equal(heldengradForSpent(300), 3);
assert.equal(heldengradForSpent(600), 4);

assert.equal(maxSkillPointsForHeldengrad(1), 6);
assert.equal(maxSkillPointsForHeldengrad(2), 9);
assert.equal(maxSkillPointsForHeldengrad(3), 12);
assert.equal(maxSkillPointsForHeldengrad(4), 15);

assert.equal(projectedHeldengrad({ xp: { spent: 76 } }, [{ cost: 10 }]), 1);
assert.equal(projectedHeldengrad({ xp: { spent: 90 } }, [{ cost: 10 }]), 2);

assert.equal(skillCostForPoint(1), 3);
assert.equal(skillCostForPoint(6), 3);
assert.equal(skillCostForPoint(7), 5);
assert.equal(skillCostForPoint(10), 7);
assert.equal(skillCostForPoint(13), 9);

assert.equal(skillHeldengradRequirement(6), 1);
assert.equal(skillHeldengradRequirement(7), 2);
assert.equal(skillHeldengradRequirement(10), 3);
assert.equal(skillHeldengradRequirement(13), 4);

assert.equal(ATTRIBUTE_COSTS.get(1), 10);
assert.equal(ATTRIBUTE_COSTS.get(4), 25);
assert.equal(attributeCostForIncrease(1), 10);
assert.equal(attributeCostForIncrease(4), 25);

assert.equal(masteryCost(1), 5);
assert.equal(masteryCost(4), 20);
assert.equal(maxMasteryThresholdForPoints(5), 0);
assert.equal(maxMasteryThresholdForPoints(6), 1);
assert.equal(maxMasteryThresholdForPoints(15), 4);

assert.equal(spellCost(0), 1);
assert.equal(spellCost(5), 15);
assert.equal(maxSpellGradeForPoints(0), -1);
assert.equal(maxSpellGradeForPoints(1), 0);
assert.equal(maxSpellGradeForPoints(15), 5);
assert.equal(strengthCost(1), 7);
assert.equal(strengthCost(2), 14);
assert.equal(languageCost(), 5);
assert.equal(resourceCostPerPoint(), 7);
assert.equal(resourceMaximum(), 6);

const defaultRules = defaultAdvancementRules();
assert.deepEqual(defaultRules.heroLevelXpThresholds, { 2: 100, 3: 300, 4: 600 });
assert.deepEqual(masteryThresholdRequirements(), [
    { points: 6, maxThreshold: 1 },
    { points: 9, maxThreshold: 2 },
    { points: 12, maxThreshold: 3 },
    { points: 15, maxThreshold: 4 },
]);
assert.deepEqual(spellGradeRequirements(), [
    { points: 1, maxGrade: 0 },
    { points: 3, maxGrade: 1 },
    { points: 6, maxGrade: 2 },
    { points: 9, maxGrade: 3 },
    { points: 12, maxGrade: 4 },
    { points: 15, maxGrade: 5 },
]);

const normalizedRules = normalizeAdvancementRules({
    heroLevelXpThresholds: { 2: "80" },
    resourceCostPerPoint: "9",
    masteryThresholdRequirements: [{ points: "4", maxThreshold: "1" }],
});
assert.equal(normalizedRules.heroLevelXpThresholds[2], 80);
assert.equal(normalizedRules.heroLevelXpThresholds[3], 300);
assert.equal(normalizedRules.resourceCostPerPoint, 9);
assert.deepEqual(normalizedRules.masteryThresholdRequirements[0], { points: 4, maxThreshold: 1 });

const originalGame = globalThis.game;
globalThis.game = {
    settings: {
        get: () => ({
            heroLevelXpThresholds: { 2: 50, 3: 120, 4: 240 },
            maxSkillPointsByHeroLevel: { 1: 4, 2: 8, 3: 12, 4: 16 },
            maxAttributeIncreasesByHeroLevel: { 1: 2, 2: 3, 3: 4, 4: 5 },
            skillPointCostsByHeroLevel: { 1: 2, 2: 4, 3: 6, 4: 8 },
            attributeCostsByIncrease: { 1: 11, 2: 12, 3: 13, 4: 14 },
            masteryCostsByThreshold: { 1: 4, 2: 8, 3: 12, 4: 16 },
            spellCostsByGrade: { 0: 2, 1: 4, 2: 6, 3: 8, 4: 10, 5: 12 },
            strengthCostsByLevel: { 1: 6, 2: 10 },
            languageCost: 2,
            resourceCostPerPoint: 6,
            resourceMaximum: 8,
            masteryThresholdRequirements: [
                { points: 4, maxThreshold: 1 },
                { points: 8, maxThreshold: 2 },
                { points: 12, maxThreshold: 3 },
                { points: 16, maxThreshold: 4 },
            ],
            spellGradeRequirements: [
                { points: 2, maxGrade: 0 },
                { points: 5, maxGrade: 1 },
                { points: 8, maxGrade: 2 },
                { points: 11, maxGrade: 3 },
                { points: 14, maxGrade: 4 },
                { points: 16, maxGrade: 5 },
            ],
        }),
    },
};

assert.equal(heldengradForSpent(49), 1);
assert.equal(heldengradForSpent(50), 2);
assert.equal(heldengradForSpent(120), 3);
assert.equal(heldengradForSpent(240), 4);
assert.equal(maxSkillPointsForHeldengrad(1), 4);
assert.equal(maxSkillPointsForHeldengrad(4), 16);
assert.equal(skillHeldengradRequirement(5), 2);
assert.equal(skillCostForPoint(5), 4);
assert.equal(attributeCostForIncrease(3), 13);
assert.equal(masteryCost(4), 16);
assert.equal(spellCost(5), 12);
assert.equal(maxMasteryThresholdForPoints(7), 1);
assert.equal(maxMasteryThresholdForPoints(8), 2);
assert.equal(maxSpellGradeForPoints(4), 0);
assert.equal(maxSpellGradeForPoints(5), 1);
assert.equal(strengthCost(2), 10);
assert.equal(languageCost(), 2);
assert.equal(resourceCostPerPoint(), 6);
assert.equal(resourceMaximum(), 8);
globalThis.game = originalGame;

const xpEntry = createXpAdjustmentEntry({ id: "xp-1", amount: 12 });
assert.deepEqual(xpEntry, {
    id: "xp-1",
    type: "xp-adjustment",
    summary: "12 freie XP hinzugefügt",
    note: "+12 freie XP",
    cost: 0,
    undone: false,
    actorDeltas: [{ path: "system.experience.free", delta: 12 }],
});

const mergedProgression = mergeProgressionEntry(
    {
        type: "skill",
        subjectLabel: "Handgemenge",
        delta: 1,
        cost: 3,
        from: 0,
        to: 1,
        summary: "Handgemenge +1 (0 -> 1)",
    },
    { delta: 3, cost: 9, to: 4 }
);
assert.equal(mergedProgression.delta, 4);
assert.equal(mergedProgression.cost, 12);
assert.equal(mergedProgression.from, 0);
assert.equal(mergedProgression.to, 4);
assert.equal(mergedProgression.summary, "Handgemenge +4 (0 -> 4)");

const mergedResource = mergeResourceEntry(
    {
        type: "resource",
        name: "Kontakte",
        resourcePoints: 1,
        cost: 7,
        from: 0,
        to: 1,
        summary: "Ressource Kontakte +1 (0 -> 1)",
    },
    { resourcePoints: 1, cost: 7, to: 2 }
);
assert.equal(mergedResource.resourcePoints, 2);
assert.equal(mergedResource.cost, 14);
assert.equal(mergedResource.from, 0);
assert.equal(mergedResource.to, 2);
assert.equal(mergedResource.summary, "Ressource Kontakte +2 (0 -> 2)");

assert.equal(itemChoiceMatchesSkill({ system: { skill: "leadership" } }, "leadership", "Anfuehren"), true);
assert.equal(itemChoiceMatchesSkill({ system: { availableIn: "leadership 1" } }, "leadership", "Anfuehren"), true);
assert.equal(itemChoiceMatchesSkill({ system: { availableIn: "Anfuehren 1" } }, "leadership", "Anfuehren"), true);
assert.equal(itemChoiceMatchesSkill({ system: { availableIn: "Anf\u00fchren 1" } }, "leadership", "Anfuehren"), true);
assert.equal(itemChoiceMatchesSkill({ availability: "Anfuehren 1" }, "leadership", "Anfuehren"), true);
assert.equal(itemChoiceMatchesSkill({ system: { availableIn: "melee 1" } }, "leadership", "Anfuehren"), false);
assert.equal(
    itemChoiceMatchesSkill(
        { system: { skill: "arcanelore", availableIn: "naturemagic 4, transformationmagic 3" } },
        "transformationmagic",
        "Verwandlungsmagie"
    ),
    true
);
assert.equal(choiceProgressionForSkill({ system: { availableIn: "deathmagic 2", skillLevel: 0 } }, "spell", "deathmagic", "Todesmagie"), 2);
assert.equal(
    choiceProgressionForSkill(
        { system: { skill: "arcanelore", availableIn: "naturemagic 4, transformationmagic 3", skillLevel: null } },
        "spell",
        "transformationmagic",
        "Verwandlungsmagie"
    ),
    3
);
assert.equal(choiceProgressionForSkill({ availability: "Anfuehren 1", progression: 1 }, "mastery", "leadership", "Anfuehren"), 1);
assert.equal(choiceProgressionForSkill({ system: { skill: "melee", level: 1 } }, "mastery", "leadership", "Anfuehren"), null);

assert.equal(itemAllowsMultipleSelection({ itemType: "mastery", system: { multiSelectable: true } }), true);
assert.equal(itemAllowsMultipleSelection({ itemType: "mastery", system: { multiSelectable: "on" } }), true);
assert.equal(itemAllowsMultipleSelection({ itemType: "mastery", system: { multiSelectable: false } }), false);
assert.equal(itemAllowsMultipleSelection({ itemType: "spell", system: { multiSelectable: true } }), false);

assert.equal(
    itemsDuplicate(
        { itemType: "mastery", name: "Koordinator", skillId: "leadership" },
        { type: "mastery", name: "Koordinator", system: { skill: "leadership" } }
    ),
    true
);
assert.equal(
    itemsDuplicate(
        { itemType: "mastery", name: "Koordinator", skillId: "leadership" },
        { type: "mastery", name: "Koordinator", system: { skill: "melee" } }
    ),
    false
);
assert.equal(
    itemsDuplicate({ itemType: "strength", name: "Richtungssinn" }, { type: "strength", name: "Richtungssinn", system: { level: 1 } }),
    true
);

const knownDuplicateState = duplicateSelectionState(
    { itemType: "spell", name: "Vogelform", skillId: "transformationmagic" },
    [{ type: "spell", name: "Vogelform", system: { skill: "transformationmagic" } }],
    []
);
assert.equal(knownDuplicateState.duplicate, true);
assert.equal(knownDuplicateState.known, true);
assert.equal(knownDuplicateState.planned, false);
assert.equal(knownDuplicateState.warning, "Dieser Zauber ist bereits bekannt.");

const plannedDuplicateState = duplicateSelectionState(
    { id: "planned-2", itemType: "strength", name: "Richtungssinn" },
    [],
    [
        { id: "planned-1", type: "item", itemType: "strength", name: "Richtungssinn" },
        { id: "planned-2", type: "item", itemType: "strength", name: "Richtungssinn" },
    ],
    { ignoreEntryId: "planned-2" }
);
assert.equal(plannedDuplicateState.duplicate, true);
assert.equal(plannedDuplicateState.known, false);
assert.equal(plannedDuplicateState.planned, true);
assert.equal(plannedDuplicateState.warning, "Diese St\u00e4rke ist bereits geplant.");

const repeatableMasteryDuplicateState = duplicateSelectionState(
    { itemType: "mastery", name: "Koordinator", skillId: "leadership", system: { multiSelectable: true } },
    [{ type: "mastery", name: "Koordinator", system: { skill: "leadership" } }],
    []
);
assert.equal(repeatableMasteryDuplicateState.duplicate, false);

const plannedSpellItem = buildPlannedItemData(
    {
        id: "spell-entry",
        itemType: "spell",
        name: "Vogelform",
        itemData: {
            name: "Vogelform",
            type: "spell",
            system: {
                availableIn: "naturemagic 4, transformationmagic 3",
                skill: "arcanelore",
                skillLevel: null,
                costs: "K12V3",
                spellType: "Gestalt, Tiere",
            },
            flags: { source: { imported: true } },
        },
        fallbackSystem: {
            skill: "transformationmagic",
            skillLevel: 3,
            availableIn: "Verwandlungsmagie",
            costs: "",
        },
        systemOverrides: {
            skill: "transformationmagic",
            skillLevel: 3,
            availableIn: "Verwandlungsmagie",
        },
    },
    { flagScope: "splittermond-leveler" }
);
assert.equal(plannedSpellItem.system.skill, "transformationmagic");
assert.equal(plannedSpellItem.system.skillLevel, 3);
assert.equal(plannedSpellItem.system.availableIn, "Verwandlungsmagie");
assert.equal(plannedSpellItem.system.costs, "K12V3");
assert.equal(plannedSpellItem.system.spellType, "Gestalt, Tiere");
assert.deepEqual(plannedSpellItem.flags, { source: { imported: true }, "splittermond-leveler": { entryId: "spell-entry" } });

console.log("advancement-rules tests passed");
