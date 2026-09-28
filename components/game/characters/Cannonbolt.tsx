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
import {
  Mesh,
  MeshStandardMaterial,
  type AnimationAction,
  type Group,
  type Material,
  type Object3D,
} from "three";
import { clone as cloneSkinnedScene } from "three/addons/utils/SkeletonUtils.js";
import { AttackHitboxes } from "@/components/game/combat/AttackHitboxes";
import { useAnimationController } from "@/components/game/useAnimationController";
import { useCharacterController } from "@/components/game/useCharacterController";
import { characters } from "@/lib/game/characters";
import {
  CANNONBOLT_CLIPS,
  cannonboltRollTimeScale,
  cannonboltView,
} from "@/lib/game/cannonbolt";
import { spawnHeight, visualDrop } from "@/lib/game/locomotion";
import { physicsGroups } from "@/lib/game/physics";
import { ATTACK_PHASE } from "@/lib/game/combat/types";
import { useAppDispatch } from "@/store/hooks";
import { setAttackState } from "@/store/slices/combatSlice";

const gltfLoaderOptions = [false, false] as const;
/** CB_Curl is 0.48s. Slowing it gives the tuck time to read before the ball appears. */
const CURL_TIME_SCALE = 0.6;
const LOCKED_ROTATIONS: [boolean, boolean, boolean] = [false, false, false];
const FIGHTER_COLLISION_GROUPS = interactionGroups(
  [physicsGroups.fighter],
  [physicsGroups.stage, physicsGroups.fighter],
);

const character = characters.cannonbolt;
const STANDING_URL = character.modelUrl;
const BALL_URL = requireBallUrl(character.ballModelUrl);

function requireBallUrl(url: string | undefined): string {
  if (!url) {
    throw new Error("Cannonbolt ball model is not registered");
  }
  return url;
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

function prepareModel(model: Object3D) {
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  model.scale.set(1, 1, 1);
  model.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = false;
    const source = Array.isArray(object.material) ? object.material : [object.material];
    const tuned = source.map(showPaintedColor);
    object.material = Array.isArray(object.material) ? tuned : tuned[0];
  });
}

export function Cannonbolt() {
  const dispatch = useAppDispatch();
  const locomotion = character.locomotion;
  const standingGltf = useGLTF(STANDING_URL, ...gltfLoaderOptions);
  const ballGltf = useGLTF(BALL_URL, ...gltfLoaderOptions);
  const standing = useMemo(
    () => cloneSkinnedScene(standingGltf.scene),
    [standingGltf.scene],
  );
  const ball = useMemo(() => cloneSkinnedScene(ballGltf.scene), [ballGltf.scene]);
  const standingClips = useAnimations(standingGltf.animations, standing);
  const ballClips = useAnimations(ballGltf.animations, ball);
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
    prepareModel(standing);
    prepareModel(ball);
    standing.visible = true;
    ball.visible = false;
  }, [ball, standing]);

  useAnimationController({
    actions: standingClips.actions,
    mixer: standingClips.mixer,
    names: standingClips.names,
    onOneShotFinished,
    secondary: {
      actions: ballClips.actions,
      mixer: ballClips.mixer,
      names: ballClips.names,
    },
  });

  useEffect(() => {
    cannonboltView.form = "standing";
    cannonboltView.speed = 0;
    dispatch(
      setAttackState({
        attackId: null,
        phase: ATTACK_PHASE.idle,
        activeFrames: 0,
      }),
    );
    return () => {
      cannonboltView.form = "standing";
      cannonboltView.speed = 0;
    };
  }, [dispatch]);

  useFrame(() => {
    const curl = standingClips.actions[CANNONBOLT_CLIPS.curl];
    if (curl && cannonboltView.form !== "ball") {
      curl.setEffectiveTimeScale(CURL_TIME_SCALE);
    }
  }, -1);

  useFrame(() => {
    const showBall = cannonboltView.form === "ball";
    standing.visible = !showBall;
    ball.visible = showBall;
    const roll: AnimationAction | null | undefined = ballClips.actions[CANNONBOLT_CLIPS.roll];
    if (!roll) {
      return;
    }
    roll.setEffectiveTimeScale(
      showBall ? cannonboltRollTimeScale(cannonboltView.speed, roll.getClip().duration) : 0,
    );
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
          <primitive object={standing} dispose={null} />
          <primitive object={ball} dispose={null} />
        </group>
      </RigidBody>
      <AttackHitboxes characterId={character.id} model={ball} visualRef={visualRef} />
      <AttackHitboxes characterId={character.id} model={standing} visualRef={visualRef} />
    </>
  );
}

if (typeof window !== "undefined") {
  useGLTF.preload(STANDING_URL, ...gltfLoaderOptions);
  useGLTF.preload(BALL_URL, ...gltfLoaderOptions);
}
