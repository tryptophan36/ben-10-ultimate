export const LOOPING_ANIMATIONS = [
  "FA_Idle",
  "FA_Walk",
  "FA_Run",
  "CB_Idle",
  "CB_Roll",
] as const;

export const ONE_SHOT_ANIMATIONS = [
  "FA_Jump",
  "fa_punch_left",
  "fa_punch_right",
  "FA_HeavyPunch",
  "FA_Hit",
  "CB_Curl",
  "CB_Uncurl",
  "CB_Jump",
  "CB_BodySlam",
] as const;

export const DEFAULT_ANIMATION = "FA_Idle";

export const ANIMATION_HOTKEYS: Record<string, string> = {
  Digit1: "FA_Idle",
  Digit2: "FA_Walk",
  Digit3: "FA_Run",
  Digit4: "FA_Jump",
  Digit5: "fa_punch_left",
  Digit6: "FA_HeavyPunch",
  Digit7: "FA_Hit",
  Numpad1: "FA_Idle",
  Numpad2: "FA_Walk",
  Numpad3: "FA_Run",
  Numpad4: "FA_Jump",
  Numpad5: "fa_punch_left",
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
  { key: "5", animation: "fa_punch_left", label: "Punch" },
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
 * Punch clips are exported as "fa_punch_left" and "fa_punch_right".
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
