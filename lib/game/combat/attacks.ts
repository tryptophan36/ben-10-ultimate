import { PHYSICS_TIMESTEP } from "@/lib/game/physics";
import {
  ATTACK_PHASE,
  type AttackDefinition,
  type AttackPhase,
} from "@/lib/game/combat/types";

/**
 * Frame clock is the 60 Hz physics step.
 *
 * The Four Arms clips are long mocap takes. The right upper fist does not
 * reach forward until about frame 25 of FA_PUNCH (113 frames). Both upper
 * fists and the lower left fist reach forward together around frame 50 of
 * FA_HeavyPunch (106 frames). Active windows sit on those strikes so the
 * hitboxes can actually touch a target. Recovery is the rest of the clip.
 */
const PUNCH_CLIP_SECONDS = 1.88;
const HEAVY_CLIP_SECONDS = 1.76;

const PUNCH_STARTUP = 24;
const PUNCH_ACTIVE = 8;
const HEAVY_STARTUP = 50;
const HEAVY_ACTIVE = 12;

function remainingFrames(clipDuration: number, startup: number, active: number): number {
  const total = Math.round(clipDuration / PHYSICS_TIMESTEP);
  return Math.max(0, total - startup - active);
}

export const FOUR_ARMS_PUNCH: AttackDefinition = {
  id: "four-arms-punch",
  characterId: "four-arms",
  kind: "melee",
  animation: "FA_Punch",
  damage: 10,
  startup: PUNCH_STARTUP,
  active: PUNCH_ACTIVE,
  recovery: remainingFrames(PUNCH_CLIP_SECONDS, PUNCH_STARTUP, PUNCH_ACTIVE),
  knockback: { horizontal: 6, vertical: 2.2 },
  hitstopMs: 70,
  cameraShake: { amplitude: 0.055, duration: 0.18, frequency: 26 },
  impactScale: 1,
  hitstun: 0.25,
  clipDuration: PUNCH_CLIP_SECONDS,
  interruptible: false,
  multiHit: false,
  hitboxes: [{ bone: "Bip01_R_Hand_R", radius: 0.28 }],
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
    { bone: "Bip01_L_Hand_L", radius: 0.28 },
    { bone: "Bip01_R_Hand_R", radius: 0.28 },
    { bone: "L_hand_L", radius: 0.26 },
  ],
};

const ATTACKS: AttackDefinition[] = [FOUR_ARMS_PUNCH, FOUR_ARMS_HEAVY_PUNCH];

export type ActiveHitbox = {
  bone: string;
  radius: number;
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
      } else {
        merged.set(hitbox.bone, {
          bone: hitbox.bone,
          radius: hitbox.radius,
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
