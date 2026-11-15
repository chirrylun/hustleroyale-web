import type { FxSheet } from "@/lib/sprites/designs";

/*
 * The look of every skill: the icon in menus and the animations in a fight.
 *   shot  - a projectile flying from the caster to the target (ranged skills)
 *   cast  - plays on the caster as the skill starts
 *   hit   - plays on whoever the skill lands on
 * Animations are rows of the effect sheets in /sprites/fx_<sheet>.png. Icons are /skills/<icon>.png.
 */

export interface FxArt {
  sheet: FxSheet;
  row: number;
  /** How big it is drawn, as a multiple of the standard effect size (a fighter is about 1x). */
  size?: number;
  /** Plays at the target's feet (slams, domes, rising skeletons) instead of on their body. */
  ground?: boolean;
}

export interface SkillArt {
  icon: string;
  shot?: FxArt | null; // null: no projectile at all (heals and buffs appear on the target)
  cast?: FxArt;
  hit?: FxArt;
}

const fx = (sheet: FxSheet, row: number, size = 1, ground = false): FxArt => ({ sheet, row, size, ground });

export const SKILL_ART: Record<string, SkillArt> = {
  // Weapon attacks
  "Basic Strike": { icon: "crossed-swords" },
  Stab: { icon: "stab", hit: fx("slash", 2, 0.9) },
  "Quick Stab": { icon: "quick-stab", hit: fx("slash", 2, 0.9) },
  Slash: { icon: "slash", hit: fx("slash", 1, 0.85) },
  Backstab: { icon: "backstab", hit: fx("slash", 3, 1) },
  "Holy Strike": { icon: "holy-strike", hit: fx("impact", 2, 1.1) },
  "Power Slam": { icon: "power-slam", hit: fx("impact", 0, 1.3, true) },
  "Shield Bash": { icon: "shield-bash", hit: fx("impact", 1, 1.1) },
  "Danfo Hook": { icon: "danfo-hook", hit: fx("move", 0, 1.1) },
  "Shadow Step": { icon: "shadow-step", cast: fx("move", 2, 1), hit: fx("slash", 3, 1) },
  // Arrows
  "Aimed Shot": { icon: "aimed-shot", shot: fx("arrow", 0), hit: fx("extra", 0, 0.8) },
  "Pin Shot": { icon: "pin-shot", shot: fx("arrow", 1), hit: fx("extra", 0, 0.9) },
  Volley: { icon: "volley", shot: fx("arrow", 0), hit: fx("arrow", 3, 1.4) },
  "Poison Arrow": { icon: "poison-arrow", shot: fx("arrow", 2), hit: fx("extra", 3, 1) },
  // Magic
  "Basic Bolt": { icon: "basic-bolt", shot: fx("bolt", 0, 1.1), hit: fx("extra", 0, 0.9) },
  "Dark Bolt": { icon: "dark-bolt", shot: fx("bolt", 1, 1.2), hit: fx("extra", 0, 0.9) },
  "Arc Lightning": { icon: "arc-lightning", shot: fx("bolt", 2, 1.3), hit: fx("bolt", 3, 1.1) },
  "Generator Blast": { icon: "generator-blast", shot: fx("bolt", 0, 1.2), hit: fx("bolt", 3, 1.4) },
  Hush: { icon: "hush", shot: null, hit: fx("dark", 3, 1.2) },
  "Soul Drain": { icon: "soul-drain", shot: fx("dark", 0, 1.4), hit: fx("extra", 0, 0.9) },
  Curse: { icon: "curse", shot: null, hit: fx("dark", 1, 0.95) },
  "Raise Skeleton": { icon: "raise-skeleton" }, // its animation plays on the skeleton as it rises
  "Sonic Note": { icon: "sonic-note", shot: fx("music", 0, 1), hit: fx("music", 0, 0.9) },
  // Healing
  "First Aid": { icon: "first-aid", shot: null, hit: fx("heal", 0, 0.9) },
  "Basic Heal": { icon: "basic-heal", shot: null, hit: fx("heal", 0, 0.9) },
  "Heal Pulse": { icon: "heal-pulse", shot: null, hit: fx("heal", 1, 1) },
  Renewal: { icon: "renewal", shot: null, hit: fx("heal", 3, 1.1) },
  Purify: { icon: "purify", shot: null, hit: fx("heal", 2, 1.1) },
  "Lay on Hands": { icon: "lay-on-hands", shot: null, hit: fx("heal", 1, 1.1) },
  "Group Blessing": { icon: "group-blessing", shot: null, hit: fx("heal", 2, 1.1) },
  "Divine Light": { icon: "divine-light", shot: null, hit: fx("impact", 2, 1.3) },
  // Guarding and shouting
  "Shield Wall": { icon: "shield-wall", hit: fx("guard", 1, 0.8) },
  Aegis: { icon: "aegis", hit: fx("guard", 0, 0.8) },
  Fortress: { icon: "fortress", hit: fx("guard", 2, 1.2, true) },
  Taunt: { icon: "taunt", cast: fx("guard", 3, 1.1) },
  Weaken: { icon: "weaken", shot: null, hit: fx("move", 3, 1) },
  "Rally Cry": { icon: "rally-cry", cast: fx("extra", 1, 0.9), hit: fx("extra", 1, 0.8) },
  // Music
  Dirge: { icon: "dirge", hit: fx("music", 1, 0.85) },
  "War Song": { icon: "war-song", hit: fx("music", 2, 0.85) },
  "Quickstep Tune": { icon: "quickstep-tune", hit: fx("music", 3, 0.9) },
  // Slipping away
  Vanish: { icon: "vanish", cast: fx("move", 1, 1.2) },
  Dodge: { icon: "dash", cast: fx("move", 1, 1) },
};

/** Fallback icons for a skill that has no art of its own yet, by what it does. */
const KIND_ICON: Record<string, string> = { damage: "slash", heal: "heal-pulse", shield: "shield-wall", buff: "boost", debuff: "weaken" };

export const artOf = (name: string): SkillArt | undefined => SKILL_ART[name];

/** Skill-tree stat nodes (Haste I-III cut cooldowns, Might I-III add power) have no skill, so they get their own icons. */
const NODE_ICON: [RegExp, string][] = [[/^Haste\b/, "haste"], [/^Might\b/, "boost"]];

/** The menu icon for a skill: its own, or one by kind. */
export const iconOf = (name: string, kind?: string | null): string =>
  SKILL_ART[name]?.icon ?? NODE_ICON.find(([re]) => re.test(name))?.[1] ?? (kind ? KIND_ICON[kind] : undefined) ?? "boost";
