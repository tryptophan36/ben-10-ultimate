import { standardAttackHud } from "@/lib/game/characters/hud";
import type { CharacterDefinition } from "@/lib/game/characters/types";
import { fourArmsDriver } from "@/lib/game/characters/four-arms/driver";
import { fourArmsClips, fourArmsLocomotion } from "@/lib/game/characters/four-arms/locomotion";
import { fourArmsMoves } from "@/lib/game/characters/four-arms/moves";

export const fourArms: CharacterDefinition = {
  id: "four-arms",
  name: "Four Arms",
  defaultAnimation: fourArmsClips.idle,
  models: [{ id: "body", url: "/models/fourarms_game.glb" }],
  visibleModel: () => "body",
  clips: [
    { name: fourArmsClips.idle, loop: true, debugKeys: ["Digit1", "Numpad1"] },
    { name: fourArmsClips.walk, loop: true, debugKeys: ["Digit2", "Numpad2"] },
    { name: fourArmsClips.run, loop: true, debugKeys: ["Digit3", "Numpad3"] },
    { name: fourArmsClips.jump, loop: false, debugKeys: ["Digit4", "Numpad4"] },
    { name: fourArmsClips.punchLeft, loop: false, debugKeys: ["Digit5", "Numpad5"] },
    { name: fourArmsClips.punchRight, loop: false },
    { name: fourArmsClips.heavyPunch, loop: false, debugKeys: ["Digit6", "Numpad6"] },
    { name: fourArmsClips.hit, loop: false, debugKeys: ["Digit7", "Numpad7"] },
  ],
  locomotion: fourArmsLocomotion,
  driver: fourArmsDriver,
  input: {
    exclusiveSlots: false,
    bufferSlotsDuringAttack: true,
    bufferOnClipEnd: true,
  },
  moves: fourArmsMoves,
  hud: {
    movementLabel: "Movement",
    formatMovement: (state) => state,
    formatGrounded: (grounded) => (grounded ? "yes" : "no"),
    showTargetsHit: false,
    attackHud: standardAttackHud,
  },
};
