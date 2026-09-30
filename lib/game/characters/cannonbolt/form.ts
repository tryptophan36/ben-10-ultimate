import { sameAnimationName } from "@/lib/game/animations";
import type { ClipFinish } from "@/lib/game/characters/types";

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

/** Shown in the debug HUD. Curl and uncurl stay inside rolling and standing. */
export const CANNONBOLT_STATE = {
  standing: "CANNONBOLT_STANDING",
  rolling: "CANNONBOLT_ROLLING",
  jumping: "CANNONBOLT_JUMPING",
} as const;

export type CannonboltState = (typeof CANNONBOLT_STATE)[keyof typeof CANNONBOLT_STATE];

/** Internal transition. Only `rolling` shows the ball mesh. */
export type CannonboltPhase = "standing" | "curling" | "rolling" | "uncurling" | "jumping";

export function asCannonboltPhase(form: string): CannonboltPhase {
  if (
    form === "curling" ||
    form === "rolling" ||
    form === "uncurling" ||
    form === "jumping"
  ) {
    return form;
  }
  return "standing";
}

/** Grounded idle or an already-formed roll. Curl, uncurl, and jumps cannot start a slam or roll. */
export function cannonboltGroundedRollPose(form: string, grounded: boolean): boolean {
  return grounded && (form === "standing" || form === "rolling");
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
 * Returns the phase to enter when a one-shot ends.
 * A finish from a phase we already left (jump interrupted curl) is ignored.
 */
export function cannonboltAfterClip(
  phase: CannonboltPhase,
  clipName: string,
  input: { grounded: boolean; hasMoveInput: boolean },
): ClipFinish | undefined {
  if (sameAnimationName(clipName, CANNONBOLT_CLIPS.curl) && phase === "curling") {
    if (!input.grounded) {
      return goto("jumping");
    }
    return goto(input.hasMoveInput ? "rolling" : "uncurling");
  }

  if (sameAnimationName(clipName, CANNONBOLT_CLIPS.uncurl) && phase === "uncurling") {
    if (!input.grounded) {
      return goto("jumping");
    }
    return goto(input.hasMoveInput ? "curling" : "standing");
  }

  if (sameAnimationName(clipName, CANNONBOLT_CLIPS.jump) && phase === "jumping") {
    if (!input.grounded) {
      return { kind: "stay" };
    }
    return goto(input.hasMoveInput ? "curling" : "standing");
  }

  return undefined;
}

function goto(phase: CannonboltPhase): ClipFinish {
  return {
    kind: "goto",
    form: phase,
    animation: animationForCannonboltPhase(phase),
  };
}
