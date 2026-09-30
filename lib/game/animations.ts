import type { ClipDef } from "@/lib/game/characters/types";

export function isLoopingAnimation(clips: readonly ClipDef[], name: string): boolean {
  const folded = name.toLowerCase();
  return clips.some((clip) => clip.loop && clip.name.toLowerCase() === folded);
}

export function isOneShotAnimation(clips: readonly ClipDef[], name: string): boolean {
  const folded = name.toLowerCase();
  return clips.some((clip) => !clip.loop && clip.name.toLowerCase() === folded);
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
  return available.find((name) => name.toLowerCase() === folded) ?? requested;
}
