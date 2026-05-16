const localize = (key, fallback) => {
    const localized = globalThis.game?.i18n?.localize?.(key);
    return localized && localized !== key ? localized : fallback;
};

export const ATTRIBUTE_DEFS = [
    {
        id: "charisma",
        label: () => localize("splittermond.attribute.charisma.long", "Ausstrahlung"),
        short: () => localize("splittermond.attribute.charisma.short", "AUS"),
    },
    {
        id: "agility",
        label: () => localize("splittermond.attribute.agility.long", "Beweglichkeit"),
        short: () => localize("splittermond.attribute.agility.short", "BEW"),
    },
    {
        id: "intuition",
        label: () => localize("splittermond.attribute.intuition.long", "Intuition"),
        short: () => localize("splittermond.attribute.intuition.short", "INT"),
    },
    {
        id: "constitution",
        label: () => localize("splittermond.attribute.constitution.long", "Konstitution"),
        short: () => localize("splittermond.attribute.constitution.short", "KON"),
    },
    {
        id: "mystic",
        label: () => localize("splittermond.attribute.mystic.long", "Mystik"),
        short: () => localize("splittermond.attribute.mystic.short", "MYS"),
    },
    {
        id: "strength",
        label: () => localize("splittermond.attribute.strength.long", "Stärke"),
        short: () => localize("splittermond.attribute.strength.short", "ST\u00c4"),
    },
    {
        id: "mind",
        label: () => localize("splittermond.attribute.mind.long", "Verstand"),
        short: () => localize("splittermond.attribute.mind.short", "VER"),
    },
    {
        id: "willpower",
        label: () => localize("splittermond.attribute.willpower.long", "Willenskraft"),
        short: () => localize("splittermond.attribute.willpower.short", "WIL"),
    },
];

const skillLabel = (id, fallback) => localize(`splittermond.skillLabel.${id}`, fallback);

export const GENERAL_SKILLS = [
    ["acrobatics", "Akrobatik"],
    ["alchemy", "Alchemie"],
    ["leadership", "Anführen"],
    ["arcanelore", "Arkane Kunde"],
    ["athletics", "Athletik"],
    ["performance", "Darbietung"],
    ["diplomacy", "Diplomatie"],
    ["clscraft", "Edelhandwerk"],
    ["empathy", "Empathie"],
    ["determination", "Entschlossenheit"],
    ["dexterity", "Fingerfertigkeit"],
    ["history", "Geschichte und Mythen"],
    ["craftmanship", "Handwerk"],
    ["heal", "Heilkunde"],
    ["stealth", "Heimlichkeit"],
    ["hunting", "Jagdkunst"],
    ["countrylore", "Länderkunde"],
    ["nature", "Naturkunde"],
    ["eloquence", "Redegewandtheit"],
    ["locksntraps", "Schlösser und Fallen"],
    ["swim", "Schwimmen"],
    ["seafaring", "Seefahrt"],
    ["streetlore", "Strassenkunde"],
    ["animals", "Tierführung"],
    ["survival", "Überleben"],
    ["perception", "Wahrnehmung"],
    ["endurance", "Zähigkeit"],
].map(([id, fallback]) => ({ id, type: "general", label: () => skillLabel(id, fallback) }));

export const COMBAT_SKILLS = [
    ["melee", "Handgemenge"],
    ["slashing", "Hiebwaffen"],
    ["chains", "Kettenwaffen"],
    ["blades", "Klingenwaffen"],
    ["longrange", "Schusswaffen"],
    ["staffs", "Stangenwaffen"],
    ["throwing", "Wurfwaffen"],
].map(([id, fallback]) => ({ id, type: "combat", label: () => skillLabel(id, fallback) }));

export const MAGIC_SCHOOLS = [
    ["antimagic", "Bannmagie"],
    ["controlmagic", "Beherrschungsmagie"],
    ["motionmagic", "Bewegungsmagie"],
    ["insightmagic", "Erkenntnismagie"],
    ["stonemagic", "Felsmagie"],
    ["firemagic", "Feuermagie"],
    ["healmagic", "Heilungsmagie"],
    ["illusionmagic", "Illusionsmagie"],
    ["combatmagic", "Kampfmagie"],
    ["lightmagic", "Lichtmagie"],
    ["naturemagic", "Naturmagie"],
    ["shadowmagic", "Schattenmagie"],
    ["fatemagic", "Schicksalsmagie"],
    ["protectionmagic", "Schutzmagie"],
    ["enhancemagic", "Stärkungsmagie"],
    ["deathmagic", "Todesmagie"],
    ["transformationmagic", "Verwandlungsmagie"],
    ["watermagic", "Wassermagie"],
    ["windmagic", "Windmagie"],
].map(([id, fallback]) => ({ id, type: "magic", label: () => skillLabel(id, fallback) }));

export const SKILL_DEFS = [...GENERAL_SKILLS, ...COMBAT_SKILLS, ...MAGIC_SCHOOLS];

export const FREE_MASTERY_THRESHOLDS = [6, 9, 12, 15];
export const FREE_SPELL_THRESHOLDS = new Map([
    [1, 0],
    [3, 1],
    [6, 2],
    [9, 3],
    [12, 4],
    [15, 5],
]);

export const ATTRIBUTE_COSTS = new Map([
    [1, 10],
    [2, 15],
    [3, 20],
    [4, 25],
]);

export function heldengradForSpent(spentXp) {
    if (spentXp >= 600) return 4;
    if (spentXp >= 300) return 3;
    if (spentXp >= 100) return 2;
    return 1;
}

export function heldengradLabel(grade) {
    const fallback = ["", "Suchender", "Wanderer", "Veteran", "Held"][grade] ?? `Grad ${grade}`;
    return localize(`splittermond.heroLevels.${grade}`, fallback);
}

export function maxSkillPointsForHeldengrad(grade) {
    return [0, 6, 9, 12, 15][grade] ?? 15;
}

export function maxAttributeIncreasesForHeldengrad(grade) {
    return [0, 1, 2, 3, 4][grade] ?? 4;
}

export function skillCostForPoint(targetPoint) {
    if (targetPoint <= 6) return 3;
    if (targetPoint <= 9) return 5;
    if (targetPoint <= 12) return 7;
    return 9;
}

export function skillHeldengradRequirement(targetPoint) {
    if (targetPoint <= 6) return 1;
    if (targetPoint <= 9) return 2;
    if (targetPoint <= 12) return 3;
    return 4;
}

export function spellCost(grade) {
    return [1, 3, 6, 9, 12, 15][grade] ?? null;
}

export function masteryCost(threshold) {
    return threshold * 5;
}

export function maxSpellGradeForPoints(points) {
    if (points >= 15) return 5;
    if (points >= 12) return 4;
    if (points >= 9) return 3;
    if (points >= 6) return 2;
    if (points >= 3) return 1;
    if (points >= 1) return 0;
    return -1;
}

export function maxMasteryThresholdForPoints(points) {
    if (points >= 15) return 4;
    if (points >= 12) return 3;
    if (points >= 9) return 2;
    if (points >= 6) return 1;
    return 0;
}

export function planCost(plan) {
    return plan.reduce((sum, entry) => sum + (entry.cost ?? 0), 0);
}

export function projectedSpent(state, plan) {
    return state.xp.spent + planCost(plan);
}

export function projectedFree(state, plan) {
    return state.xp.free - planCost(plan);
}

export function normalize(value) {
    return String(value ?? "")
        .replace(/\u00e4/g, "ae")
        .replace(/\u00f6/g, "oe")
        .replace(/\u00fc/g, "ue")
        .replace(/\u00c4/g, "ae")
        .replace(/\u00d6/g, "oe")
        .replace(/\u00dc/g, "ue")
        .replace(/\u00df/g, "ss")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
}

export function skillDefById(id) {
    return SKILL_DEFS.find((skill) => skill.id === id) ?? null;
}

export function attributeDefById(id) {
    return ATTRIBUTE_DEFS.find((attribute) => attribute.id === id) ?? null;
}

export function plannedDelta(plan, predicate) {
    return plan.filter(predicate).reduce((sum, entry) => sum + (entry.delta ?? entry.resourcePoints ?? 0), 0);
}

export function createXpAdjustmentEntry({ id, amount }) {
    return {
        id,
        type: "xp-adjustment",
        summary: `${amount} freie XP hinzugefügt`,
        note: `+${amount} freie XP`,
        cost: 0,
        undone: false,
        actorDeltas: [{ path: "system.experience.free", delta: amount }],
    };
}

export function mergeProgressionEntry(entry, increment) {
    entry.delta += increment.delta;
    entry.cost += increment.cost;
    entry.to = increment.to;
    entry.summary = `${entry.subjectLabel} +${entry.delta} (${entry.from} -> ${entry.to})`;
    return entry;
}

export function mergeResourceEntry(entry, increment) {
    entry.resourcePoints += increment.resourcePoints;
    entry.cost += increment.cost;
    entry.to = increment.to;
    entry.summary = `Ressource ${entry.name} +${entry.resourcePoints} (${entry.from} -> ${entry.to})`;
    return entry;
}

export function itemChoiceMatchesSkill(choice, skillId, skillLabel = "") {
    const normalizedSkillId = normalize(skillId);
    const normalizedSkillLabel = normalize(skillLabel);
    const choiceSkill = normalize(choice?.system?.skill ?? choice?.skill ?? "");
    if (choiceSkill && choiceSkill === normalizedSkillId) return true;

    const availableIn = String(choice?.system?.availableIn ?? choice?.availableIn ?? choice?.availability ?? "");
    if (!availableIn) return false;
    return availableIn
        .split(",")
        .map((token) => availabilitySkillToken(token))
        .some((token) => {
            const normalizedToken = normalize(token);
            return normalizedToken === normalizedSkillId || (normalizedSkillLabel && normalizedToken === normalizedSkillLabel);
        });
}

export function choiceProgressionForSkill(choice, itemType, skillId, skillLabel = "", fallback = null) {
    const normalizedSkillId = normalize(skillId);
    const normalizedSkillLabel = normalize(skillLabel);
    const progression = firstInteger(
        choice?.selectionProgression,
        itemType === "spell" ? choice?.system?.skillLevel : choice?.system?.level,
        choice?.progression,
        fallback
    );

    if (itemType === "strength") return progression;

    const availableIn = String(choice?.system?.availableIn ?? choice?.availableIn ?? choice?.availability ?? "");
    if (availableIn) {
        for (const token of availableIn.split(",").map((part) => part.trim()).filter(Boolean)) {
            const parsed = parseAvailabilityToken(token);
            const normalizedToken = normalize(parsed.skill);
            if (normalizedToken !== normalizedSkillId && (!normalizedSkillLabel || normalizedToken !== normalizedSkillLabel)) continue;
            return Number.isInteger(parsed.value) ? parsed.value : progression;
        }
        return null;
    }

    const choiceSkill = normalize(choice?.system?.skill ?? choice?.skill ?? "");
    if (choiceSkill && choiceSkill !== normalizedSkillId && (!normalizedSkillLabel || choiceSkill !== normalizedSkillLabel)) return null;
    return progression;
}

function availabilitySkillToken(token) {
    return parseAvailabilityToken(token).skill;
}

function parseAvailabilityToken(token) {
    const text = String(token ?? "").trim();
    const match = text.match(/^(.+?)[\s:]+([0-9]+)$/);
    return {
        skill: (match?.[1] ?? text).trim(),
        value: match ? Number.parseInt(match[2], 10) : null,
    };
}

function firstInteger(...values) {
    for (const value of values) {
        const number = Number.parseInt(value, 10);
        if (Number.isInteger(number)) return number;
    }
    return null;
}
