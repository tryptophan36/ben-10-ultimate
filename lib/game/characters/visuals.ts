import { cannonboltVisual } from "@/lib/game/characters/cannonbolt/presentation";
import type { CharacterId, CharacterVisual } from "@/lib/game/characters/types";

/** Aliens that need a material fix, a mesh swap rate, or any other playback hook. */
export const characterVisuals: Partial<Record<CharacterId, CharacterVisual>> = {
  cannonbolt: cannonboltVisual,
};
