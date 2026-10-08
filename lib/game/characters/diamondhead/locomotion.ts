import { sharedLocomotion, type LocomotionConfig } from "@/lib/game/locomotion";

export const diamondheadClips = {
  idle: "DH_Idle",
  walk: "DH_Walk",
  run: "DH_Run",
  jump: "DH_Jump",
  crystalPunch: "DH_CrystalPunch",
  shardShot: "DH_ShardShot",
} as const;

/**
 * The GLB already stands on y = 0 at gameplay size. At idle the head tops
 * out at 2.13 m and the tallest crystal at 2.24 m, so the mesh is not scaled.
 * The capsule covers the body, not the crystal tip.
 * 2 * (0.64 + 0.42) = 2.12 m.
 */
export const diamondheadLocomotion: LocomotionConfig = {
  capsuleRadius: 0.42,
  capsuleHalfHeight: 0.64,
  colliderOffset: 0.03,
  snapToGround: 0.32,
  autostepMaxHeight: 0.3,
  autostepMinWidth: 0.18,
  walkSpeed: 2.6,
  runSpeed: 5.6,
  acceleration: 22,
  deceleration: 28,
  jumpVelocity: sharedLocomotion.jumpVelocity,
  gravity: sharedLocomotion.gravity,
  maxFallSpeed: sharedLocomotion.maxFallSpeed,
  groundProbeSpeed: sharedLocomotion.groundProbeSpeed,
  turnSpeed: 8,
  modelYawOffset: 0,
  moveSpeedThreshold: sharedLocomotion.moveSpeedThreshold,
  coyoteTime: sharedLocomotion.coyoteTime,
  attackLockSeconds: sharedLocomotion.attackLockSeconds,
  mass: 110,
  animations: {
    idle: diamondheadClips.idle,
    walk: diamondheadClips.walk,
    run: diamondheadClips.run,
    jump: diamondheadClips.jump,
  },
};
