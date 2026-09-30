"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import {
  CapsuleCollider,
  interactionGroups,
  RigidBody,
  type RapierCollider,
  type RapierRigidBody,
} from "@react-three/rapier";
import { Group, Mesh, type AnimationClip, type Object3D } from "three";
import { clone as cloneSkinnedScene } from "three/addons/utils/SkeletonUtils.js";
import { AttackHitboxes } from "@/components/game/combat/AttackHitboxes";
import {
  useAnimationController,
  type AnimationLibrary,
} from "@/components/game/useAnimationController";
import { useCharacterController } from "@/components/game/useCharacterController";
import { characters, type CharacterId, type FighterView } from "@/lib/game/characters";
import { characterVisuals } from "@/lib/game/characters/visuals";
import { ATTACK_PHASE } from "@/lib/game/combat/types";
import { spawnHeight, visualDrop } from "@/lib/game/locomotion";
import { physicsGroups } from "@/lib/game/physics";
import { useAppDispatch } from "@/store/hooks";
import { setAttackState } from "@/store/slices/combatSlice";

const gltfLoaderOptions = [false, false] as const;
const LOCKED_ROTATIONS: [boolean, boolean, boolean] = [false, false, false];
const FIGHTER_COLLISION_GROUPS = interactionGroups(
  [physicsGroups.fighter],
  [physicsGroups.stage, physicsGroups.fighter],
);

type LoadedModel = {
  scene: Object3D;
  animations: AnimationClip[];
};

const EMPTY_CLIPS: AnimationClip[] = [];

function shadeModel(model: Object3D) {
  model.traverse((object) => {
    if (object instanceof Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = false;
    }
  });
}

export function Fighter({ characterId }: { characterId: CharacterId }) {
  const dispatch = useAppDispatch();
  const character = characters[characterId];
  const visual = characterVisuals[characterId];
  const locomotion = character.locomotion;
  const urls = useMemo(() => character.models.map((model) => model.url), [character]);
  const loaded = useGLTF(urls, ...gltfLoaderOptions) as LoadedModel | LoadedModel[];
  const gltfs = Array.isArray(loaded) ? loaded : [loaded];
  const primarySource = gltfs[0]?.scene;
  const secondarySource = gltfs[1]?.scene;
  const scenes = useMemo(() => {
    const clones = [cloneSkinnedScene(primarySource)];
    if (secondarySource) {
      clones.push(cloneSkinnedScene(secondarySource));
    }
    return clones;
  }, [primarySource, secondarySource]);
  const emptyRoot = useMemo(() => new Group(), []);
  const primaryClips = gltfs[0]?.animations ?? EMPTY_CLIPS;
  const secondaryClips = gltfs[1]?.animations ?? EMPTY_CLIPS;
  const primaryAnim = useAnimations(primaryClips, scenes[0] ?? emptyRoot);
  const secondaryAnim = useAnimations(secondaryClips, scenes[1] ?? emptyRoot);
  const modelCount = character.models.length;
  const libraries = useMemo(() => {
    const next: AnimationLibrary[] = [
      {
        actions: primaryAnim.actions,
        mixer: primaryAnim.mixer,
        names: primaryAnim.names,
      },
    ];
    if (modelCount > 1) {
      next.push({
        actions: secondaryAnim.actions,
        mixer: secondaryAnim.mixer,
        names: secondaryAnim.names,
      });
    }
    return next;
  }, [
    modelCount,
    primaryAnim.actions,
    primaryAnim.mixer,
    primaryAnim.names,
    secondaryAnim.actions,
    secondaryAnim.mixer,
    secondaryAnim.names,
  ]);
  const bodyRef = useRef<RapierRigidBody>(null);
  const colliderRef = useRef<RapierCollider>(null);
  const visualRef = useRef<Group>(null);
  const viewRef = useRef<FighterView>({
    form: character.driver.initialForm,
    speed: 0,
  });
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
    viewRef,
    character,
  });

  useLayoutEffect(() => {
    const visibleId = character.visibleModel(character.driver.initialForm);
    scenes.forEach((scene, index) => {
      shadeModel(scene);
      const slotId = character.models[index]?.id ?? "";
      visual?.prepareModel?.(scene, slotId);
      scene.visible = slotId === visibleId;
    });
  }, [character, scenes, visual]);

  useAnimationController({ libraries, onOneShotFinished });

  useEffect(() => {
    dispatch(
      setAttackState({
        attackId: null,
        phase: ATTACK_PHASE.idle,
        activeFrames: 0,
      }),
    );
  }, [character, dispatch]);

  useFrame(() => {
    const view = viewRef.current;
    const visibleId = character.visibleModel(view.form);
    scenes.forEach((scene, index) => {
      scene.visible = character.models[index]?.id === visibleId;
    });
    visual?.syncPlayback?.({
      form: view.form,
      speed: view.speed,
      actions: (slotId) => {
        const index = character.models.findIndex((model) => model.id === slotId);
        return index === 1 ? secondaryAnim.actions : primaryAnim.actions;
      },
    });
  }, -1);

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
          {scenes.map((scene, index) => (
            <primitive
              key={character.models[index]?.id ?? index}
              object={scene}
              dispose={null}
            />
          ))}
        </group>
      </RigidBody>
      {scenes.map((scene, index) => (
        <AttackHitboxes
          key={character.models[index]?.id ?? index}
          characterId={character.id}
          model={scene}
          visualRef={visualRef}
        />
      ))}
    </>
  );
}

if (typeof window !== "undefined") {
  for (const character of Object.values(characters)) {
    for (const model of character.models) {
      useGLTF.preload(model.url, ...gltfLoaderOptions);
    }
  }
}
