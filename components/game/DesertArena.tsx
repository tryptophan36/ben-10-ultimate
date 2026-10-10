"use client";

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { CuboidCollider, interactionGroups, RigidBody } from "@react-three/rapier";
import type { Object3D } from "three";
import {
  prepareArenaVisual,
  readDesertArena,
  type DesertArenaLayout,
} from "@/lib/game/arena/desert";
import { arenas } from "@/lib/game/matchSetup";
import { physicsGroups } from "@/lib/game/physics";

const gltfLoaderOptions = [false, false] as const;

const STAGE_COLLISION_GROUPS = interactionGroups(
  [physicsGroups.stage],
  [physicsGroups.fighter],
);

export type LoadedArena = DesertArenaLayout & {
  visual: Object3D;
};

export function useArena(modelPath: string): LoadedArena {
  const gltf = useGLTF(modelPath, ...gltfLoaderOptions);
  const layout = useMemo(() => readDesertArena(gltf.scene), [gltf.scene]);
  const visual = useMemo(() => prepareArenaVisual(gltf.scene), [gltf.scene]);
  return useMemo(
    () => ({
      colliders: layout.colliders,
      spawns: layout.spawns,
      visual,
    }),
    [layout, visual],
  );
}

export function ArenaStage({ arena, name }: { arena: LoadedArena; name: string }) {
  return (
    <>
      <primitive object={arena.visual} dispose={null} />
      <RigidBody type="fixed" colliders={false} name={`${name}-arena`}>
        {arena.colliders.map((collider) => (
          <CuboidCollider
            key={collider.name}
            args={collider.halfExtents}
            position={collider.position}
            quaternion={collider.quaternion}
            collisionGroups={STAGE_COLLISION_GROUPS}
            friction={1}
            restitution={0}
          />
        ))}
      </RigidBody>
    </>
  );
}

if (typeof window !== "undefined") {
  for (const arena of arenas) {
    useGLTF.preload(arena.modelPath, ...gltfLoaderOptions);
  }
}
