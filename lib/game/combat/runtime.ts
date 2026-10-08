import type { CameraShakeSpec } from "@/lib/game/camera/cameraShake";
import { sameAnimationName } from "@/lib/game/animations";
import { attackById, attackForAnimation, phaseForFrame } from "@/lib/game/combat/attacks";
import { isHitstopActive } from "@/lib/game/combat/hitstop";
import {
  ATTACK_PHASE,
  type AttackDefinition,
  type AttackPhase,
  type Damageable,
  type Knockback,
} from "@/lib/game/combat/types";
import { PLAYER_FIGHTER_ID } from "@/lib/game/combat/fighters";
import { PHYSICS_TIMESTEP } from "@/lib/game/physics";

type ClipClock = {
  name: string;
  time: number;
};

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
  feetX: number;
  feetZ: number;
  yaw: number;
  hitTargets: Set<string>;
};

const attacks = new Map<string, AttackRuntime>();
const clipClocks = new Map<string, ClipClock>();

let targetsHit = 0;
const hitListeners = new Set<() => void>();

function createAttackRuntime(): AttackRuntime {
  return {
    live: false,
    attackerId: "",
    attackId: null,
    serial: 0,
    phase: ATTACK_PHASE.idle,
    activeFrames: 0,
    seenClipStart: false,
    elapsedFrame: 0,
    leftGround: false,
    feetX: 0,
    feetZ: 0,
    yaw: 0,
    hitTargets: new Set(),
  };
}

export function getAttackRuntime(fighterId: string): AttackRuntime {
  let state = attacks.get(fighterId);
  if (!state) {
    state = createAttackRuntime();
    attacks.set(fighterId, state);
  }
  return state;
}

function clipState(fighterId: string): ClipClock {
  let clock = clipClocks.get(fighterId);
  if (!clock) {
    clock = { name: "", time: 0 };
    clipClocks.set(fighterId, clock);
  }
  return clock;
}

export function publishClipClock(fighterId: string, name: string, time: number): void {
  const clock = clipState(fighterId);
  clock.name = name;
  clock.time = time;
}

export function readClipClock(fighterId: string): { name: string; time: number } {
  const clock = clipState(fighterId);
  return { name: clock.name, time: clock.time };
}

export function publishAttackerPose(
  fighterId: string,
  x: number,
  z: number,
  yaw: number,
): void {
  const state = getAttackRuntime(fighterId);
  state.feetX = x;
  state.feetZ = z;
  state.yaw = yaw;
}

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

const hurtboxes = new Map<number, Damageable>();
const combatResetListeners = new Set<() => void>();

export function subscribeCombatReset(listener: () => void): () => void {
  combatResetListeners.add(listener);
  return () => {
    combatResetListeners.delete(listener);
  };
}

export function registerHurtbox(bodyHandle: number, target: Damageable): () => void {
  hurtboxes.set(bodyHandle, target);
  return () => {
    if (hurtboxes.get(bodyHandle) === target) {
      hurtboxes.delete(bodyHandle);
    }
  };
}

/** Fighter id registered on this rigid body, or null for the stage. */
export function rigidBodyFighter(handle: number): string | null {
  return hurtboxes.get(handle)?.id ?? null;
}

export function isHitboxLive(fighterId: string, attackIds: readonly string[]): boolean {
  const state = getAttackRuntime(fighterId);
  return (
    state.phase === ATTACK_PHASE.active &&
    state.attackId !== null &&
    attackIds.includes(state.attackId)
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

function beginAttack(state: AttackRuntime, attack: AttackDefinition, attackerId: string): void {
  state.live = true;
  state.attackerId = attackerId;
  state.attackId = attack.id;
  state.serial += 1;
  state.phase = ATTACK_PHASE.startup;
  state.activeFrames = 0;
  state.seenClipStart = false;
  state.elapsedFrame = 0;
  state.leftGround = false;
  state.hitTargets.clear();
  if (attackerId === PLAYER_FIGHTER_ID) {
    setTargetsHit(0);
  }
}

export function endAttackInstance(fighterId: string): void {
  const state = getAttackRuntime(fighterId);
  state.live = false;
  state.attackId = null;
  state.phase = ATTACK_PHASE.idle;
  state.activeFrames = 0;
  state.seenClipStart = false;
  state.elapsedFrame = 0;
  state.leftGround = false;
  state.hitTargets.clear();
}

function finishLanding(state: AttackRuntime, activeFrames: number | null): AttackClock {
  state.live = false;
  state.attackId = null;
  state.phase = ATTACK_PHASE.idle;
  state.activeFrames = 0;
  state.seenClipStart = false;
  state.elapsedFrame = 0;
  state.leftGround = false;
  state.hitTargets.clear();
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
  state: AttackRuntime,
  attack: AttackDefinition,
  attackerId: string,
  grounded: boolean,
): AttackClock {
  if (!state.live || state.attackId !== attack.id) {
    beginAttack(state, attack, attackerId);
  }

  if (state.phase === ATTACK_PHASE.startup) {
    const frame = state.elapsedFrame;
    state.elapsedFrame += 1;
    if (frame < attack.startup) {
      return {
        attackId: attack.id,
        phase: ATTACK_PHASE.startup,
        ended: false,
        activeFrames: commitPhase(state, ATTACK_PHASE.startup),
      };
    }
    state.elapsedFrame = 0;
    return {
      attackId: attack.id,
      phase: ATTACK_PHASE.airborne,
      ended: false,
      activeFrames: commitPhase(state, ATTACK_PHASE.airborne),
      launch: true,
    };
  }

  if (state.phase === ATTACK_PHASE.airborne) {
    if (!grounded) {
      state.leftGround = true;
    }
    if (grounded && state.leftGround) {
      state.elapsedFrame = 1;
      return {
        attackId: attack.id,
        phase: ATTACK_PHASE.active,
        ended: false,
        activeFrames: commitPhase(state, ATTACK_PHASE.active),
      };
    }
    // Counts how long the dive pose has played. Landing ignores this.
    state.elapsedFrame += 1;
    return {
      attackId: attack.id,
      phase: ATTACK_PHASE.airborne,
      ended: false,
      activeFrames: commitPhase(state, ATTACK_PHASE.airborne),
    };
  }

  if (state.phase === ATTACK_PHASE.active) {
    if (state.elapsedFrame >= attack.active) {
      state.elapsedFrame = 1;
      return {
        attackId: attack.id,
        phase: ATTACK_PHASE.recovery,
        ended: false,
        activeFrames: commitPhase(state, ATTACK_PHASE.recovery),
      };
    }
    state.elapsedFrame += 1;
    return {
      attackId: attack.id,
      phase: ATTACK_PHASE.active,
      ended: false,
      activeFrames: commitPhase(state, ATTACK_PHASE.active),
    };
  }

  if (state.phase === ATTACK_PHASE.recovery) {
    if (state.elapsedFrame >= attack.recovery) {
      return finishLanding(state, null);
    }
    state.elapsedFrame += 1;
    return {
      attackId: attack.id,
      phase: ATTACK_PHASE.recovery,
      ended: false,
      activeFrames: commitPhase(state, ATTACK_PHASE.recovery),
    };
  }

  return finishLanding(state, null);
}

function stepElapsedAttack(
  state: AttackRuntime,
  attack: AttackDefinition,
  fighterId: string,
  attackerId: string,
): AttackClock {
  if (!state.live || state.attackId !== attack.id) {
    beginAttack(state, attack, attackerId);
  }

  const frame = state.elapsedFrame;
  state.elapsedFrame += 1;
  const phase = phaseForFrame(attack, frame);
  const activeFrames = commitPhase(state, phase);
  if (phase === ATTACK_PHASE.idle) {
    endAttackInstance(fighterId);
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

function commitPhase(state: AttackRuntime, next: AttackPhase): number | null {
  const leavingActive = state.phase === ATTACK_PHASE.active && next !== ATTACK_PHASE.active;
  const finishedActiveFrames = leavingActive ? state.activeFrames : null;
  if (next === ATTACK_PHASE.active) {
    state.activeFrames += 1;
  }
  state.phase = next;
  return finishedActiveFrames;
}

export function stepAttackClock(input: {
  fighterId: string;
  animationName: string | null;
  attackerId: string;
  now: number;
  startedAt: number;
  lockSeconds: number;
  /** Previous Rapier ground result. Used by landing-clock attacks. */
  grounded?: boolean;
}): AttackClock {
  const state = getAttackRuntime(input.fighterId);
  const clipClock = clipState(input.fighterId);

  if (isHitstopActive()) {
    return {
      attackId: state.attackId,
      phase: state.phase,
      ended: false,
      activeFrames: null,
    };
  }

  if (!input.animationName) {
    if (!state.live) {
      return IDLE_CLOCK;
    }
    const activeFrames = state.phase === ATTACK_PHASE.active ? state.activeFrames : null;
    endAttackInstance(input.fighterId);
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
    endAttackInstance(input.fighterId);
    return {
      attackId: null,
      phase: ATTACK_PHASE.idle,
      ended: true,
      activeFrames: null,
    };
  }

  if (timedOut) {
    const activeFrames = state.phase === ATTACK_PHASE.active ? state.activeFrames : null;
    endAttackInstance(input.fighterId);
    return {
      attackId: null,
      phase: ATTACK_PHASE.idle,
      ended: true,
      activeFrames,
    };
  }

  if (attack.clock === "elapsed") {
    return stepElapsedAttack(state, attack, input.fighterId, input.attackerId);
  }

  if (attack.clock === "landing") {
    return stepLandingAttack(state, attack, input.attackerId, input.grounded === true);
  }

  if (!state.live || state.attackId !== attack.id) {
    beginAttack(state, attack, input.attackerId);
  }

  const clockMatches = sameAnimationName(clipClock.name, attack.animation);
  if (
    !state.seenClipStart &&
    clockMatches &&
    clipClock.time < attack.startup * PHYSICS_TIMESTEP + 0.15
  ) {
    state.seenClipStart = true;
  }

  if (!state.seenClipStart) {
    return {
      attackId: attack.id,
      phase: ATTACK_PHASE.startup,
      ended: false,
      activeFrames: commitPhase(state, ATTACK_PHASE.startup),
    };
  }

  const frame = Math.max(0, Math.floor(clipClock.time / PHYSICS_TIMESTEP + 1e-4));
  let phase = phaseForFrame(attack, frame);
  const clipDone = clipClock.time >= attack.clipDuration - PHYSICS_TIMESTEP * 0.5;
  if (clipDone) {
    phase = ATTACK_PHASE.idle;
  }

  const activeFrames = commitPhase(state, phase);
  if (phase === ATTACK_PHASE.idle) {
    endAttackInstance(input.fighterId);
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

export type ProjectileStrike = {
  attackId: string;
  serial: number;
  damage: number;
  knockback: Knockback;
  hitstun: number;
  hitstopMs: number;
  cameraShake: CameraShakeSpec;
  impactScale: number;
  facingYaw: number;
  attackerX: number;
  attackerZ: number;
};

/**
 * Damage from a projectile. Unlike a melee hitbox, this does not require the
 * attacker's active window — the shard keeps its own payload after launch.
 */
export function tryProjectileHit(
  fighterId: string,
  bodyHandle: number,
  hit: { x: number; y: number; z: number },
  strike: ProjectileStrike,
): boolean {
  const target = hurtboxes.get(bodyHandle);
  if (!target || target.id === fighterId) {
    return false;
  }

  const connected = target.takeDamage({
    amount: strike.damage,
    knockback: strike.knockback,
    hitstun: strike.hitstun,
    attacker: fighterId,
    attackId: strike.attackId,
    attackSerial: strike.serial,
    facingYaw: strike.facingYaw,
    attackerX: strike.attackerX,
    attackerZ: strike.attackerZ,
    hitX: hit.x,
    hitY: hit.y,
    hitZ: hit.z,
    hitstopMs: strike.hitstopMs,
    cameraShake: strike.cameraShake,
    impactScale: strike.impactScale,
    knockbackStyle: "facing",
  });
  if (connected && fighterId === PLAYER_FIGHTER_ID) {
    setTargetsHit(targetsHit + 1);
  }
  return connected;
}

export function tryHit(
  fighterId: string,
  bodyHandle: number,
  hit: { x: number; y: number; z: number },
): boolean {
  const state = getAttackRuntime(fighterId);
  if (state.phase !== ATTACK_PHASE.active || state.attackId === null) {
    return false;
  }

  const attack = attackById(state.attackId);
  const target = hurtboxes.get(bodyHandle);
  if (!attack || !target || target.id === state.attackerId) {
    return false;
  }

  const key = `${state.serial}:${target.id}`;
  if (!attack.multiHit) {
    if (state.hitTargets.has(key)) {
      return false;
    }
    state.hitTargets.add(key);
  }

  const connected = target.takeDamage({
    amount: attack.damage,
    knockback: attack.knockback,
    hitstun: attack.hitstun,
    attacker: state.attackerId,
    attackId: attack.id,
    attackSerial: state.serial,
    facingYaw: state.yaw,
    attackerX: state.feetX,
    attackerZ: state.feetZ,
    hitX: hit.x,
    hitY: hit.y,
    hitZ: hit.z,
    hitstopMs: attack.hitstopMs,
    cameraShake: attack.cameraShake,
    impactScale: attack.impactScale,
    knockbackStyle: attack.knockbackStyle ?? "facing",
  });
  if (connected && fighterId === PLAYER_FIGHTER_ID) {
    setTargetsHit(targetsHit + 1);
  }
  return connected;
}

export function resetCombatRuntime(): void {
  attacks.clear();
  clipClocks.clear();
  hurtboxes.clear();
  setTargetsHit(0);
  for (const listener of combatResetListeners) {
    listener();
  }
}
