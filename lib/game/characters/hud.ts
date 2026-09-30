import { ATTACK_PHASE, type AttackPhase } from "@/lib/game/combat/types";
import type { AttackHudInput, AttackHudRows } from "@/lib/game/characters/types";

export function standardAttackHud(input: AttackHudInput): AttackHudRows {
  const live = input.phase === ATTACK_PHASE.active;
  return {
    phaseTitle: "Attack",
    phaseLabel: input.phase,
    attackTitle: "Attack name",
    hitboxTitle: "Hitboxes",
    hitboxLabel: live && input.showHitboxes ? "LIVE" : input.showHitboxes ? "armed" : "off",
  };
}

export function bodySlamPhaseLabel(phase: AttackPhase): string {
  switch (phase) {
    case ATTACK_PHASE.startup:
      return "STARTUP";
    case ATTACK_PHASE.airborne:
      return "AIRBORNE";
    case ATTACK_PHASE.active:
      return "IMPACT";
    case ATTACK_PHASE.recovery:
      return "RECOVERY";
    default:
      return "IDLE";
  }
}
