import { sharedLocomotion, type LocomotionConfig } from "@/lib/game/locomotion";

export const fourArmsClips = {
  idle: "FA_Idle",
  walk: "FA_Walk",
  run: "FA_Run",
  jump: "FA_Jump",
  punchLeft: "fa_punch_left",
  punchRight: "fa_punch_right",
  heavyPunch: "FA_HeavyPunch",
  hit: "FA_Hit",
} as const;

export const fourArmsLocomotion: LocomotionConfig = {
  capsuleRadius: 0.42,
  capsuleHalfHeight: 0.68,
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
  mass: 90,
  animations: {
    idle: fourArmsClips.idle,
    walk: fourArmsClips.walk,
    run: fourArmsClips.run,
    jump: fourArmsClips.jump,
  },
};
