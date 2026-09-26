"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import {
  CapsuleCollider,
  interactionGroups,
  RigidBody,
  type RapierCollider,
  type RapierRigidBody,
} from "@react-three/rapier";
import { Group, Mesh } from "three";
import { clone as cloneSkinnedScene } from "three/addons/utils/SkeletonUtils.js";
import { AttackHitboxes } from "@/components/game/combat/AttackHitboxes";
import { useAnimationController } from "@/components/game/useAnimationController";
import { useCharacterController } from "@/components/game/useCharacterController";
import { characters } from "@/lib/game/characters";
import { spawnHeight, visualDrop } from "@/lib/game/locomotion";
import { physicsGroups } from "@/lib/game/physics";
import { useAppSelector } from "@/store/hooks";

const gltfLoaderOptions = [false, false] as const;
const LOCKED_ROTATIONS: [boolean, boolean, boolean] = [false, false, false];
const FIGHTER_COLLISION_GROUPS = interactionGroups(
  [physicsGroups.fighter],
  [physicsGroups.stage, physicsGroups.fighter],
);

export function Player() {
  const selectedCharacter = useAppSelector((state) => state.game.selectedCharacter);
  const character = characters[selectedCharacter];
  const locomotion = character.locomotion;
  const { scene, animations } = useGLTF(
    character.modelUrl,
    ...gltfLoaderOptions,
  );
  const model = useMemo(() => cloneSkinnedScene(scene), [scene]);
  const { actions, mixer, names } = useAnimations(animations, model);
  const bodyRef = useRef<RapierRigidBody>(null);
  const colliderRef = useRef<RapierCollider>(null);
  const visualRef = useRef<Group>(null);
  const spawnPosition = useMemo<[number, number, number]>(
    () => [0, spawnHeight(locomotion), 0],
    [locomotion],
  );
  const visualPosition = useMemo<[number, number, number]>(
    () => [0, visualDrop(locomotion), 0],
    [locomotion],
  );
  const capsuleArgs = useMemo<[number, number]>(
    () => [locomotion.capsuleHalfHeight, locomotion.capsuleRadius],
    [locomotion],
  );

  const { onOneShotFinished } = useCharacterController({
    bodyRef,
    colliderRef,
    visualRef,
    config: locomotion,
    attackerId: character.id,
  });

  useLayoutEffect(() => {
    model.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        object.frustumCulled = false;
      }
    });
  }, [model]);

  useAnimationController({ actions, mixer, names, onOneShotFinished });

  return (
    <>
      <RigidBody
        ref={bodyRef}
        name={character.id}
        type="kinematicPosition"
        colliders={false}
        position={spawnPosition}
        enabledRotations={LOCKED_ROTATIONS}
        canSleep={false}
        ccd
        gravityScale={0}
      >
        <CapsuleCollider
          ref={colliderRef}
          args={capsuleArgs}
          collisionGroups={FIGHTER_COLLISION_GROUPS}
          friction={0}
          restitution={0}
        />
        <group ref={visualRef} name="character-visual" position={visualPosition}>
          <primitive object={model} dispose={null} />
        </group>
      </RigidBody>
      <AttackHitboxes
        characterId={character.id}
        model={model}
        visualRef={visualRef}
      />
    </>
  );
}

if (typeof window !== "undefined") {
  for (const character of Object.values(characters)) {
    useGLTF.preload(character.modelUrl, ...gltfLoaderOptions);
  }
}
