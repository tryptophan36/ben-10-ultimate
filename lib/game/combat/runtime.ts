import { sameAnimationName } from "@/lib/game/animations";
import { attackById, attackForAnimation, phaseForFrame } from "@/lib/game/combat/attacks";
import { isHitstopActive } from "@/lib/game/combat/hitstop";
import {
  ATTACK_PHASE,
  type AttackDefinition,
  type AttackPhase,
  type Damageable,
} from "@/lib/game/combat/types";
import { PHYSICS_TIMESTEP } from "@/lib/game/physics";
import { playerFocus } from "@/lib/game/runtime";

export const clipClock = {
  name: "",
  time: 0,
};

export function publishClipClock(name: string, time: number): void {
  clipClock.name = name;
  clipClock.time = time;
}

type AttackRuntime = {
  live: boolean;
  attackerId: string;
  attackId: string | null;
  serial: number;
  phase: AttackPhase;
  activeFrames: number;
  seenClipStart: boolean;
  /** Physics frames since this attack began. Used by elapsed-clock moves. */
  elapsedFrame: number;
  /** Body Slam has left the ground and can accept a landing. */
  leftGround: boolean;
};

export const attackRuntime: AttackRuntime = {
  live: false,
  attackerId: "",
  attackId: null,
  serial: 0,
  phase: ATTACK_PHASE.idle,
  activeFrames: 0,
  seenClipStart: false,
  elapsedFrame: 0,
  leftGround: false,
};

const hurtboxes = new Map<number, Damageable>();
const hitTargets = new Set<string>();

let targetsHit = 0;
const hitListeners = new Set<() => void>();

function setTargetsHit(count: number): void {
  if (targetsHit === count) {
    return;
  }
  targetsHit = count;
  for (const listener of hitListeners) {
    listener();
  }
}

export function subscribeAttackHits(listener: () => void): () => void {
  hitListeners.add(listener);
  return () => {
    hitListeners.delete(listener);
  };
}

export function getAttackHits(): number {
  return targetsHit;
}

export function getAttackHitsServerSnapshot(): number {
  return 0;
}

export function registerHurtbox(bodyHandle: number, target: Damageable): () => void {
  hurtboxes.set(bodyHandle, target);
  return () => {
    if (hurtboxes.get(bodyHandle) === target) {
      hurtboxes.delete(bodyHandle);
    }
  };
}

export function isHitboxLive(attackIds: readonly string[]): boolean {
  return (
    attackRuntime.phase === ATTACK_PHASE.active &&
    attackRuntime.attackId !== null &&
    attackIds.includes(attackRuntime.attackId)
  );
}

export type AttackClock = {
  attackId: string | null;
  phase: AttackPhase;
  ended: boolean;
  activeFrames: number | null;
  /** Body Slam should apply the jump velocity this step. */
  launch?: boolean;
};

const IDLE_CLOCK: AttackClock = {
  attackId: null,
  phase: ATTACK_PHASE.idle,
  ended: false,
  activeFrames: null,
};

function beginAttack(attack: AttackDefinition, attackerId: string): void {
  attackRuntime.live = true;
  attackRuntime.attackerId = attackerId;
  attackRuntime.attackId = attack.id;
  attackRuntime.serial += 1;
  attackRuntime.phase = ATTACK_PHASE.startup;
  attackRuntime.activeFrames = 0;
  attackRuntime.seenClipStart = false;
  attackRuntime.elapsedFrame = 0;
  attackRuntime.leftGround = false;
  hitTargets.clear();
  setTargetsHit(0);
}

export function endAttackInstance(): void {
  attackRuntime.live = false;
  attackRuntime.attackId = null;
  attackRuntime.phase = ATTACK_PHASE.idle;
  attackRuntime.activeFrames = 0;
  attackRuntime.seenClipStart = false;
  attackRuntime.elapsedFrame = 0;
  attackRuntime.leftGround = false;
  hitTargets.clear();
}

function finishLanding(activeFrames: number | null): AttackClock {
  endAttackInstance();
  return {
    attackId: null,
    phase: ATTACK_PHASE.idle,
    ended: true,
    activeFrames,
  };
}

/**
 * Startup is a fixed windup. Air time lasts until Rapier says the body is
 * supported again. The active window opens on that landing and then closes.
 */
function stepLandingAttack(
  attack: AttackDefinition,
  attackerId: string,
  grounded: boolean,
): AttackClock {
  if (!attackRuntime.live || attackRuntime.attackId !== attack.id) {
    beginAttack(attack, attackerId);
  }

  if (attackRuntime.phase === ATTACK_PHASE.startup) {
    const frame = attackRuntime.elapsedFrame;
    attackRuntime.elapsedFrame += 1;
    if (frame < attack.startup) {
      return {
        attackId: attack.id,
        phase: ATTACK_PHASE.startup,
        ended: false,
        activeFrames: commitPhase(ATTACK_PHASE.startup),
      };
    }
    attackRuntime.elapsedFrame = 0;
    return {
      attackId: attack.id,
      phase: ATTACK_PHASE.airborne,
      ended: false,
      activeFrames: commitPhase(ATTACK_PHASE.airborne),
      launch: true,
    };
  }

  if (attackRuntime.phase === ATTACK_PHASE.airborne) {
    if (!grounded) {
      attackRuntime.leftGround = true;
    }
    if (grounded && attackRuntime.leftGround) {
      attackRuntime.elapsedFrame = 1;
      return {
        attackId: attack.id,
        phase: ATTACK_PHASE.active,
        ended: false,
        activeFrames: commitPhase(ATTACK_PHASE.active),
      };
    }
    // Counts how long the dive pose has played. Landing ignores this.
    attackRuntime.elapsedFrame += 1;
    return {
      attackId: attack.id,
      phase: ATTACK_PHASE.airborne,
      ended: false,
      activeFrames: commitPhase(ATTACK_PHASE.airborne),
    };
  }

  if (attackRuntime.phase === ATTACK_PHASE.active) {
    if (attackRuntime.elapsedFrame >= attack.active) {
      attackRuntime.elapsedFrame = 1;
      return {
        attackId: attack.id,
        phase: ATTACK_PHASE.recovery,
        ended: false,
        activeFrames: commitPhase(ATTACK_PHASE.recovery),
      };
    }
    attackRuntime.elapsedFrame += 1;
    return {
      attackId: attack.id,
      phase: ATTACK_PHASE.active,
      ended: false,
      activeFrames: commitPhase(ATTACK_PHASE.active),
    };
  }

  if (attackRuntime.phase === ATTACK_PHASE.recovery) {
    if (attackRuntime.elapsedFrame >= attack.recovery) {
      return finishLanding(null);
    }
    attackRuntime.elapsedFrame += 1;
    return {
      attackId: attack.id,
      phase: ATTACK_PHASE.recovery,
      ended: false,
      activeFrames: commitPhase(ATTACK_PHASE.recovery),
    };
  }

  return finishLanding(null);
}

function stepElapsedAttack(attack: AttackDefinition, attackerId: string): AttackClock {
  if (!attackRuntime.live || attackRuntime.attackId !== attack.id) {
    beginAttack(attack, attackerId);
  }

  const frame = attackRuntime.elapsedFrame;
  attackRuntime.elapsedFrame += 1;
  const phase = phaseForFrame(attack, frame);
  const activeFrames = commitPhase(phase);
  if (phase === ATTACK_PHASE.idle) {
    endAttackInstance();
    return {
      attackId: null,
      phase: ATTACK_PHASE.idle,
      ended: true,
      activeFrames,
    };
  }

  return {
    attackId: attack.id,
    phase,
    ended: false,
    activeFrames,
  };
}

function commitPhase(next: AttackPhase): number | null {
  const leavingActive =
    attackRuntime.phase === ATTACK_PHASE.active && next !== ATTACK_PHASE.active;
  const finishedActiveFrames = leavingActive ? attackRuntime.activeFrames : null;
  if (next === ATTACK_PHASE.active) {
    attackRuntime.activeFrames += 1;
  }
  attackRuntime.phase = next;
  return finishedActiveFrames;
}

export function stepAttackClock(input: {
  animationName: string | null;
  attackerId: string;
  now: number;
  startedAt: number;
  lockSeconds: number;
  /** Previous Rapier ground result. Used by landing-clock attacks. */
  grounded?: boolean;
}): AttackClock {
  if (isHitstopActive()) {
    return {
      attackId: attackRuntime.attackId,
      phase: attackRuntime.phase,
      ended: false,
      activeFrames: null,
    };
  }

  if (!input.animationName) {
    if (!attackRuntime.live) {
      return IDLE_CLOCK;
    }
    const activeFrames =
      attackRuntime.phase === ATTACK_PHASE.active ? attackRuntime.activeFrames : null;
    endAttackInstance();
    return {
      attackId: null,
      phase: ATTACK_PHASE.idle,
      ended: true,
      activeFrames,
    };
  }

  const attack = attackForAnimation(input.animationName);
  const timedOut = input.now - input.startedAt > input.lockSeconds * 1000;
  if (!attack) {
    if (!timedOut) {
      return {
        attackId: null,
        phase: ATTACK_PHASE.startup,
        ended: false,
        activeFrames: null,
      };
    }
    endAttackInstance();
    return {
      attackId: null,
      phase: ATTACK_PHASE.idle,
      ended: true,
      activeFrames: null,
    };
  }

  if (timedOut) {
    const activeFrames =
      attackRuntime.phase === ATTACK_PHASE.active ? attackRuntime.activeFrames : null;
    endAttackInstance();
    return {
      attackId: null,
      phase: ATTACK_PHASE.idle,
      ended: true,
      activeFrames,
    };
  }

  if (attack.clock === "elapsed") {
    return stepElapsedAttack(attack, input.attackerId);
  }

  if (attack.clock === "landing") {
    return stepLandingAttack(attack, input.attackerId, input.grounded === true);
  }

  if (!attackRuntime.live || attackRuntime.attackId !== attack.id) {
    beginAttack(attack, input.attackerId);
  }

  const clockMatches = sameAnimationName(clipClock.name, attack.animation);
  if (
    !attackRuntime.seenClipStart &&
    clockMatches &&
    clipClock.time < attack.startup * PHYSICS_TIMESTEP + 0.15
  ) {
    attackRuntime.seenClipStart = true;
  }

  if (!attackRuntime.seenClipStart) {
    return {
      attackId: attack.id,
      phase: ATTACK_PHASE.startup,
      ended: false,
      activeFrames: commitPhase(ATTACK_PHASE.startup),
    };
  }

  const frame = Math.max(0, Math.floor(clipClock.time / PHYSICS_TIMESTEP + 1e-4));
  let phase = phaseForFrame(attack, frame);
  const clipDone = clipClock.time >= attack.clipDuration - PHYSICS_TIMESTEP * 0.5;
  if (clipDone) {
    phase = ATTACK_PHASE.idle;
  }

  const activeFrames = commitPhase(phase);
  if (phase === ATTACK_PHASE.idle) {
    endAttackInstance();
    return {
      attackId: null,
      phase: ATTACK_PHASE.idle,
      ended: true,
      activeFrames,
    };
  }

  return {
    attackId: attack.id,
    phase,
    ended: false,
    activeFrames,
  };
}

export function tryHit(
  bodyHandle: number,
  hit: { x: number; y: number; z: number },
): boolean {
  if (attackRuntime.phase !== ATTACK_PHASE.active || attackRuntime.attackId === null) {
    return false;
  }

  const attack = attackById(attackRuntime.attackId);
  const target = hurtboxes.get(bodyHandle);
  if (!attack || !target) {
    return false;
  }

  const key = `${attackRuntime.serial}:${target.id}`;
  if (!attack.multiHit) {
    if (hitTargets.has(key)) {
      return false;
    }
    hitTargets.add(key);
  }

  const connected = target.takeDamage({
    amount: attack.damage,
    knockback: attack.knockback,
    hitstun: attack.hitstun,
    attacker: attackRuntime.attackerId,
    attackId: attack.id,
    attackSerial: attackRuntime.serial,
    facingYaw: playerFocus.yaw,
    attackerX: playerFocus.feet.x,
    attackerZ: playerFocus.feet.z,
    hitX: hit.x,
    hitY: hit.y,
    hitZ: hit.z,
    hitstopMs: attack.hitstopMs,
    cameraShake: attack.cameraShake,
    impactScale: attack.impactScale,
    knockbackStyle: attack.knockbackStyle ?? "facing",
  });
  if (connected) {
    setTargetsHit(targetsHit + 1);
  }
  return connected;
}
