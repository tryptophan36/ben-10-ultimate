import { Mesh, MeshStandardMaterial, type Material } from "three";
import type { CharacterVisual } from "@/lib/game/characters/types";
import { CANNONBOLT_CLIPS } from "@/lib/game/characters/cannonbolt/form";

/** CB_Curl is 0.48s. Faster than authored so the tuck does not hold him in place. */
const CURL_TIME_SCALE = 1.5;
/** Ball mesh radius in the GLB, after the node offset that sits it on y = 0. */
const BALL_RADIUS = 1;

/** One CB_Roll cycle is one revolution. Match it to distance traveled on the ground. */
export function cannonboltRollTimeScale(speed: number, clipDuration: number): number {
  const circumference = Math.PI * 2 * BALL_RADIUS;
  if (speed <= 0.08 || clipDuration <= 0) {
    return 0;
  }
  return Math.min(2.5, (speed / circumference) * clipDuration);
}

function showPaintedColor(material: Material): Material {
  if (!(material instanceof MeshStandardMaterial) || material.userData.cannonboltPainted) {
    return material;
  }
  const painted = material.clone();
  // The GLB is nearly fully metallic, so the grey body reflects an empty
  // environment and reads as black. The paint lives in the base-color texture.
  painted.metalness = 0;
  painted.roughness = 0.55;
  painted.userData.cannonboltPainted = true;
  return painted;
}

export const cannonboltVisual: CharacterVisual = {
  prepareModel(model) {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    model.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return;
      }
      const source = Array.isArray(object.material) ? object.material : [object.material];
      const tuned = source.map(showPaintedColor);
      object.material = Array.isArray(object.material) ? tuned : tuned[0];
    });
  },
  syncPlayback({ form, speed, actions }) {
    const curl = actions("standing")?.[CANNONBOLT_CLIPS.curl];
    if (curl && form !== "rolling") {
      curl.setEffectiveTimeScale(CURL_TIME_SCALE);
    }
    const roll = actions("ball")?.[CANNONBOLT_CLIPS.roll];
    if (!roll) {
      return;
    }
    const showBall = form === "rolling";
    roll.setEffectiveTimeScale(
      showBall ? cannonboltRollTimeScale(speed, roll.getClip().duration) : 0,
    );
  },
};
