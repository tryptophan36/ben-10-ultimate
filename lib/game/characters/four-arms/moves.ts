import { PHYSICS_TIMESTEP } from "@/lib/game/physics";
import type { AttackDefinition } from "@/lib/game/combat/types";
import { fourArmsClips } from "@/lib/game/characters/four-arms/locomotion";

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

const sharedPunch = {
  characterId: "four-arms",
  kind: "melee" as const,
  slot: "light" as const,
  slotLabel: "punch",
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
};

export const fourArmsMoves: readonly AttackDefinition[] = [
  {
    ...sharedPunch,
    id: "four-arms-punch-left",
    animation: fourArmsClips.punchLeft,
    hitboxes: [{ bone: "Bip01_L_Hand_L", radius: 0.28, offset: LEFT_FIST_OFFSET }],
  },
  {
    ...sharedPunch,
    id: "four-arms-punch-right",
    animation: fourArmsClips.punchRight,
    hitboxes: [{ bone: "Bip01_R_Hand_R", radius: 0.28, offset: RIGHT_FIST_OFFSET }],
  },
  {
    id: "four-arms-heavy-punch",
    characterId: "four-arms",
    kind: "melee",
    slot: "heavy",
    slotLabel: "heavy",
    animation: fourArmsClips.heavyPunch,
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
  },
];
