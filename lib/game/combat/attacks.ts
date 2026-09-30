import { characters } from "@/lib/game/characters";
import { PHYSICS_TIMESTEP } from "@/lib/game/physics";
import {
  ATTACK_PHASE,
  type AttackDefinition,
  type AttackPhase,
  type AttackPose,
  type PoseWindow,
} from "@/lib/game/combat/types";

const ATTACKS: readonly AttackDefinition[] = Object.values(characters).flatMap(
  (character) => character.moves,
);

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

function poseWindow(pose: AttackPose, phase: AttackPhase): PoseWindow | null {
  switch (phase) {
    case ATTACK_PHASE.startup:
      return pose.startup;
    case ATTACK_PHASE.airborne:
      return pose.airborne;
    case ATTACK_PHASE.active:
      return pose.active;
    case ATTACK_PHASE.recovery:
      return pose.recovery;
    default:
      return null;
  }
}

/**
 * Clip time for the current physics phase. Airborne holds the dive pose.
 * Startup, impact, and recovery scrub their windows. Returns null when this
 * attack has no pose, or the phase is idle.
 */
export function landingPoseTime(
  attack: AttackDefinition,
  phase: AttackPhase,
  elapsedFrame: number,
): number | null {
  if (!attack.pose) {
    return null;
  }
  const window = poseWindow(attack.pose, phase);
  if (!window) {
    return null;
  }

  if (phase === ATTACK_PHASE.airborne) {
    const time = window.start + Math.max(0, elapsedFrame) * PHYSICS_TIMESTEP;
    return Math.min(window.end, Math.max(window.start, time));
  }

  const span =
    phase === ATTACK_PHASE.startup
      ? attack.startup
      : phase === ATTACK_PHASE.active
        ? attack.active
        : attack.recovery;
  const u =
    span <= 1 ? 1 : Math.min(1, Math.max(0, (elapsedFrame - 1) / (span - 1)));
  return window.start + (window.end - window.start) * u;
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
