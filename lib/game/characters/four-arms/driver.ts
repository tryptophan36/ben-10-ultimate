import { sameAnimationName } from "@/lib/game/animations";
import type { ClipFinish, LocomotionDriver, LocomotionSample } from "@/lib/game/characters/types";
import {
  animationForMovement,
  selectMovementState,
} from "@/lib/game/locomotion";
import { fourArmsLocomotion } from "@/lib/game/characters/four-arms/locomotion";

const FORM = "default";

function movement(sample: LocomotionSample) {
  return selectMovementState(fourArmsLocomotion, sample);
}

export const fourArmsDriver: LocomotionDriver = {
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
      animation: animationForMovement(fourArmsLocomotion, state),
      movementState: state,
    };
  },
  onClipFinished(clipName, sample): ClipFinish | undefined {
    if (!sameAnimationName(clipName, fourArmsLocomotion.animations.jump)) {
      return undefined;
    }
    if (!sample.grounded) {
      return { kind: "stay" };
    }
    const state = movement(sample);
    return {
      kind: "goto",
      form: FORM,
      animation: animationForMovement(fourArmsLocomotion, state),
    };
  },
};
