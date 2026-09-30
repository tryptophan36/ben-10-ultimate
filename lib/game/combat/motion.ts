import {
  ATTACK_PHASE,
  type AttackDefinition,
  type AttackPhase,
  type MoveSlot,
} from "@/lib/game/combat/types";

export type MoveInfluence = {
  acceleration: number;
  speedCap: number | null;
  lockPlanar: boolean;
  lockJump: boolean;
  steerAlongYaw: boolean;
};

/** Body motion for the current phase. Rooted moves leave velocities alone. */
export function influenceForMove(
  attack: AttackDefinition | undefined,
  phase: AttackPhase,
  baseAcceleration: number,
): MoveInfluence {
  const influence: MoveInfluence = {
    acceleration: baseAcceleration,
    speedCap: null,
    lockPlanar: false,
    lockJump: false,
    steerAlongYaw: false,
  };
  const motion = attack?.motion;
  if (!motion || motion.kind === "rooted") {
    return influence;
  }
  if (motion.kind === "dash") {
    if (phase === ATTACK_PHASE.startup || phase === ATTACK_PHASE.active) {
      influence.acceleration = motion.acceleration;
      influence.steerAlongYaw = motion.steer;
      if (phase === ATTACK_PHASE.active) {
        influence.speedCap = motion.activeSpeed;
      }
    }
    return influence;
  }
  influence.lockPlanar = motion.lockPlanar;
  influence.lockJump = motion.lockJump;
  return influence;
}

export function presentationClip(attack: AttackDefinition): string {
  return attack.presentation?.clip ?? attack.animation;
}

export function presentationForm(
  attack: AttackDefinition,
  phase: AttackPhase,
  fallback: string,
): string {
  const form = attack.presentation?.form;
  if (typeof form === "function") {
    return form(phase);
  }
  if (typeof form === "string") {
    return form;
  }
  return fallback;
}

export function movesForSlot(
  moves: readonly AttackDefinition[],
  slot: MoveSlot,
): AttackDefinition[] {
  return moves.filter((move) => move.slot === slot);
}
