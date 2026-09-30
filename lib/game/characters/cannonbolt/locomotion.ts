import { sharedLocomotion, type LocomotionConfig } from "@/lib/game/locomotion";
import { CANNONBOLT_CLIPS } from "@/lib/game/characters/cannonbolt/form";

export const cannonboltLocomotion: LocomotionConfig = {
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
  jumpVelocity: sharedLocomotion.jumpVelocity,
  gravity: sharedLocomotion.gravity,
  maxFallSpeed: sharedLocomotion.maxFallSpeed,
  groundProbeSpeed: sharedLocomotion.groundProbeSpeed,
  turnSpeed: 10,
  modelYawOffset: 0,
  moveSpeedThreshold: sharedLocomotion.moveSpeedThreshold,
  coyoteTime: sharedLocomotion.coyoteTime,
  attackLockSeconds: sharedLocomotion.attackLockSeconds,
  mass: 120,
  animations: {
    idle: CANNONBOLT_CLIPS.idle,
    walk: CANNONBOLT_CLIPS.roll,
    run: CANNONBOLT_CLIPS.roll,
    jump: CANNONBOLT_CLIPS.jump,
  },
};
