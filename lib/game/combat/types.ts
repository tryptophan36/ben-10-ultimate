import type { CameraShakeSpec } from "@/lib/game/camera/cameraShake";

export const ATTACK_PHASE = {
  idle: "IDLE",
  startup: "ATTACK_STARTUP",
  active: "ATTACK_ACTIVE",
  recovery: "ATTACK_RECOVERY",
} as const;

export type AttackPhase = (typeof ATTACK_PHASE)[keyof typeof ATTACK_PHASE];

export type Knockback = {
  /** Speed away from the attacker along their facing, in meters per second. */
  horizontal: number;
  /** Upward speed applied with the shove, in meters per second. */
  vertical: number;
};

export type MeleeHitbox = {
  bone: string;
  radius: number;
  /** Bone-local meters. Shifts the sphere from the joint onto the fist. */
  offset?: readonly [number, number, number];
};

/**
 * Data for one melee attack. Frame counts are physics steps (60 Hz).
 * Later moves (projectiles, grabs, blocks) can sit beside this type
 * without changing how damage or phases are applied.
 */
export type AttackDefinition = {
  id: string;
  characterId: string;
  kind: "melee";
  animation: string;
  damage: number;
  startup: number;
  active: number;
  recovery: number;
  knockback: Knockback;
  /** Gameplay freeze on a clean hit, in milliseconds. */
  hitstopMs: number;
  cameraShake: CameraShakeSpec;
  /** Size of the impact burst. 1 is a standard punch. */
  impactScale: number;
  /** How long the target stays in hitstun, in seconds. */
  hitstun: number;
  /** Source clip length in seconds. Recovery fills whatever frames remain. */
  clipDuration: number;
  interruptible: boolean;
  multiHit: boolean;
  hitboxes: MeleeHitbox[];
  /**
   * clip follows the attack animation from frame 0.
   * elapsed counts physics frames from the moment the attack starts, so a
   * move can reuse a looping locomotion clip. Omitted attacks follow the clip.
   */
  clock?: "clip" | "elapsed";
};

export type DamageRequest = {
  amount: number;
  knockback: Knockback;
  hitstun: number;
  attacker: string;
  attackId: string;
  attackSerial: number;
  facingYaw: number;
  attackerX: number;
  attackerZ: number;
  hitX: number;
  hitY: number;
  hitZ: number;
  hitstopMs: number;
  cameraShake: CameraShakeSpec;
  impactScale: number;
};

export type Damageable = {
  id: string;
  takeDamage: (request: DamageRequest) => boolean;
};
