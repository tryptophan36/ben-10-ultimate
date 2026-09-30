import { ATTACK_PHASE } from "@/lib/game/combat/types";
import { bodySlamPhaseLabel } from "@/lib/game/characters/hud";
import type { AttackHudRows, CharacterDefinition } from "@/lib/game/characters/types";
import { cannonboltDriver } from "@/lib/game/characters/cannonbolt/driver";
import { CANNONBOLT_CLIPS } from "@/lib/game/characters/cannonbolt/form";
import { cannonboltLocomotion } from "@/lib/game/characters/cannonbolt/locomotion";
import { cannonboltMoves } from "@/lib/game/characters/cannonbolt/moves";

const BODY_SLAM_ID = "CB_BodySlam";

export const cannonbolt: CharacterDefinition = {
  id: "cannonbolt",
  name: "Cannonbolt",
  defaultAnimation: CANNONBOLT_CLIPS.idle,
  models: [
    { id: "standing", url: "/models/cannonbolt/cannonbolt-standing.glb" },
    { id: "ball", url: "/models/cannonbolt/cannonbolt-ball.glb" },
  ],
  visibleModel: (form) => (form === "rolling" ? "ball" : "standing"),
  clips: [
    { name: CANNONBOLT_CLIPS.idle, loop: true, debugKeys: ["Digit1", "Numpad1"] },
    { name: CANNONBOLT_CLIPS.roll, loop: true, debugKeys: ["Digit2", "Numpad2"] },
    { name: CANNONBOLT_CLIPS.curl, loop: false, debugKeys: ["Digit3", "Numpad3"] },
    { name: CANNONBOLT_CLIPS.uncurl, loop: false },
    { name: CANNONBOLT_CLIPS.jump, loop: false, debugKeys: ["Digit4", "Numpad4"] },
    { name: CANNONBOLT_CLIPS.bodySlam, loop: false, debugKeys: ["Digit5", "Numpad5"] },
  ],
  locomotion: cannonboltLocomotion,
  driver: cannonboltDriver,
  input: {
    exclusiveSlots: true,
    bufferSlotsDuringAttack: false,
    bufferOnClipEnd: false,
  },
  moves: cannonboltMoves,
  hud: {
    movementLabel: "State",
    formatMovement: (state) => state.replace("CANNONBOLT_", ""),
    formatGrounded: (grounded) => String(grounded),
    showTargetsHit: true,
    attackHud(input): AttackHudRows {
      if (input.attackId === BODY_SLAM_ID) {
        return {
          phaseTitle: "Phase",
          phaseLabel: bodySlamPhaseLabel(input.phase),
          attackTitle: "Attack",
          hitboxTitle: "Hitbox",
          hitboxLabel: input.phase === ATTACK_PHASE.active ? "ACTIVE" : "OFF",
        };
      }
      return {
        phaseTitle: "Attack",
        phaseLabel: input.phase,
        attackTitle: "Attack name",
        hitboxTitle: "Hitboxes",
        hitboxLabel: input.phase === ATTACK_PHASE.active ? "active" : "inactive",
      };
    },
  },
};
