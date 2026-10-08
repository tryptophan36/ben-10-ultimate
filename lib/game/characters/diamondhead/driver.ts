import { sameAnimationName } from "@/lib/game/animations";
import type { ClipFinish, LocomotionDriver, LocomotionSample } from "@/lib/game/characters/types";
import { diamondheadLocomotion } from "@/lib/game/characters/diamondhead/locomotion";
import { animationForMovement, selectMovementState } from "@/lib/game/locomotion";

const FORM = "default";

function movement(sample: LocomotionSample) {
  return selectMovementState(diamondheadLocomotion, sample);
}

export const diamondheadDriver: LocomotionDriver = {
  initialForm: FORM,
  holdPlanar() {
    return false;
  },
  label(sample) {
    return movement(sample);
  },
  step(sample) {
    const state = movement(sample);
    return {
      form: FORM,
      animation: animationForMovement(diamondheadLocomotion, state),
      movementState: state,
    };
  },
  onClipFinished(clipName, sample): ClipFinish | undefined {
    if (!sameAnimationName(clipName, diamondheadLocomotion.animations.jump)) {
      return undefined;
    }
    if (!sample.grounded) {
      return { kind: "stay" };
    }
    const state = movement(sample);
    return {
      kind: "goto",
      form: FORM,
      animation: animationForMovement(diamondheadLocomotion, state),
    };
  },
};
