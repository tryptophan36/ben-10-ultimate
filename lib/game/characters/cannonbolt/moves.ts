import { PHYSICS_TIMESTEP } from "@/lib/game/physics";
import { ATTACK_PHASE, type AttackDefinition } from "@/lib/game/combat/types";
import { cannonboltGroundedRollPose, CANNONBOLT_CLIPS } from "@/lib/game/characters/cannonbolt/form";

/**
 * Fast Roll reuses the looping CB_Roll clip, so its phases are physics frames
 * rather than clip time. 60 Hz: 8 startup, 18 active, 12 recovery (0.633s).
 * The sphere sits on the front of the ball. CB_Roll itself is not an attack.
 */
const FAST_ROLL_STARTUP = 8;
const FAST_ROLL_ACTIVE = 18;
const FAST_ROLL_RECOVERY = 12;
const FAST_ROLL_FRAMES = FAST_ROLL_STARTUP + FAST_ROLL_ACTIVE + FAST_ROLL_RECOVERY;
/** Front of the ball, with enough lead that a full-speed step still overlaps a touch. */
const FAST_ROLL_FORWARD: readonly [number, number, number] = [0, 0, 1.05];

/**
 * CB_BodySlam is 36 frames at 25 fps (1.44s). The root stays put, so the clip
 * is a pose: frames 1–8 crouch, 8–24 curl into the dive, 25–29 impact,
 * 29–36 stand up. World motion is the character controller. 60 Hz: 8 startup,
 * airborne until Rapier lands, 6 impact, 18 recovery. The sphere is the
 * landing AOE, centered on the body, and it opens only in the impact phase.
 */
const BODY_SLAM_FRAME_RATE = 25;
const BODY_SLAM_STARTUP = 8;
const BODY_SLAM_ACTIVE = 6;
const BODY_SLAM_RECOVERY = 18;
const BODY_SLAM_CLIP_SECONDS = 36 / BODY_SLAM_FRAME_RATE;
const BODY_SLAM_CENTER: readonly [number, number, number] = [0, 0.9, 0];

function bodySlamFrame(frame: number): number {
  return frame / BODY_SLAM_FRAME_RATE;
}

export const cannonboltMoves: readonly AttackDefinition[] = [
  {
    id: "CB_FastRoll",
    characterId: "cannonbolt",
    kind: "melee",
    slot: "light",
    slotLabel: "fast roll",
    animation: "CB_FastRoll",
    damage: 25,
    startup: FAST_ROLL_STARTUP,
    active: FAST_ROLL_ACTIVE,
    recovery: FAST_ROLL_RECOVERY,
    knockback: { horizontal: 16, vertical: 2.4 },
    hitstopMs: 90,
    cameraShake: { amplitude: 0.1, duration: 0.22, frequency: 18 },
    impactScale: 1.6,
    hitstun: 0.45,
    clipDuration: FAST_ROLL_FRAMES * PHYSICS_TIMESTEP,
    interruptible: false,
    multiHit: false,
    clock: "elapsed",
    hitboxes: [{ bone: "Cannonbolt_Ball", radius: 0.65, offset: FAST_ROLL_FORWARD }],
    canStart: (ctx) => !ctx.jumpPressed && cannonboltGroundedRollPose(ctx.form, ctx.grounded),
    stepOnStart: true,
    enterForm: "rolling",
    cancelOnRise: true,
    ignoreClipFinish: true,
    motion: {
      kind: "dash",
      acceleration: 72,
      activeSpeed: 22,
      steer: true,
    },
    presentation: {
      clip: CANNONBOLT_CLIPS.roll,
      form: "rolling",
    },
  },
  {
    id: "CB_BodySlam",
    characterId: "cannonbolt",
    kind: "melee",
    slot: "heavy",
    slotLabel: "body slam",
    animation: CANNONBOLT_CLIPS.bodySlam,
    damage: 35,
    startup: BODY_SLAM_STARTUP,
    active: BODY_SLAM_ACTIVE,
    recovery: BODY_SLAM_RECOVERY,
    knockback: { horizontal: 16, vertical: 4.5 },
    knockbackStyle: "radial",
    hitstopMs: 110,
    cameraShake: { amplitude: 0.16, duration: 0.32, frequency: 14 },
    impactScale: 2.2,
    hitstun: 0.6,
    clipDuration: BODY_SLAM_CLIP_SECONDS,
    interruptible: false,
    multiHit: false,
    clock: "landing",
    hitboxes: [{ bone: "Cannonbolt_Root", radius: 2.75, offset: BODY_SLAM_CENTER }],
    canStart: (ctx) => cannonboltGroundedRollPose(ctx.form, ctx.grounded),
    stepOnStart: true,
    ignoreClipFinish: true,
    motion: {
      kind: "launch",
      lockPlanar: true,
      lockJump: true,
    },
    presentation: {
      form: (phase) => (phase === ATTACK_PHASE.airborne ? "jumping" : "standing"),
    },
    pose: {
      startup: { start: bodySlamFrame(1), end: bodySlamFrame(8) },
      airborne: { start: bodySlamFrame(8), end: bodySlamFrame(24) },
      active: { start: bodySlamFrame(25), end: bodySlamFrame(29) },
      recovery: { start: bodySlamFrame(29), end: bodySlamFrame(36) },
    },
  },
];
