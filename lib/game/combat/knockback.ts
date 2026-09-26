import type { Knockback } from "@/lib/game/combat/types";

export type KnockbackVelocity = {
  x: number;
  y: number;
  z: number;
};

/**
 * Velocity along the attacker's facing. The sign flips when the target is
 * behind that facing, so the shove still carries them away from the attacker.
 * Yaw 0 points toward +Z, matching the character controller.
 */
export function knockbackVelocity(
  facingYaw: number,
  knockback: Knockback,
  targetX: number,
  targetZ: number,
  attackerX: number,
  attackerZ: number,
): KnockbackVelocity {
  let x = Math.sin(facingYaw);
  let z = Math.cos(facingYaw);
  const awayX = targetX - attackerX;
  const awayZ = targetZ - attackerZ;
  if (awayX * x + awayZ * z < 0) {
    x = -x;
    z = -z;
  }
  return {
    x: x * knockback.horizontal,
    y: knockback.vertical,
    z: z * knockback.horizontal,
  };
}
