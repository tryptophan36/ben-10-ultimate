import { GRAVITY } from "@/lib/game/physics";

export type MovementState = "idle" | "walk" | "run" | "jump";

export type LocomotionConfig = {
  capsuleRadius: number;
  capsuleHalfHeight: number;
  colliderOffset: number;
  snapToGround: number;
  autostepMaxHeight: number;
  autostepMinWidth: number;
  walkSpeed: number;
  runSpeed: number;
  acceleration: number;
  deceleration: number;
  jumpVelocity: number;
  gravity: number;
  maxFallSpeed: number;
  groundProbeSpeed: number;
  turnSpeed: number;
  modelYawOffset: number;
  moveSpeedThreshold: number;
  coyoteTime: number;
  attackLockSeconds: number;
  mass: number;
  animations: {
    idle: string;
    walk: string;
    run: string;
    jump: string;
    punch: string;
    heavyPunch: string;
  };
};

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
  jumpVelocity: 8.6,
  gravity: GRAVITY,
  maxFallSpeed: -28,
  groundProbeSpeed: 2,
  turnSpeed: 8,
  modelYawOffset: 0,
  moveSpeedThreshold: 0.22,
  coyoteTime: 0.08,
  attackLockSeconds: 2.6,
  mass: 90,
  animations: {
    idle: "FA_Idle",
    walk: "FA_Walk",
    run: "FA_Run",
    jump: "FA_Jump",
    punch: "FA_Punch",
    heavyPunch: "FA_HeavyPunch",
  },
};

export function capsuleHalfExtent(config: LocomotionConfig): number {
  return config.capsuleHalfHeight + config.capsuleRadius;
}

export function spawnHeight(config: LocomotionConfig): number {
  return capsuleHalfExtent(config) + config.colliderOffset;
}

export function visualDrop(config: LocomotionConfig): number {
  return -spawnHeight(config);
}

export function selectMovementState(
  config: LocomotionConfig,
  input: {
    grounded: boolean;
    speed: number;
    runHeld: boolean;
    hasMoveInput: boolean;
  },
): MovementState {
  if (!input.grounded) {
    return "jump";
  }
  if (input.runHeld && input.hasMoveInput) {
    return "run";
  }
  if (input.hasMoveInput || input.speed >= config.moveSpeedThreshold) {
    return "walk";
  }
  return "idle";
}

export function animationForMovement(
  config: LocomotionConfig,
  state: MovementState,
): string {
  switch (state) {
    case "jump":
      return config.animations.jump;
    case "run":
      return config.animations.run;
    case "walk":
      return config.animations.walk;
    default:
      return config.animations.idle;
  }
}

export function isAttackAnimation(config: LocomotionConfig, name: string): boolean {
  const folded = name.toLowerCase();
  return (
    folded === config.animations.punch.toLowerCase() ||
    folded === config.animations.heavyPunch.toLowerCase()
  );
}

export function yawForDirection(
  x: number,
  z: number,
  modelYawOffset: number,
): number {
  return Math.atan2(x, z) + modelYawOffset;
}

export function stepYaw(
  current: number,
  target: number,
  turnSpeed: number,
  dt: number,
): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  const maxStep = turnSpeed * dt;
  if (Math.abs(delta) <= maxStep) {
    return target;
  }
  return current + Math.sign(delta) * maxStep;
}
