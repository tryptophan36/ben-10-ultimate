export const PHYSICS_TIMESTEP = 1 / 60;

export const GRAVITY = -20;

export const physicsGroups = {
  stage: 0,
  fighter: 1,
  hurtbox: 2,
  hitbox: 3,
} as const;
