import type { AttackDefinition } from "@/lib/game/combat/types";
import { diamondheadClips } from "@/lib/game/characters/diamondhead/locomotion";

/**
 * Clip timing is 30 fps. The combat clock counts 60 Hz physics steps off the
 * clip time, so each animation frame is two physics steps.
 *
 * Crystal Punch is 30 frames (1s). Frames 9–10 are still startup: the crystal
 * is full size, and the hitbox stays off until the impact on frame 11.
 * Hand_R sits at the wrist. At frame 11 the knuckles reach about 0.52 m
 * along the bone, so the sphere is shifted toward them.
 *
 * Shard Shot is 45 frames (1.5s). Frames 19–20 hold the charge. The shard
 * leaves on frame 21 from ShardSpawn's +Y axis. There is no melee hitbox.
 */
const CLIP_FPS = 30;

function physicsSpan(startFrame: number, endFrame: number): number {
  return (endFrame - startFrame + 1) * (60 / CLIP_FPS);
}

const PUNCH_STARTUP = physicsSpan(1, 10);
const PUNCH_ACTIVE = physicsSpan(11, 13);
const PUNCH_RECOVERY = physicsSpan(14, 30);

const SHARD_STARTUP = physicsSpan(1, 20);
const SHARD_ACTIVE = physicsSpan(21, 22);
const SHARD_RECOVERY = physicsSpan(23, 45);

/** Frame 21 starts at t = 20/30. */
const SHARD_LAUNCH_TIME = 20 / CLIP_FPS;

const FIST_OFFSET: readonly [number, number, number] = [0, 0.34, 0];

export const diamondheadMoves: readonly AttackDefinition[] = [
  {
    id: "DH_CRYSTAL_PUNCH",
    characterId: "diamondhead",
    kind: "melee",
    slot: "light",
    slotLabel: "crystal punch",
    animation: diamondheadClips.crystalPunch,
    damage: 12,
    startup: PUNCH_STARTUP,
    active: PUNCH_ACTIVE,
    recovery: PUNCH_RECOVERY,
    knockback: { horizontal: 7, vertical: 2.4 },
    hitstopMs: 70,
    cameraShake: { amplitude: 0.06, duration: 0.18, frequency: 24 },
    impactScale: 1,
    hitstun: 0.28,
    clipDuration: 30 / CLIP_FPS,
    interruptible: false,
    multiHit: false,
    cutIn: true,
    hitboxes: [{ bone: "Hand_R", radius: 0.26, offset: FIST_OFFSET }],
  },
  {
    id: "DH_SHARD_SHOT",
    characterId: "diamondhead",
    kind: "projectile",
    slot: "heavy",
    slotLabel: "shard shot",
    animation: diamondheadClips.shardShot,
    damage: 18,
    startup: SHARD_STARTUP,
    active: SHARD_ACTIVE,
    recovery: SHARD_RECOVERY,
    knockback: { horizontal: 10, vertical: 2.8 },
    hitstopMs: 80,
    cameraShake: { amplitude: 0.07, duration: 0.2, frequency: 22 },
    impactScale: 0.8,
    hitstun: 0.36,
    clipDuration: 45 / CLIP_FPS,
    interruptible: false,
    multiHit: false,
    cutIn: true,
    hitboxes: [],
    projectile: {
      bone: "ShardSpawn",
      axis: "y",
      time: SHARD_LAUNCH_TIME,
      advance: 0.2,
      speed: 18,
      radius: 0.14,
      lifetime: 1.2,
    },
  },
];
