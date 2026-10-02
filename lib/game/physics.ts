export const PHYSICS_TIMESTEP = 1 / 60;

export const GRAVITY = -20;

export const physicsGroups = {
  stage: 0,
  fighter: 1,
  hurtbox: 2,
  hitbox: 3,
} as const;

/**
 * Hitboxes and hurtboxes both sit on kinematic bodies. Rapier's default pair
 * set skips kinematic-against-kinematic, so a punch never reaches a fighter.
 * Bits are ActiveCollisionTypes.DEFAULT | KINEMATIC_KINEMATIC in Rapier 0.19.
 */
export const HIT_COLLISION_TYPES = 15 | 52224;
