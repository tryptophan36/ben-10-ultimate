import { standardAttackHud } from "@/lib/game/characters/hud";
import type { AttackHudRows, CharacterDefinition } from "@/lib/game/characters/types";
import { diamondheadDriver } from "@/lib/game/characters/diamondhead/driver";
import { diamondheadClips, diamondheadLocomotion } from "@/lib/game/characters/diamondhead/locomotion";
import { diamondheadMoves } from "@/lib/game/characters/diamondhead/moves";
import { ATTACK_PHASE } from "@/lib/game/combat/types";

export const diamondhead: CharacterDefinition = {
  id: "diamondhead",
  name: "Diamondhead",
  defaultAnimation: diamondheadClips.idle,
  models: [{ id: "body", url: "/models/diamondhead/diamondhead.glb" }],
  visibleModel: () => "body",
  clips: [
    { name: diamondheadClips.idle, loop: true, debugKeys: ["Digit1", "Numpad1"] },
    { name: diamondheadClips.walk, loop: true, debugKeys: ["Digit2", "Numpad2"] },
    { name: diamondheadClips.run, loop: true, debugKeys: ["Digit3", "Numpad3"] },
    { name: diamondheadClips.jump, loop: false, debugKeys: ["Digit4", "Numpad4"] },
    { name: diamondheadClips.crystalPunch, loop: false, debugKeys: ["Digit5", "Numpad5"] },
    { name: diamondheadClips.shardShot, loop: false, debugKeys: ["Digit6", "Numpad6"] },
  ],
  locomotion: diamondheadLocomotion,
  driver: diamondheadDriver,
  input: {
    exclusiveSlots: false,
    bufferSlotsDuringAttack: true,
    bufferOnClipEnd: true,
  },
  moves: diamondheadMoves,
  hud: {
    movementLabel: "Movement",
    formatMovement: (state) => state,
    formatGrounded: (grounded) => (grounded ? "yes" : "no"),
    showTargetsHit: false,
    attackHud(input): AttackHudRows {
      if (input.attackId === "DH_SHARD_SHOT") {
        const label =
          input.phase === ATTACK_PHASE.active
            ? "launch"
            : input.phase === ATTACK_PHASE.startup
              ? "charge"
              : "off";
        return {
          phaseTitle: "Attack",
          phaseLabel: input.phase,
          attackTitle: "Attack name",
          hitboxTitle: "Shard",
          hitboxLabel: label,
        };
      }
      return standardAttackHud(input);
    },
  },
};
