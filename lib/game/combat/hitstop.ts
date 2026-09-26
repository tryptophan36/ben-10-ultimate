import type { AnimationMixer } from "three";

type HitstopHold = {
  pin: () => void;
  release: () => void;
};

type HitstopSnapshot = {
  active: boolean;
};

const SERVER_SNAPSHOT: HitstopSnapshot = { active: false };

let remaining = 0;
let snapshot: HitstopSnapshot = SERVER_SNAPSHOT;
let mixer: AnimationMixer | null = null;
const holds: HitstopHold[] = [];
const listeners = new Set<() => void>();

function applyMixerScale(): void {
  if (!mixer) {
    return;
  }
  mixer.timeScale = remaining > 0 ? 0 : 1;
}

function publish(): void {
  const active = remaining > 0;
  if (snapshot.active === active) {
    return;
  }
  snapshot = { active };
  for (const listener of listeners) {
    listener();
  }
}

function releaseHolds(): void {
  const pending = holds.splice(0, holds.length);
  for (const hold of pending) {
    hold.release();
  }
}

export function isHitstopActive(): boolean {
  return remaining > 0;
}

export function getHitstopSnapshot(): HitstopSnapshot {
  return snapshot;
}

export function getHitstopServerSnapshot(): HitstopSnapshot {
  return SERVER_SNAPSHOT;
}

export function subscribeHitstop(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Freeze gameplay for `durationMs`. A longer request extends the freeze.
 * A shorter or equal one is ignored, so overlapping hits cannot add together.
 */
export function triggerHitstop(durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return;
  }
  const seconds = durationMs / 1000;
  if (seconds <= remaining) {
    return;
  }
  remaining = seconds;
  applyMixerScale();
  publish();
}

/** Step the single hitstop clock from the render loop. Not a timer. */
export function stepHitstop(deltaSeconds: number): void {
  if (remaining <= 0) {
    return;
  }
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return;
  }
  remaining -= Math.min(deltaSeconds, 0.25);
  if (remaining > 0) {
    return;
  }
  remaining = 0;
  applyMixerScale();
  releaseHolds();
  publish();
}

/**
 * Keep a body still until the freeze ends, then run `release` once.
 * If no freeze is active, `release` runs immediately.
 */
export function holdForHitstop(hold: HitstopHold): void {
  if (remaining <= 0) {
    hold.release();
    return;
  }
  holds.push(hold);
}

export function pinHitstopHolds(): void {
  if (remaining <= 0) {
    return;
  }
  for (const hold of holds) {
    hold.pin();
  }
}

export function bindHitstopMixer(next: AnimationMixer | null): void {
  if (mixer && mixer !== next) {
    mixer.timeScale = 1;
  }
  mixer = next;
  applyMixerScale();
}

export function resetHitstop(): void {
  remaining = 0;
  holds.length = 0;
  applyMixerScale();
  publish();
}
