import { cannonbolt } from "@/lib/game/characters/cannonbolt";
import { diamondhead } from "@/lib/game/characters/diamondhead";
import { fourArms } from "@/lib/game/characters/four-arms";
import {
  characterIds,
  type CharacterDefinition,
  type CharacterId,
} from "@/lib/game/characters/types";

export {
  characterIds,
  type AttackHudInput,
  type AttackHudRows,
  type CharacterDefinition,
  type CharacterHud,
  type CharacterId,
  type CharacterInputPolicy,
  type CharacterVisual,
  type ClipDef,
  type ClipFinish,
  type FighterView,
  type LocomotionDriver,
  type LocomotionSample,
  type ModelSlot,
  type PlaybackSync,
} from "@/lib/game/characters/types";

/**
 * Add an alien by creating lib/game/characters/<id>/ and listing it here.
 * The folder owns clips, locomotion, the walk driver, and moves.
 * Dash, launch, and rooted moves need no controller changes.
 * A new kind of body motion is one MoveMotion variant, shared by later aliens.
 */
export const characters: Record<CharacterId, CharacterDefinition> = {
  "four-arms": fourArms,
  cannonbolt,
  diamondhead,
};

export function controlHint(character: CharacterDefinition): { light: string; heavy: string } {
  return {
    light: character.moves.find((move) => move.slot === "light")?.slotLabel ?? "light",
    heavy: character.moves.find((move) => move.slot === "heavy")?.slotLabel ?? "heavy",
  };
}

export function isCharacterId(value: string | null): value is CharacterId {
  return characterIds.some((id) => id === value);
}

/** The next alien in the roster. Versus-computer uses this body. */
export function opponentOf(id: CharacterId): CharacterId {
  const index = characterIds.indexOf(id);
  return characterIds[(index + 1) % characterIds.length] ?? id;
}
