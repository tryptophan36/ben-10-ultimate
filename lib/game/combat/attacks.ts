import { PHYSICS_TIMESTEP } from "@/lib/game/physics";
import {
  ATTACK_PHASE,
  type AttackDefinition,
  type AttackPhase,
} from "@/lib/game/combat/types";

/**
 * Frame clock is the 60 Hz physics step.
 *
 * fa_punch_left and fa_punch_right are 0.92s. Frames 14–21 chamber the fist
 * behind the body. The strike itself is frames 24–33, when that fist is
 * forward. Heavy Punch still reaches around frame 50. The hand joint sits
 * at the wrist, so punch spheres are shifted along the bone toward the knuckles.
 */
const PUNCH_CLIP_SECONDS = 0.92;
const HEAVY_CLIP_SECONDS = 1.76;

const PUNCH_STARTUP = 24;
const PUNCH_ACTIVE = 10;
const LEFT_FIST_OFFSET: readonly [number, number, number] = [0, 0.26, 0];
const RIGHT_FIST_OFFSET: readonly [number, number, number] = [0, 0.18, 0];
const HEAVY_STARTUP = 50;
const HEAVY_ACTIVE = 12;

function remainingFrames(clipDuration: number, startup: number, active: number): number {
  const total = Math.round(clipDuration / PHYSICS_TIMESTEP);
  return Math.max(0, total - startup - active);
}

const PUNCH_RECOVERY = remainingFrames(PUNCH_CLIP_SECONDS, PUNCH_STARTUP, PUNCH_ACTIVE);

export const FOUR_ARMS_PUNCH_LEFT: AttackDefinition = {
  id: "four-arms-punch-left",
  characterId: "four-arms",
  kind: "melee",
  animation: "fa_punch_left",
  damage: 10,
  startup: PUNCH_STARTUP,
  active: PUNCH_ACTIVE,
  recovery: PUNCH_RECOVERY,
  knockback: { horizontal: 6, vertical: 2.2 },
  hitstopMs: 70,
  cameraShake: { amplitude: 0.055, duration: 0.18, frequency: 26 },
  impactScale: 1,
  hitstun: 0.25,
  clipDuration: PUNCH_CLIP_SECONDS,
  interruptible: false,
  multiHit: false,
  hitboxes: [{ bone: "Bip01_L_Hand_L", radius: 0.28, offset: LEFT_FIST_OFFSET }],
};

export const FOUR_ARMS_PUNCH_RIGHT: AttackDefinition = {
  id: "four-arms-punch-right",
  characterId: "four-arms",
  kind: "melee",
  animation: "fa_punch_right",
  damage: 10,
  startup: PUNCH_STARTUP,
  active: PUNCH_ACTIVE,
  recovery: PUNCH_RECOVERY,
  knockback: { horizontal: 6, vertical: 2.2 },
  hitstopMs: 70,
  cameraShake: { amplitude: 0.055, duration: 0.18, frequency: 26 },
  impactScale: 1,
  hitstun: 0.25,
  clipDuration: PUNCH_CLIP_SECONDS,
  interruptible: false,
  multiHit: false,
  hitboxes: [{ bone: "Bip01_R_Hand_R", radius: 0.28, offset: RIGHT_FIST_OFFSET }],
};

export const FOUR_ARMS_HEAVY_PUNCH: AttackDefinition = {
  id: "four-arms-heavy-punch",
  characterId: "four-arms",
  kind: "melee",
  animation: "FA_HeavyPunch",
  damage: 25,
  startup: HEAVY_STARTUP,
  active: HEAVY_ACTIVE,
  recovery: remainingFrames(HEAVY_CLIP_SECONDS, HEAVY_STARTUP, HEAVY_ACTIVE),
  knockback: { horizontal: 12, vertical: 3.6 },
  hitstopMs: 100,
  cameraShake: { amplitude: 0.13, duration: 0.28, frequency: 15 },
  impactScale: 1.8,
  hitstun: 0.5,
  clipDuration: HEAVY_CLIP_SECONDS,
  interruptible: false,
  multiHit: false,
  hitboxes: [
    { bone: "Bip01_L_Hand_L", radius: 0.28, offset: LEFT_FIST_OFFSET },
    { bone: "Bip01_R_Hand_R", radius: 0.28, offset: RIGHT_FIST_OFFSET },
    { bone: "L_hand_L", radius: 0.26 },
  ],
};

const ATTACKS: AttackDefinition[] = [
  FOUR_ARMS_PUNCH_LEFT,
  FOUR_ARMS_PUNCH_RIGHT,
  FOUR_ARMS_HEAVY_PUNCH,
];

export type ActiveHitbox = {
  bone: string;
  radius: number;
  offset?: readonly [number, number, number];
  attackIds: string[];
};

export function attacksForCharacter(characterId: string): readonly AttackDefinition[] {
  return ATTACKS.filter((attack) => attack.characterId === characterId);
}

export function attackForAnimation(name: string): AttackDefinition | undefined {
  const folded = name.toLowerCase();
  return ATTACKS.find((attack) => attack.animation.toLowerCase() === folded);
}

export function attackById(id: string): AttackDefinition | undefined {
  return ATTACKS.find((attack) => attack.id === id);
}

export function meleeHitboxes(characterId: string): ActiveHitbox[] {
  const merged = new Map<string, ActiveHitbox>();

  for (const attack of attacksForCharacter(characterId)) {
    for (const hitbox of attack.hitboxes) {
      const existing = merged.get(hitbox.bone);
      if (existing) {
        existing.attackIds.push(attack.id);
        existing.radius = Math.max(existing.radius, hitbox.radius);
        existing.offset ??= hitbox.offset;
      } else {
        merged.set(hitbox.bone, {
          bone: hitbox.bone,
          radius: hitbox.radius,
          offset: hitbox.offset,
          attackIds: [attack.id],
        });
      }
    }
  }

  return [...merged.values()];
}

export function phaseForFrame(attack: AttackDefinition, frame: number): AttackPhase {
  if (frame < attack.startup) {
    return ATTACK_PHASE.startup;
  }
  if (frame < attack.startup + attack.active) {
    return ATTACK_PHASE.active;
  }
  if (frame < attack.startup + attack.active + attack.recovery) {
    return ATTACK_PHASE.recovery;
  }
  return ATTACK_PHASE.idle;
}
