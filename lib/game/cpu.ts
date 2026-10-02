import type { GameInputState } from "@/components/game/useGameInput";

const CHASE_DISTANCE = 2.35;
const BACK_OFF_DISTANCE = 1.15;
const ATTACK_DISTANCE = 2.5;

export type CpuMemory = {
  nextActAt: number;
  strafe: number;
};

export type CpuBody = {
  x: number;
  z: number;
  attacking: boolean;
  hitstun: boolean;
  defeated: boolean;
};

export const matchFlags = {
  playerDown: false,
  opponentDown: false,
};

export function resetMatchFlags(): void {
  matchFlags.playerDown = false;
  matchFlags.opponentDown = false;
}

export function createCpuMemory(): CpuMemory {
  return { nextActAt: 0, strafe: 0.7 };
}

function clearStick(input: GameInputState): void {
  input.forward = 0;
  input.strafe = 0;
  input.run = false;
  input.jump = false;
  input.light = false;
  input.heavy = false;
  input.worldX = null;
  input.worldZ = null;
  input.aimX = null;
  input.aimZ = null;
}

/**
 * Writes one frame of movement and attacks for the computer fighter.
 * Closing in, circling, and swinging are the whole policy.
 */
export function writeCpuInput(
  input: GameInputState,
  memory: CpuMemory,
  self: CpuBody,
  player: { x: number; z: number },
  now: number,
): void {
  clearStick(input);

  let dx = player.x - self.x;
  let dz = player.z - self.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.05) {
    dx = 0;
    dz = 1;
  } else {
    dx /= distance;
    dz /= distance;
  }

  input.aimX = dx;
  input.aimZ = dz;

  if (self.defeated || self.hitstun || matchFlags.playerDown) {
    return;
  }

  if (distance > CHASE_DISTANCE) {
    input.worldX = dx;
    input.worldZ = dz;
    input.run = true;
  } else if (distance < BACK_OFF_DISTANCE) {
    input.worldX = -dx;
    input.worldZ = -dz;
    input.run = false;
  } else {
    input.worldX = dz * memory.strafe;
    input.worldZ = -dx * memory.strafe;
    input.run = false;
  }

  if (self.attacking || distance > ATTACK_DISTANCE || now < memory.nextActAt) {
    return;
  }

  memory.nextActAt = now + 420 + Math.random() * 480;
  memory.strafe = Math.random() < 0.5 ? -0.75 : 0.75;
  if (Math.random() < 0.68) {
    input.light = true;
  } else {
    input.heavy = true;
  }
}
