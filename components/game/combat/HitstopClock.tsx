"use client";

import { useFrame } from "@react-three/fiber";
import { stepHitstop } from "@/lib/game/combat/hitstop";

/**
 * Negative priority runs before physics and the animation mixer.
 * A positive priority would also turn off R3F's automatic render.
 */
const HITSTOP_FRAME_PRIORITY = -1000;

export function HitstopClock() {
  useFrame((_, delta) => {
    stepHitstop(delta);
  }, HITSTOP_FRAME_PRIORITY);

  return null;
}
