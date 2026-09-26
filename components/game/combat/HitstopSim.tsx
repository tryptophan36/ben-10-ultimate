"use client";

import { useBeforePhysicsStep } from "@react-three/rapier";
import { pinHitstopHolds } from "@/lib/game/combat/hitstop";

export function HitstopSim() {
  useBeforePhysicsStep(() => {
    pinHitstopHolds();
  });

  return null;
}
