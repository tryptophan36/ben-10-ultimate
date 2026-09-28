import { PHYSICS_TIMESTEP } from "@/lib/game/physics";
import {
  ATTACK_PHASE,
  type AttackDefinition,
  type AttackPhase,
  type AttackPose,
  type PoseWindow,
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

export const CANNONBOLT_FAST_ROLL: AttackDefinition = {
  id: "CB_FastRoll",
  characterId: "cannonbolt",
  kind: "melee",
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
};

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

export const CANNONBOLT_BODY_SLAM: AttackDefinition = {
  id: "CB_BodySlam",
  characterId: "cannonbolt",
  kind: "melee",
  animation: "CB_BodySlam",
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
  pose: {
    startup: { start: bodySlamFrame(1), end: bodySlamFrame(8) },
    airborne: { start: bodySlamFrame(8), end: bodySlamFrame(24) },
    active: { start: bodySlamFrame(25), end: bodySlamFrame(29) },
    recovery: { start: bodySlamFrame(29), end: bodySlamFrame(36) },
  },
};

const ATTACKS: AttackDefinition[] = [
  FOUR_ARMS_PUNCH_LEFT,
  FOUR_ARMS_PUNCH_RIGHT,
  FOUR_ARMS_HEAVY_PUNCH,
  CANNONBOLT_FAST_ROLL,
  CANNONBOLT_BODY_SLAM,
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
