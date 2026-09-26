export const LOOPING_ANIMATIONS = ["FA_Idle", "FA_Walk", "FA_Run"] as const;

export const ONE_SHOT_ANIMATIONS = [
  "FA_Jump",
  "FA_Punch",
  "FA_HeavyPunch",
  "FA_Hit",
] as const;

export const DEFAULT_ANIMATION = "FA_Idle";

export const ANIMATION_HOTKEYS: Record<string, string> = {
  Digit1: "FA_Idle",
  Digit2: "FA_Walk",
  Digit3: "FA_Run",
  Digit4: "FA_Jump",
  Digit5: "FA_Punch",
  Digit6: "FA_HeavyPunch",
  Digit7: "FA_Hit",
  Numpad1: "FA_Idle",
  Numpad2: "FA_Walk",
  Numpad3: "FA_Run",
  Numpad4: "FA_Jump",
  Numpad5: "FA_Punch",
  Numpad6: "FA_HeavyPunch",
  Numpad7: "FA_Hit",
};

export const ANIMATION_HOTKEY_LABELS: {
  key: string;
  animation: string;
  label: string;
}[] = [
  { key: "1", animation: "FA_Idle", label: "Idle" },
  { key: "2", animation: "FA_Walk", label: "Walk" },
  { key: "3", animation: "FA_Run", label: "Run" },
  { key: "4", animation: "FA_Jump", label: "Jump" },
  { key: "5", animation: "FA_Punch", label: "Punch" },
  { key: "6", animation: "FA_HeavyPunch", label: "Heavy" },
  { key: "7", animation: "FA_Hit", label: "Hit" },
];

const loopingNames = new Set<string>(
  LOOPING_ANIMATIONS.map((name) => name.toLowerCase()),
);

const oneShotNames = new Set<string>(
  ONE_SHOT_ANIMATIONS.map((name) => name.toLowerCase()),
);

export function isLoopingAnimation(name: string): boolean {
  return loopingNames.has(name.toLowerCase());
}

export function isOneShotAnimation(name: string): boolean {
  return oneShotNames.has(name.toLowerCase());
}

export function sameAnimationName(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

/**
 * Match a requested clip against the names actually stored in the GLB.
 * The Four Arms file exports the punch clip as "FA_PUNCH".
 */
export function resolveAnimationName(
  requested: string,
  available: readonly string[],
): string {
  const exact = available.find((name) => name === requested);
  if (exact) {
    return exact;
  }

  const folded = requested.toLowerCase();
  return (
    available.find((name) => name.toLowerCase() === folded) ?? requested
  );
}
