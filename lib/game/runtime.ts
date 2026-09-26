import { Vector3 } from "three";
import type { MovementState } from "@/lib/game/locomotion";

export const playerFocus = {
  feet: new Vector3(),
  yaw: 0,
  attack: null as string | null,
};

export type ControllerDebug = {
  movementState: MovementState;
  grounded: boolean;
  speed: number;
};

const initialDebug: ControllerDebug = {
  movementState: "idle",
  grounded: true,
  speed: 0,
};

let debugSnapshot: ControllerDebug = initialDebug;
let lastSpeedPublish = 0;
const listeners = new Set<() => void>();

export function subscribeControllerDebug(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getControllerDebug(): ControllerDebug {
  return debugSnapshot;
}

export function publishControllerDebug(next: ControllerDebug, now: number): void {
  const stateChanged =
    next.movementState !== debugSnapshot.movementState ||
    next.grounded !== debugSnapshot.grounded;
  const speedChanged = Math.abs(next.speed - debugSnapshot.speed) >= 0.05;
  if (!stateChanged && !speedChanged) {
    return;
  }
  if (!stateChanged && now - lastSpeedPublish < 100) {
    return;
  }

  lastSpeedPublish = now;
  debugSnapshot = {
    movementState: next.movementState,
    grounded: next.grounded,
    speed: Math.round(next.speed * 100) / 100,
  };
  for (const listener of listeners) {
    listener();
  }
}
