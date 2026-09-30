import type { LocomotionDriver } from "@/lib/game/characters/types";
import {
  advanceCannonboltPhase,
  animationForCannonboltPhase,
  asCannonboltPhase,
  cannonboltAfterClip,
  cannonboltHoldsPlanar,
  cannonboltStateForPhase,
} from "@/lib/game/characters/cannonbolt/form";

export const cannonboltDriver: LocomotionDriver = {
  initialForm: "standing",
  holdPlanar(sample) {
    return cannonboltHoldsPlanar(
      asCannonboltPhase(sample.form),
      sample.grounded,
      sample.hasMoveInput,
    );
  },
  label(sample) {
    return cannonboltStateForPhase(asCannonboltPhase(sample.form));
  },
  step(sample) {
    const form = advanceCannonboltPhase(asCannonboltPhase(sample.form), sample);
    return {
      form,
      animation: animationForCannonboltPhase(form),
      movementState: cannonboltStateForPhase(form),
    };
  },
  onClipFinished(clipName, sample) {
    return cannonboltAfterClip(asCannonboltPhase(sample.form), clipName, sample);
  },
};
