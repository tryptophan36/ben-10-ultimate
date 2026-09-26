"use client";

import { useSyncExternalStore } from "react";
import {
  getFeelDebug,
  getFeelDebugServerSnapshot,
  subscribeFeelDebug,
} from "@/lib/game/combat/feelDebug";
import { useAppSelector } from "@/store/hooks";

export function HitLocationMarker() {
  const showHitboxes = useAppSelector((state) => state.combat.showHitboxes);
  const feel = useSyncExternalStore(
    subscribeFeelDebug,
    getFeelDebug,
    getFeelDebugServerSnapshot,
  );

  if (!showHitboxes || feel.hitX === null || feel.hitY === null || feel.hitZ === null) {
    return null;
  }

  return (
    <mesh position={[feel.hitX, feel.hitY, feel.hitZ]} frustumCulled={false}>
      <sphereGeometry args={[0.07, 10, 8]} />
      <meshBasicMaterial color="#5ee7ff" wireframe toneMapped={false} />
    </mesh>
  );
}
