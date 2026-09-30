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
  };
};

export const sharedLocomotion = {
  jumpVelocity: 8.6,
  gravity: GRAVITY,
  maxFallSpeed: -28,
  groundProbeSpeed: 2,
  moveSpeedThreshold: 0.22,
  coyoteTime: 0.08,
  attackLockSeconds: 2.6,
} as const;

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
