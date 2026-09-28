import type { LocomotionConfig } from "@/lib/game/locomotion";
import { GRAVITY } from "@/lib/game/physics";

function sameClip(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

/**
 * Clips on the standing GLB, plus CB_Roll on the ball GLB.
 * Curl, uncurl, and jump are one-shots. Idle and roll loop.
 */
export const CANNONBOLT_CLIPS = {
  idle: "CB_Idle",
  curl: "CB_Curl",
  uncurl: "CB_Uncurl",
  jump: "CB_Jump",
  roll: "CB_Roll",
  bodySlam: "CB_BodySlam",
} as const;

export const CANNONBOLT_LOOPING = [CANNONBOLT_CLIPS.idle, CANNONBOLT_CLIPS.roll] as const;

export const CANNONBOLT_ONE_SHOTS = [
  CANNONBOLT_CLIPS.curl,
  CANNONBOLT_CLIPS.uncurl,
  CANNONBOLT_CLIPS.jump,
  CANNONBOLT_CLIPS.bodySlam,
] as const;

/** Shown in the debug HUD. Curl and uncurl stay inside rolling and standing. */
export const CANNONBOLT_STATE = {
  standing: "CANNONBOLT_STANDING",
  rolling: "CANNONBOLT_ROLLING",
  jumping: "CANNONBOLT_JUMPING",
} as const;

export type CannonboltState = (typeof CANNONBOLT_STATE)[keyof typeof CANNONBOLT_STATE];

/** Internal transition. Only `rolling` shows the ball mesh. */
export type CannonboltPhase = "standing" | "curling" | "rolling" | "uncurling" | "jumping";

export type CannonboltForm = "standing" | "ball";

/**
 * Per-frame presentation. Not Redux: the mesh swap and roll rate change every step.
 * Normal rolling does not start an attack and does not deal damage.
 */
export const cannonboltView = {
  form: "standing" as CannonboltForm,
  speed: 0,
};

/** Startup acceleration for CB_FastRoll. Normal roll acceleration stays 16. */
export const CANNONBOLT_FAST_ROLL_ACCELERATION = 72;

/** Active-window speed for CB_FastRoll, in meters per second. Normal run stays 9. */
export const CANNONBOLT_FAST_ROLL_SPEED = 22;

/** Ball mesh radius in the GLB, after the node offset that sits it on y = 0. */
const BALL_RADIUS = 1;

export function cannonboltFormForPhase(phase: CannonboltPhase): CannonboltForm {
  return phase === "rolling" ? "ball" : "standing";
}

/** Grounded idle or an already-formed roll. Curl, uncurl, and jumps cannot start it. */
export function cannonboltCanFastRoll(phase: CannonboltPhase, grounded: boolean): boolean {
  return grounded && (phase === "standing" || phase === "rolling");
}

/** Same grounded poses as Fast Roll. An airborne Cannonbolt cannot start it. */
export function cannonboltCanBodySlam(phase: CannonboltPhase, grounded: boolean): boolean {
  return cannonboltCanFastRoll(phase, grounded);
}

export function cannonboltStateForPhase(phase: CannonboltPhase): CannonboltState {
  if (phase === "jumping") {
    return CANNONBOLT_STATE.jumping;
  }
  if (phase === "curling" || phase === "rolling") {
    return CANNONBOLT_STATE.rolling;
  }
  return CANNONBOLT_STATE.standing;
}

export function animationForCannonboltPhase(phase: CannonboltPhase): string {
  switch (phase) {
    case "curling":
      return CANNONBOLT_CLIPS.curl;
    case "rolling":
      return CANNONBOLT_CLIPS.roll;
    case "uncurling":
      return CANNONBOLT_CLIPS.uncurl;
    case "jumping":
      return CANNONBOLT_CLIPS.jump;
    default:
      return CANNONBOLT_CLIPS.idle;
  }
}

/**
 * Curl plays in place. Planar movement starts only after the ball is out.
 * The phase is advanced after the physics step, so the standing and landing
 * frames that are about to enter curl are held too.
 */
export function cannonboltHoldsPlanar(
  phase: CannonboltPhase,
  grounded: boolean,
  hasMoveInput: boolean,
): boolean {
  if (phase === "curling") {
    return true;
  }
  if (phase === "uncurling" && hasMoveInput) {
    return true;
  }
  return grounded && hasMoveInput && (phase === "standing" || phase === "jumping");
}

/**
 * Grounded WASD enters curl, then roll. Releasing input enters uncurl, then idle.
 * Curl and uncurl run to completion so a tap cannot start the opposite clip.
 * Leaving the ground cancels either transition and plays the jump clip.
 */
export function advanceCannonboltPhase(
  phase: CannonboltPhase,
  input: { grounded: boolean; hasMoveInput: boolean },
): CannonboltPhase {
  if (!input.grounded) {
    return "jumping";
  }
  if (phase === "curling" || phase === "uncurling") {
    return phase;
  }
  if (phase === "jumping") {
    return input.hasMoveInput ? "curling" : "standing";
  }
  if (input.hasMoveInput) {
    return phase === "rolling" ? "rolling" : "curling";
  }
  if (phase === "rolling") {
    return "uncurling";
  }
  return "standing";
}

/**
 * Returns the phase to enter when a one-shot ends, or null to keep the current clip.
 * A finish from a phase we already left (jump interrupted curl) is ignored.
 */
export function cannonboltPhaseAfterClip(
  phase: CannonboltPhase,
  clipName: string,
  input: { grounded: boolean; hasMoveInput: boolean },
): CannonboltPhase | null {
  if (sameClip(clipName, CANNONBOLT_CLIPS.curl) && phase === "curling") {
    if (!input.grounded) {
      return "jumping";
    }
    return input.hasMoveInput ? "rolling" : "uncurling";
  }

  if (sameClip(clipName, CANNONBOLT_CLIPS.uncurl) && phase === "uncurling") {
    if (!input.grounded) {
      return "jumping";
    }
    return input.hasMoveInput ? "curling" : "standing";
  }

  if (sameClip(clipName, CANNONBOLT_CLIPS.jump) && phase === "jumping") {
    if (!input.grounded) {
      return null;
    }
    return input.hasMoveInput ? "curling" : "standing";
  }

  return null;
}

/** One CB_Roll cycle is one revolution. Match it to distance traveled on the ground. */
export function cannonboltRollTimeScale(speed: number, clipDuration: number): number {
  const circumference = Math.PI * 2 * BALL_RADIUS;
  if (speed <= 0.08 || clipDuration <= 0) {
    return 0;
  }
  return Math.min(2.5, (speed / circumference) * clipDuration);
}

export const cannonboltLocomotion: LocomotionConfig = {
  movement: "cannonbolt",
  capsuleRadius: 0.9,
  capsuleHalfHeight: 0.1,
  colliderOffset: 0.02,
  snapToGround: 0.4,
  autostepMaxHeight: 0.3,
  autostepMinWidth: 0.2,
  walkSpeed: 6.4,
  runSpeed: 9,
  acceleration: 16,
  deceleration: 20,
  jumpVelocity: 8.6,
  gravity: GRAVITY,
  maxFallSpeed: -28,
  groundProbeSpeed: 2,
  turnSpeed: 10,
  modelYawOffset: 0,
  moveSpeedThreshold: 0.22,
  coyoteTime: 0.08,
  attackLockSeconds: 2.6,
  mass: 120,
  animations: {
    idle: CANNONBOLT_CLIPS.idle,
    walk: CANNONBOLT_CLIPS.roll,
    run: CANNONBOLT_CLIPS.roll,
    jump: CANNONBOLT_CLIPS.jump,
    punchLeft: "CB_PunchLeft",
    punchRight: "CB_PunchRight",
    heavyPunch: "CB_HeavyPunch",
  },
};
