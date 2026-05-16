import assert from "node:assert/strict";
import {
    ATTRIBUTE_COSTS,
    heldengradForSpent,
    masteryCost,
    maxMasteryThresholdForPoints,
    maxSkillPointsForHeldengrad,
    maxSpellGradeForPoints,
    createXpAdjustmentEntry,
    choiceProgressionForSkill,
    itemChoiceMatchesSkill,
    mergeProgressionEntry,
    mergeResourceEntry,
    skillCostForPoint,
    skillHeldengradRequirement,
    spellCost,
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
assert.equal(choiceProgressionForSkill({ system: { availableIn: "deathmagic 2", skillLevel: 0 } }, "spell", "deathmagic", "Todesmagie"), 2);
assert.equal(choiceProgressionForSkill({ availability: "Anfuehren 1", progression: 1 }, "mastery", "leadership", "Anfuehren"), 1);
assert.equal(choiceProgressionForSkill({ system: { skill: "melee", level: 1 } }, "mastery", "leadership", "Anfuehren"), null);

console.log("advancement-rules tests passed");
