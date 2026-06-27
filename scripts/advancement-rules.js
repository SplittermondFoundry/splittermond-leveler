const localize = (key, fallback) => {
    const localized = globalThis.game?.i18n?.localize?.(key);
    return localized && localized !== key ? localized : fallback;
};

export const MODULE_ID = "splittermond-leveler";
export const ADVANCEMENT_RULES_SETTING_KEY = "advancementRules";

export const DEFAULT_ADVANCEMENT_RULES = {
    heroLevelXpThresholds: { 2: 100, 3: 300, 4: 600 },
    maxSkillPointsByHeroLevel: { 1: 6, 2: 9, 3: 12, 4: 15 },
    maxAttributeIncreasesByHeroLevel: { 1: 1, 2: 2, 3: 3, 4: 4 },
    skillPointCostsByHeroLevel: { 1: 3, 2: 5, 3: 7, 4: 9 },
    attributeCostsByIncrease: { 1: 10, 2: 15, 3: 20, 4: 25 },
    masteryCostsByThreshold: { 1: 5, 2: 10, 3: 15, 4: 20 },
    spellCostsByGrade: { 0: 1, 1: 3, 2: 6, 3: 9, 4: 12, 5: 15 },
    strengthCostsByLevel: { 1: 7, 2: 14 },
    languageCost: 5,
    resourceCostPerPoint: 7,
    resourceMaximum: 6,
    masteryThresholdRequirements: [
        { points: 6, maxThreshold: 1 },
        { points: 9, maxThreshold: 2 },
        { points: 12, maxThreshold: 3 },
        { points: 15, maxThreshold: 4 },
    ],
    spellGradeRequirements: [
        { points: 1, maxGrade: 0 },
        { points: 3, maxGrade: 1 },
        { points: 6, maxGrade: 2 },
        { points: 9, maxGrade: 3 },
        { points: 12, maxGrade: 4 },
        { points: 15, maxGrade: 5 },
    ],
};

export function defaultAdvancementRules() {
    return clonePlainData(DEFAULT_ADVANCEMENT_RULES);
}

export function getAdvancementRules() {
    let configuredRules = null;
    try {
        configuredRules = globalThis.game?.settings?.get?.(MODULE_ID, ADVANCEMENT_RULES_SETTING_KEY);
    } catch (_error) {
        configuredRules = null;
    }
    return normalizeAdvancementRules(configuredRules);
}

export function normalizeAdvancementRules(value = {}) {
    const source = value && typeof value === "object" ? value : {};
    return {
        heroLevelXpThresholds: normalizeNumberRecord(source.heroLevelXpThresholds, DEFAULT_ADVANCEMENT_RULES.heroLevelXpThresholds),
        maxSkillPointsByHeroLevel: normalizeNumberRecord(source.maxSkillPointsByHeroLevel, DEFAULT_ADVANCEMENT_RULES.maxSkillPointsByHeroLevel),
        maxAttributeIncreasesByHeroLevel: normalizeNumberRecord(
            source.maxAttributeIncreasesByHeroLevel,
            DEFAULT_ADVANCEMENT_RULES.maxAttributeIncreasesByHeroLevel
        ),
        skillPointCostsByHeroLevel: normalizeNumberRecord(source.skillPointCostsByHeroLevel, DEFAULT_ADVANCEMENT_RULES.skillPointCostsByHeroLevel),
        attributeCostsByIncrease: normalizeNumberRecord(source.attributeCostsByIncrease, DEFAULT_ADVANCEMENT_RULES.attributeCostsByIncrease),
        masteryCostsByThreshold: normalizeNumberRecord(source.masteryCostsByThreshold, DEFAULT_ADVANCEMENT_RULES.masteryCostsByThreshold),
        spellCostsByGrade: normalizeNumberRecord(source.spellCostsByGrade, DEFAULT_ADVANCEMENT_RULES.spellCostsByGrade),
        strengthCostsByLevel: normalizeNumberRecord(source.strengthCostsByLevel, DEFAULT_ADVANCEMENT_RULES.strengthCostsByLevel),
        languageCost: integerSetting(source.languageCost, DEFAULT_ADVANCEMENT_RULES.languageCost),
        resourceCostPerPoint: integerSetting(source.resourceCostPerPoint, DEFAULT_ADVANCEMENT_RULES.resourceCostPerPoint),
        resourceMaximum: integerSetting(source.resourceMaximum, DEFAULT_ADVANCEMENT_RULES.resourceMaximum),
        masteryThresholdRequirements: normalizeRequirementList(
            source.masteryThresholdRequirements,
            DEFAULT_ADVANCEMENT_RULES.masteryThresholdRequirements,
            "maxThreshold"
        ),
        spellGradeRequirements: normalizeRequirementList(source.spellGradeRequirements, DEFAULT_ADVANCEMENT_RULES.spellGradeRequirements, "maxGrade"),
    };
}

function normalizeNumberRecord(source, defaults) {
    const sourceRecord = source && typeof source === "object" ? source : {};
    return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, integerSetting(sourceRecord[key], fallback)]));
}

function normalizeRequirementList(source, defaults, valueKey) {
    const sourceList = Array.isArray(source) ? source : [];
    return defaults.map((defaultEntry, index) => {
        const entry = sourceList[index] && typeof sourceList[index] === "object" ? sourceList[index] : {};
        return {
            points: integerSetting(entry.points, defaultEntry.points),
            [valueKey]: integerSetting(entry[valueKey], defaultEntry[valueKey]),
        };
    });
}

function integerSetting(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    const integer = Math.trunc(number);
    return integer >= 0 ? integer : fallback;
}

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

export const FREE_MASTERY_THRESHOLDS = DEFAULT_ADVANCEMENT_RULES.masteryThresholdRequirements.map((entry) => entry.points);
export const FREE_SPELL_THRESHOLDS = new Map(DEFAULT_ADVANCEMENT_RULES.spellGradeRequirements.map((entry) => [entry.points, entry.maxGrade]));
export const ATTRIBUTE_COSTS = new Map(Object.entries(DEFAULT_ADVANCEMENT_RULES.attributeCostsByIncrease).map(([key, value]) => [Number(key), value]));

export function heldengradForSpent(spentXp) {
    const thresholds = getAdvancementRules().heroLevelXpThresholds;
    if (spentXp >= thresholds[4]) return 4;
    if (spentXp >= thresholds[3]) return 3;
    if (spentXp >= thresholds[2]) return 2;
    return 1;
}

export function heldengradLabel(grade) {
    const fallback = ["", "Suchender", "Wanderer", "Veteran", "Held"][grade] ?? `Grad ${grade}`;
    return localize(`splittermond.heroLevels.${grade}`, fallback);
}

export function maxSkillPointsForHeldengrad(grade) {
    const limits = getAdvancementRules().maxSkillPointsByHeroLevel;
    return limits[grade] ?? limits[4] ?? 15;
}

export function maxAttributeIncreasesForHeldengrad(grade) {
    const limits = getAdvancementRules().maxAttributeIncreasesByHeroLevel;
    return limits[grade] ?? limits[4] ?? 4;
}

export function attributeCostForIncrease(increase) {
    return getAdvancementRules().attributeCostsByIncrease[increase] ?? null;
}

export function skillCostForPoint(targetPoint) {
    const requiredGrade = skillHeldengradRequirement(targetPoint);
    return getAdvancementRules().skillPointCostsByHeroLevel[requiredGrade] ?? null;
}

export function skillHeldengradRequirement(targetPoint) {
    for (const grade of [1, 2, 3, 4]) {
        if (targetPoint <= maxSkillPointsForHeldengrad(grade)) return grade;
    }
    return 4;
}

export function spellCost(grade) {
    return getAdvancementRules().spellCostsByGrade[grade] ?? null;
}

export function masteryCost(threshold) {
    return getAdvancementRules().masteryCostsByThreshold[threshold] ?? null;
}

export function maxSpellGradeForPoints(points) {
    return spellGradeRequirements().reduce((maxGrade, requirement) => (points >= requirement.points ? requirement.maxGrade : maxGrade), -1);
}

export function maxMasteryThresholdForPoints(points) {
    return masteryThresholdRequirements().reduce(
        (maxThreshold, requirement) => (points >= requirement.points ? requirement.maxThreshold : maxThreshold),
        0
    );
}

export function masteryThresholdRequirements() {
    return getAdvancementRules()
        .masteryThresholdRequirements.slice()
        .sort((left, right) => left.points - right.points);
}

export function spellGradeRequirements() {
    return getAdvancementRules()
        .spellGradeRequirements.slice()
        .sort((left, right) => left.points - right.points);
}

export function strengthCost(level) {
    return getAdvancementRules().strengthCostsByLevel[level] ?? null;
}

export function languageCost() {
    return getAdvancementRules().languageCost;
}

export function resourceCostPerPoint() {
    return getAdvancementRules().resourceCostPerPoint;
}

export function resourceMaximum() {
    return getAdvancementRules().resourceMaximum;
}

export function planCost(plan) {
    return plan.reduce((sum, entry) => sum + (entry.cost ?? 0), 0);
}

export function projectedSpent(state, plan) {
    return state.xp.spent + planCost(plan);
}

export function projectedHeldengrad(state, plan) {
    return heldengradForSpent(projectedSpent(state, plan));
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

export function itemAllowsMultipleSelection(item) {
    const itemType = item?.itemType ?? item?.type;
    if (itemType !== "mastery") return false;
    return booleanFlagValue(item?.system?.multiSelectable ?? item?.multiSelectable ?? item?.itemData?.system?.multiSelectable);
}

export function itemsDuplicate(left, right) {
    const leftType = left?.itemType ?? left?.type;
    const rightType = right?.itemType ?? right?.type;
    if (!duplicateCheckedItemType(leftType) || leftType !== rightType) return false;

    const leftUuid = duplicateSourceUuid(left);
    const rightUuid = duplicateSourceUuid(right);
    if (leftUuid && rightUuid && leftUuid === rightUuid) return true;

    const leftName = normalize(left?.name);
    const rightName = normalize(right?.name);
    if (!leftName || leftName !== rightName) return false;
    if (leftType === "strength") return true;

    const leftSkill = duplicateSkillId(left);
    const rightSkill = duplicateSkillId(right);
    return !leftSkill || !rightSkill || leftSkill === rightSkill;
}

export function duplicateSelectionState(target, existingItems = [], plannedEntries = [], { ignoreEntryId = null } = {}) {
    const itemType = target?.itemType ?? target?.type;
    if (!duplicateCheckedItemType(itemType) || itemAllowsMultipleSelection(target)) {
        return { duplicate: false, known: false, planned: false, warning: null };
    }

    const known = existingItems.some((item) => itemsDuplicate(target, item));
    const planned = plannedEntries.some((entry) => {
        if (entry?.id && entry.id === ignoreEntryId) return false;
        if (entry?.type !== "item") return false;
        return itemsDuplicate(target, entry);
    });
    return {
        duplicate: known || planned,
        known,
        planned,
        warning: duplicateWarning(itemType, known, planned),
    };
}

function duplicateCheckedItemType(itemType) {
    return itemType === "mastery" || itemType === "strength" || itemType === "spell";
}

function booleanFlagValue(value) {
    if (value === true || value === 1) return true;
    if (value === false || value === 0 || value == null) return false;
    return ["true", "1", "yes", "on", "ja"].includes(String(value).trim().toLowerCase());
}

function duplicateSourceUuid(item) {
    return item?.sourceUuid ?? item?.uuid ?? null;
}

function duplicateSkillId(item) {
    return normalize(item?.skillId ?? item?.system?.skill ?? item?.itemData?.system?.skill ?? "");
}

function duplicateWarning(itemType, known, planned) {
    if (!known && !planned) return null;
    const subject =
        itemType === "spell" ? "Dieser Zauber" : itemType === "strength" ? "Diese St\u00e4rke" : "Diese Meisterschaft";
    if (known && planned) return `${subject} ist bereits bekannt und geplant.`;
    if (known) return `${subject} ist bereits bekannt.`;
    return `${subject} ist bereits geplant.`;
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

export function buildPlannedItemData(entry, { clone = clonePlainData, flagScope = null } = {}) {
    const data = entry.itemData ? clone(entry.itemData) : {};
    data.name = entry.name;
    data.type = entry.itemType;
    data.system = {
        ...(entry.fallbackSystem ?? {}),
        ...(data.system ?? {}),
        ...(entry.systemOverrides ?? {}),
    };
    if (flagScope) {
        data.flags = data.flags ?? {};
        data.flags[flagScope] = { ...(data.flags[flagScope] ?? {}), entryId: entry.id };
    }
    return data;
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

function clonePlainData(data) {
    if (data == null || typeof data !== "object") return data;
    if (typeof structuredClone === "function") return structuredClone(data);
    return JSON.parse(JSON.stringify(data));
}
